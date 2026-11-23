from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class TimelineVersionResponse(BaseModel):
	id: int
	entity_id: str
	version: int
	content: str
	status: str
	valid_from: datetime
	valid_to: datetime | None
	event_time: datetime
	source_event_id: str
	is_current: bool
