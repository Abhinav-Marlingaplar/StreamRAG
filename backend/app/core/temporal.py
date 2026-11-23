from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from ..models import KnowledgeVersion, RawEvent


@dataclass(slots=True)
class IncomingTemporalEvent:
	entity_id: str
	event_time: datetime
	content: str
	status: str
	event_id: str
	event_type: str = "incident_updated"
	source: str = "incident-system"
	payload: dict[str, Any] | None = None


def apply_temporal_versioning(
	session: Session, incoming_event: IncomingTemporalEvent
) -> KnowledgeVersion | None:
	# Step 1: idempotency check.
	if session.get(RawEvent, incoming_event.event_id) is not None:
		return None

	# Step 2: insert raw event.
	raw_event = RawEvent(
		event_id=incoming_event.event_id,
		event_type=incoming_event.event_type,
		entity_id=incoming_event.entity_id,
		event_time=incoming_event.event_time,
		source=incoming_event.source,
		payload=incoming_event.payload
		if incoming_event.payload is not None
		else {"status": incoming_event.status, "content": incoming_event.content},
	)
	session.add(raw_event)
	# Ensure FK target exists before knowledge_versions rows reference source_event_id.
	session.flush()

	# Step 3: find the version that was valid at T before this event.
	previous_valid_at_t = session.scalar(
		select(KnowledgeVersion)
		.where(
			and_(
				KnowledgeVersion.entity_id == incoming_event.entity_id,
				KnowledgeVersion.valid_from <= incoming_event.event_time,
				or_(
					KnowledgeVersion.valid_to.is_(None),
					incoming_event.event_time < KnowledgeVersion.valid_to,
				),
			)
		)
		.order_by(KnowledgeVersion.valid_from.desc())
		.limit(1)
	)

	# Used by steps 5 and 6.
	next_by_start = session.scalar(
		select(KnowledgeVersion)
		.where(
			and_(
				KnowledgeVersion.entity_id == incoming_event.entity_id,
				KnowledgeVersion.valid_from > incoming_event.event_time,
			)
		)
		.order_by(KnowledgeVersion.valid_from.asc())
		.limit(1)
	)

	# Keep version as insertion-order counter without mutating existing rows.
	existing_versions_count = session.scalar(
		select(func.count())
		.select_from(KnowledgeVersion)
		.where(KnowledgeVersion.entity_id == incoming_event.entity_id)
	)
	new_version_number = (existing_versions_count or 0) + 1

	# Step 5: insert new knowledge version at T.
	new_version = KnowledgeVersion(
		entity_id=incoming_event.entity_id,
		version=new_version_number,
		content=incoming_event.content,
		status=incoming_event.status,
		valid_from=incoming_event.event_time,
		valid_to=next_by_start.valid_from if next_by_start is not None else None,
		event_time=incoming_event.event_time,
		source_event_id=incoming_event.event_id,
	)
	session.add(new_version)

	# Step 6: late-arriving event case is handled by setting valid_to to next_by_start.
	# We intentionally do not mutate later versions in that branch.

	# Step 7: newest event case updates the previous current version's valid_to.
	if next_by_start is None and previous_valid_at_t is not None:
		previous_valid_at_t.valid_to = incoming_event.event_time

	# Step 8 (embedding + pgvector write) is intentionally out of scope in this task.
	session.flush()
	return new_version
