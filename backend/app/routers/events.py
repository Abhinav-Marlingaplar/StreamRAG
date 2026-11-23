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
	event_id: str | None = None
	event_type: str | None = None
	knowledge_version_id: int | None = None
	version: int | None = None
	status: str | None = None


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

		items: list[RecentEventItem] = []
		for event in raw_events:
			items.append(
				RecentEventItem(
					kind="raw_event",
					timestamp=event.ingested_at,
					entity_id=event.entity_id,
					source=event.source,
					event_id=event.event_id,
					event_type=event.event_type,
				)
			)

		for version in knowledge_versions:
			items.append(
				RecentEventItem(
					kind="knowledge_version",
					timestamp=version.created_at,
					entity_id=version.entity_id,
					source="ingestion",
					event_id=version.source_event_id,
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
