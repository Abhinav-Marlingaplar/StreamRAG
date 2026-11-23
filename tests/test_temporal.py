import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Make backend/app importable as the "app" package.
BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

# app.db requires DATABASE_URL at import time.
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")

from app.core.temporal import IncomingTemporalEvent, apply_temporal_versioning
from app.db import Base
from app.models import KnowledgeVersion, RawEvent


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(_type, _compiler, **_kwargs):
	# SQLite has no JSONB type; map to JSON for test schema creation.
	return "JSON"


def _ts(hour: int, minute: int = 0) -> datetime:
	return datetime(2026, 9, 26, hour, minute, tzinfo=timezone.utc)


def _as_naive_utc(value: datetime) -> datetime:
	if value.tzinfo is None:
		return value
	return value.astimezone(timezone.utc).replace(tzinfo=None)


def _event(entity_id: str, event_id: str, event_time: datetime, status: str) -> IncomingTemporalEvent:
	return IncomingTemporalEvent(
		entity_id=entity_id,
		event_id=event_id,
		event_time=event_time,
		content=f"state={status}",
		status=status,
	)


def _versions_for_entity(session: Session, entity_id: str) -> list[KnowledgeVersion]:
	return list(
		session.scalars(
			select(KnowledgeVersion)
			.where(KnowledgeVersion.entity_id == entity_id)
			.order_by(KnowledgeVersion.valid_from.asc(), KnowledgeVersion.id.asc())
		)
	)


@pytest.fixture()
def db_session() -> Session:
	engine = create_engine(
		"sqlite+pysqlite:///:memory:",
		connect_args={"check_same_thread": False},
		poolclass=StaticPool,
	)
	Base.metadata.create_all(engine)
	SessionLocal = sessionmaker(bind=engine)
	session = SessionLocal()
	try:
		yield session
	finally:
		session.close()
		Base.metadata.drop_all(engine)


def test_new_entity_first_event_creates_one_current_row(db_session: Session) -> None:
	entity_id = "INC-1000"
	created = apply_temporal_versioning(
		db_session,
		_event(entity_id, "evt-1", _ts(10), "investigating"),
	)
	db_session.commit()

	rows = _versions_for_entity(db_session, entity_id)
	assert created is not None
	assert len(rows) == 1
	assert rows[0].valid_to is None
	assert _as_naive_utc(rows[0].valid_from) == _as_naive_utc(_ts(10))


def test_in_order_update_closes_previous_and_adds_new_current(db_session: Session) -> None:
	entity_id = "INC-1001"
	apply_temporal_versioning(db_session, _event(entity_id, "evt-1", _ts(10), "investigating"))
	apply_temporal_versioning(db_session, _event(entity_id, "evt-2", _ts(11), "mitigated"))
	db_session.commit()

	rows = _versions_for_entity(db_session, entity_id)
	assert len(rows) == 2
	assert _as_naive_utc(rows[0].valid_from) == _as_naive_utc(_ts(10))
	assert _as_naive_utc(rows[0].valid_to) == _as_naive_utc(_ts(11))
	assert _as_naive_utc(rows[1].valid_from) == _as_naive_utc(_ts(11))
	assert rows[1].valid_to is None


def test_late_arriving_event_sets_new_valid_to_and_leaves_later_valid_to_untouched(
	db_session: Session,
) -> None:
	entity_id = "INC-1002"
	apply_temporal_versioning(db_session, _event(entity_id, "evt-later", _ts(11), "resolved"))
	db_session.flush()

	later_row = _versions_for_entity(db_session, entity_id)[0]
	later_id = later_row.id
	later_valid_to_before = later_row.valid_to

	apply_temporal_versioning(db_session, _event(entity_id, "evt-earlier", _ts(10), "investigating"))
	db_session.commit()

	rows = _versions_for_entity(db_session, entity_id)
	earlier_row, later_row_after = rows[0], rows[1]

	assert earlier_row.valid_to == later_row_after.valid_from
	assert _as_naive_utc(later_row_after.valid_from) == _as_naive_utc(_ts(11))
	assert later_row_after.valid_to == later_valid_to_before

	# Explicitly re-read later row to ensure it was not updated during late insert.
	persisted_later = db_session.get(KnowledgeVersion, later_id)
	assert persisted_later is not None
	assert persisted_later.valid_to == later_valid_to_before


def test_duplicate_event_id_does_not_create_second_version_row(db_session: Session) -> None:
	entity_id = "INC-1003"
	first = apply_temporal_versioning(db_session, _event(entity_id, "evt-dup", _ts(10), "open"))
	second = apply_temporal_versioning(db_session, _event(entity_id, "evt-dup", _ts(10), "open"))
	db_session.commit()

	versions_count = db_session.scalar(
		select(func.count()).select_from(KnowledgeVersion).where(KnowledgeVersion.entity_id == entity_id)
	)
	raw_events_count = db_session.scalar(
		select(func.count()).select_from(RawEvent).where(RawEvent.entity_id == entity_id)
	)

	assert first is not None
	assert second is None
	assert versions_count == 1
	assert raw_events_count == 1


def test_late_arrival_never_mutates_version_numbers_of_existing_rows(db_session: Session) -> None:
	entity_id = "INC-1004"
	apply_temporal_versioning(db_session, _event(entity_id, "evt-1", _ts(10), "investigating"))
	apply_temporal_versioning(db_session, _event(entity_id, "evt-3", _ts(12), "resolved"))
	db_session.flush()

	existing_rows = _versions_for_entity(db_session, entity_id)
	before_versions = {row.id: row.version for row in existing_rows}

	apply_temporal_versioning(db_session, _event(entity_id, "evt-2", _ts(11), "mitigated"))
	db_session.commit()

	for row_id, original_version in before_versions.items():
		row = db_session.get(KnowledgeVersion, row_id)
		assert row is not None
		assert row.version == original_version


def test_scrambled_late_events_produce_same_final_timeline_as_in_order(db_session: Session) -> None:
	entity_id_a = "INC-1005-A"
	entity_id_b = "INC-1005-B"

	ordered = [
		_event(entity_id_a, "evt-1", _ts(10), "open"),
		_event(entity_id_a, "evt-2", _ts(11), "investigating"),
		_event(entity_id_a, "evt-3", _ts(12), "mitigated"),
	]
	scrambled = [
		_event(entity_id_b, "evt-b-3", _ts(12), "mitigated"),
		_event(entity_id_b, "evt-b-2", _ts(11), "investigating"),
		_event(entity_id_b, "evt-b-1", _ts(10), "open"),
	]

	for evt in ordered:
		apply_temporal_versioning(db_session, evt)
	for evt in scrambled:
		apply_temporal_versioning(db_session, evt)
	db_session.commit()

	timeline_ordered = [
		(row.valid_from, row.valid_to, row.status, row.content)
		for row in _versions_for_entity(db_session, entity_id_a)
	]
	timeline_scrambled = [
		(row.valid_from, row.valid_to, row.status, row.content)
		for row in _versions_for_entity(db_session, entity_id_b)
	]

	assert timeline_scrambled == timeline_ordered
