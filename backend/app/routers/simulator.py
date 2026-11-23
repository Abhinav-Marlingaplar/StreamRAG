from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from aiokafka import AIOKafkaProducer
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..dependencies import require_auth
from .status import increment_ingestion_failures


TOPIC = "operations-events"
BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
VALID_EVENT_TYPES = {"incident_created", "incident_updated", "incident_resolved"}
SCENARIO_PATH = Path(__file__).resolve().parents[3] / "simulator" / "demo_scenario.json"

router = APIRouter(prefix="/api/simulator", tags=["simulator"])


class SimulatorPublishRequest(BaseModel):
	run_demo: bool = False
	entity_id: str | None = None
	event_type: str | None = None
	payload: dict[str, Any] | None = None
	source: str = "simulator"
	event_id: str | None = None
	event_time: str | None = None


class SimulatorPublishResponse(BaseModel):
	published_count: int
	topic: str


def _validate_event(event: dict[str, Any]) -> None:
	required_top_level = {
		"event_id",
		"event_type",
		"entity_id",
		"event_time",
		"source",
		"payload",
	}
	missing = required_top_level.difference(event.keys())
	if missing:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail=f"Event is missing required fields: {sorted(missing)}",
		)

	if event["event_type"] not in VALID_EVENT_TYPES:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail=f"Invalid event_type '{event['event_type']}'. Expected one of {sorted(VALID_EVENT_TYPES)}",
		)

	if not isinstance(event["payload"], dict):
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="payload must be a JSON object")

	if "status" not in event["payload"]:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="payload must include 'status'")


def _load_demo_events() -> list[dict[str, Any]]:
	with SCENARIO_PATH.open("r", encoding="utf-8") as scenario_file:
		events = json.load(scenario_file)

	if not isinstance(events, list):
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail="demo_scenario.json must contain a top-level JSON array",
		)

	for event in events:
		if not isinstance(event, dict):
			raise HTTPException(
				status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
				detail="demo_scenario.json contains a non-object event",
			)
		_validate_event(event)

	return events


def _build_custom_event(payload: SimulatorPublishRequest) -> dict[str, Any]:
	if not payload.entity_id or not payload.event_type or payload.payload is None:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Custom publish requires entity_id, event_type, and payload",
		)

	event_time = payload.event_time
	if not event_time:
		event_time = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

	event = {
		"event_id": payload.event_id or str(uuid4()),
		"event_type": payload.event_type,
		"entity_id": payload.entity_id,
		"event_time": event_time,
		"source": payload.source,
		"payload": payload.payload,
	}
	_validate_event(event)
	return event


@router.post("/publish", response_model=SimulatorPublishResponse)
async def publish_events(
	request: SimulatorPublishRequest,
	_: str = Depends(require_auth),
) -> SimulatorPublishResponse:
	events = _load_demo_events() if request.run_demo else [_build_custom_event(request)]

	producer = AIOKafkaProducer(
		bootstrap_servers=BOOTSTRAP_SERVERS,
		value_serializer=lambda value: json.dumps(value).encode("utf-8"),
	)

	try:
		await producer.start()
		for event in events:
			await producer.send_and_wait(TOPIC, event)
	except Exception:
		increment_ingestion_failures()
		raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Kafka publish failed")
	finally:
		await producer.stop()

	return SimulatorPublishResponse(published_count=len(events), topic=TOPIC)
