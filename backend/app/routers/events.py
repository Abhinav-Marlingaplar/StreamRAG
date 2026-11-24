from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from ..dependencies import require_auth
from ..db import SessionLocal
from ..models import KnowledgeVersion, RawEvent


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
