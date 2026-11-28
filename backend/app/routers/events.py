from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError

from ..dependencies import require_auth
from ..db import SessionLocal
from ..models import KnowledgeVersion, RawEvent
from .simulator import PUBLISH_LOG


router = APIRouter(prefix="/api/events", tags=["events"])


class RecentEventItem(BaseModel):
	kind: str
	timestamp: datetime
	entity_id: str
	source: str
	ingestion_status: str
	service: str | None = None
	severity: str | None = None
	description: str | None = None
	root_cause: str | None = None
	mitigation: str | None = None
	status: str | None = None
	event_id: str | None = None
	event_type: str | None = None
	event_time: datetime | None = None
	knowledge_version_id: int | None = None
	version: int | None = None


@router.get("/recent", response_model=list[RecentEventItem])
def get_recent_events(
	limit: int = Query(default=20, ge=1, le=100),
	_: str = Depends(require_auth),
) -> list[RecentEventItem]:
	session = SessionLocal()
	try:
		raw_events = session.scalars(
			select(RawEvent).order_by(RawEvent.ingested_at.desc()).limit(limit)
		).all()
		knowledge_versions = session.scalars(
			select(KnowledgeVersion)
			.order_by(KnowledgeVersion.created_at.desc())
			.limit(limit)
		).all()
		knowledge_event_ids = [version.source_event_id for version in knowledge_versions]
		knowledge_payload_by_event_id: dict[str, dict] = {}
		if knowledge_event_ids:
			raw_rows_for_versions = session.scalars(
				select(RawEvent).where(RawEvent.event_id.in_(knowledge_event_ids))
			).all()
			knowledge_payload_by_event_id = {}
			for row in raw_rows_for_versions:
				payload = getattr(row, "payload", None)
				if isinstance(payload, dict):
					knowledge_payload_by_event_id[row.event_id] = payload

		items: list[RecentEventItem] = []
		for event in raw_events:
			raw_payload = getattr(event, "payload", None)
			payload = raw_payload if isinstance(raw_payload, dict) else {}
			items.append(
				RecentEventItem(
					kind="raw_event",
					timestamp=event.ingested_at,
					entity_id=event.entity_id,
					source=event.source,
					ingestion_status="ingested_to_db",
					service=payload.get("service"),
					severity=payload.get("severity"),
					description=payload.get("description"),
					root_cause=payload.get("root_cause"),
					mitigation=payload.get("mitigation"),
					status=payload.get("status"),
					event_id=event.event_id,
					event_type=event.event_type,
					event_time=getattr(event, "event_time", None),
				)
			)

		for version in knowledge_versions:
			payload = knowledge_payload_by_event_id.get(version.source_event_id, {})
			items.append(
				RecentEventItem(
					kind="knowledge_version",
					timestamp=version.created_at,
					entity_id=version.entity_id,
					source="ingestion",
					ingestion_status="indexed_with_embedding",
					service=payload.get("service"),
					severity=payload.get("severity"),
					description=payload.get("description"),
					root_cause=payload.get("root_cause"),
					mitigation=payload.get("mitigation"),
					event_id=version.source_event_id,
					event_time=getattr(version, "event_time", None),
					knowledge_version_id=version.id,
					version=version.version,
					status=version.status,
				)
			)

		items.sort(key=lambda item: item.timestamp, reverse=True)
		return items[:limit]
	except SQLAlchemyError:
		raise HTTPException(
			status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
			detail="Database unavailable while reading recent events. Please retry shortly.",
		)
	finally:
		session.close()


class PipelineVersion(BaseModel):
	id: int
	version: int
	status: str
	valid_from: datetime
	valid_to: datetime | None
	is_current: bool
	indexed: bool


class PipelineEvent(BaseModel):
	event_id: str
	event_type: str
	entity_id: str
	event_time: datetime
	source: str
	payload: dict[str, Any]
	published_at: datetime | None = None
	last_published_at: datetime | None = None
	publish_count: int = 0
	ingested_at: datetime | None = None
	stage: Literal["published", "persisted", "indexed"]
	duplicate: bool = False
	version: PipelineVersion | None = None


class PipelineCounts(BaseModel):
	raw_events: int
	versions: int
	indexed_versions: int
	awaiting_index: int


class PipelineResponse(BaseModel):
	events: list[PipelineEvent]
	counts: PipelineCounts
	server_time: datetime


# Broker-ack time comes from this process's publish log; DB timestamps come from PostgreSQL.
DUPLICATE_TOLERANCE = timedelta(seconds=2)


@router.get("/pipeline", response_model=PipelineResponse)
def get_pipeline_events(
	limit: int = Query(default=60, ge=1, le=200),
	_: str = Depends(require_auth),
) -> PipelineResponse:
	published: dict[str, dict[str, Any]] = {}
	for entry in list(PUBLISH_LOG):
		event = entry["event"]
		record = published.setdefault(
			event["event_id"],
			{"event": event, "first": entry["published_at"], "last": entry["published_at"], "count": 0},
		)
		record["event"] = event
		record["last"] = entry["published_at"]
		record["count"] += 1

	session = SessionLocal()
	try:
		recent_raw = session.scalars(
			select(RawEvent).order_by(RawEvent.ingested_at.desc()).limit(limit)
		).all()
		raw_by_id = {row.event_id: row for row in recent_raw}
		missing_ids = [event_id for event_id in published if event_id not in raw_by_id]
		if missing_ids:
			for row in session.scalars(select(RawEvent).where(RawEvent.event_id.in_(missing_ids))):
				raw_by_id[row.event_id] = row

		version_by_event_id: dict[str, Any] = {}
		if raw_by_id:
			version_rows = session.execute(
				select(
					KnowledgeVersion.id,
					KnowledgeVersion.version,
					KnowledgeVersion.status,
					KnowledgeVersion.valid_from,
					KnowledgeVersion.valid_to,
					KnowledgeVersion.source_event_id,
					KnowledgeVersion.embedding.is_not(None).label("indexed"),
				).where(KnowledgeVersion.source_event_id.in_(list(raw_by_id)))
			).all()
			version_by_event_id = {row.source_event_id: row for row in version_rows}

		raw_total = session.scalar(select(func.count()).select_from(RawEvent)) or 0
		version_total = session.scalar(select(func.count(KnowledgeVersion.id))) or 0
		indexed_total = (
			session.scalar(
				select(func.count(KnowledgeVersion.id)).where(KnowledgeVersion.embedding.is_not(None))
			)
			or 0
		)
	except SQLAlchemyError:
		raise HTTPException(
			status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
			detail="Database unavailable while reading the event pipeline. Please retry shortly.",
		)
	finally:
		session.close()

	items: list[PipelineEvent] = []
	for event_id in set(raw_by_id) | set(published):
		raw = raw_by_id.get(event_id)
		record = published.get(event_id)
		version_row = version_by_event_id.get(event_id)
		version = (
			PipelineVersion(
				id=version_row.id,
				version=version_row.version,
				status=version_row.status,
				valid_from=version_row.valid_from,
				valid_to=version_row.valid_to,
				is_current=version_row.valid_to is None,
				indexed=bool(version_row.indexed),
			)
			if version_row is not None
			else None
		)
		if raw is not None:
			stage = "indexed" if version is not None and version.indexed else "persisted"
			body = {
				"event_type": raw.event_type,
				"entity_id": raw.entity_id,
				"event_time": raw.event_time,
				"source": raw.source,
				"payload": raw.payload if isinstance(raw.payload, dict) else {},
			}
		else:
			stage = "published"
			event = record["event"]
			body = {
				"event_type": event["event_type"],
				"entity_id": event["entity_id"],
				"event_time": event["event_time"],
				"source": event["source"],
				"payload": event["payload"],
			}
		first_published = record["first"] if record else None
		items.append(
			PipelineEvent(
				event_id=event_id,
				published_at=first_published,
				last_published_at=record["last"] if record else None,
				publish_count=record["count"] if record else 0,
				ingested_at=raw.ingested_at if raw is not None else None,
				stage=stage,
				duplicate=bool(
					raw is not None
					and first_published is not None
					and raw.ingested_at < first_published - DUPLICATE_TOLERANCE
				),
				version=version,
				**body,
			)
		)

	def entered_at(item: PipelineEvent) -> datetime:
		return item.published_at or item.ingested_at

	items.sort(key=entered_at, reverse=True)
	return PipelineResponse(
		events=items[:limit],
		counts=PipelineCounts(
			raw_events=int(raw_total),
			versions=int(version_total),
			indexed_versions=int(indexed_total),
			awaiting_index=max(int(version_total) - int(indexed_total), 0),
		),
		server_time=datetime.now(timezone.utc),
	)