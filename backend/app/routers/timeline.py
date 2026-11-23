from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from ..dependencies import require_auth
from ..db import SessionLocal
from ..models import KnowledgeVersion
from ..schemas import TimelineVersionResponse


router = APIRouter(prefix="/api/timeline", tags=["timeline"])


@router.get("/{entity_id}", response_model=list[TimelineVersionResponse])
def get_timeline(entity_id: str, _: str = Depends(require_auth)) -> list[TimelineVersionResponse]:
	session = SessionLocal()
	try:
		statement = (
			select(KnowledgeVersion)
			.where(KnowledgeVersion.entity_id == entity_id)
			.order_by(
				KnowledgeVersion.valid_from.asc(),
				KnowledgeVersion.version.asc(),
				KnowledgeVersion.created_at.asc(),
			)
		)
		rows = session.scalars(statement).all()

		return [
			TimelineVersionResponse(
				id=row.id,
				entity_id=row.entity_id,
				version=row.version,
				content=row.content,
				status=row.status,
				valid_from=row.valid_from,
				valid_to=row.valid_to,
				event_time=row.event_time,
				source_event_id=row.source_event_id,
				is_current=row.valid_to is None,
			)
			for row in rows
		]
	except SQLAlchemyError:
		raise HTTPException(
			status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
			detail="Database unavailable while reading timeline. Please retry shortly.",
		)
	finally:
		session.close()
