from __future__ import annotations

import asyncio
import csv
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

from aiokafka import AIOKafkaProducer
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..dependencies import require_auth
from .status import increment_ingestion_failures, increment_simulator_published


TOPIC = "operations-events"
BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
VALID_EVENT_TYPES = {"incident_created", "incident_updated", "incident_resolved"}
SIMULATOR_DIR = Path(__file__).resolve().parents[3] / "simulator"
SCENARIO_PATH = SIMULATOR_DIR / "demo_scenario.json"
CSV_SCENARIO_PATH = SIMULATOR_DIR / "operational_events.csv"

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


class StreamStartRequest(BaseModel):
	source_mode: Literal["csv", "json_demo"] = "csv"
	interval_seconds: float = 2.5
	loop: bool = True
	max_events: int | None = None
	csv_path: str | None = None
	json_path: str | None = None


class StreamStatusResponse(BaseModel):
	running: bool
	source_mode: str | None
	source_path: str | None
	interval_seconds: float
	loop: bool
	max_events: int | None
	published_count: int
	failed_count: int
	last_error: str | None
	started_at: datetime | None
	last_event_id: str | None


class StreamControlResponse(BaseModel):
	running: bool
	detail: str


class _StreamState:
	def __init__(self) -> None:
		self.running = False
		self.source_mode: str | None = None
		self.source_path: str | None = None
		self.interval_seconds = 2.5
		self.loop = True
		self.max_events: int | None = None
		self.published_count = 0
		self.failed_count = 0
		self.last_error: str | None = None
		self.started_at: datetime | None = None
		self.last_event_id: str | None = None
		self.task: asyncio.Task | None = None
		self.lock = asyncio.Lock()


STREAM_STATE = _StreamState()


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


def _resolve_stream_path(source_mode: str, request: StreamStartRequest) -> Path:
	if source_mode == "csv":
		return Path(request.csv_path) if request.csv_path else CSV_SCENARIO_PATH
	return Path(request.json_path) if request.json_path else SCENARIO_PATH


def _load_demo_events(path: Path = SCENARIO_PATH) -> list[dict[str, Any]]:
	with path.open("r", encoding="utf-8") as scenario_file:
		events = json.load(scenario_file)

	if not isinstance(events, list):
		raise HTTPException(
			status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
			detail=f"{path.name} must contain a top-level JSON array",
		)

	for event in events:
		if not isinstance(event, dict):
			raise HTTPException(
				status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
				detail=f"{path.name} contains a non-object event",
			)
		_validate_event(event)

	return events


def _normalize_optional(value: str | None) -> str | None:
	if value is None:
		return None
	normalized = value.strip()
	return normalized if normalized else None


def _load_csv_events(path: Path) -> list[dict[str, Any]]:
	if not path.exists():
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"CSV file not found: {path}")

	with path.open("r", encoding="utf-8", newline="") as file_obj:
		reader = csv.DictReader(file_obj)
		if reader.fieldnames is None:
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{path.name} missing header row")

		required_columns = {
			"event_id",
			"event_type",
			"entity_id",
			"event_time",
			"source",
			"status",
			"description",
			"root_cause",
			"mitigation",
		}
		missing_columns = required_columns.difference(reader.fieldnames)
		if missing_columns:
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail=f"{path.name} missing required columns: {sorted(missing_columns)}",
			)

		events: list[dict[str, Any]] = []
		for row in reader:
			payload = {
				"status": str(row.get("status", "")).strip(),
				"service": _normalize_optional(row.get("service")),
				"severity": _normalize_optional(row.get("severity")),
				"description": _normalize_optional(row.get("description")),
				"root_cause": _normalize_optional(row.get("root_cause")),
				"mitigation": _normalize_optional(row.get("mitigation")),
			}
			payload = {key: value for key, value in payload.items() if value is not None}
			event = {
				"event_id": str(row.get("event_id", "")).strip(),
				"event_type": str(row.get("event_type", "")).strip(),
				"entity_id": str(row.get("entity_id", "")).strip(),
				"event_time": str(row.get("event_time", "")).strip(),
				"source": str(row.get("source", "")).strip(),
				"payload": payload,
			}
			_validate_event(event)
			events.append(event)

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


async def _publish_events(events: list[dict[str, Any]]) -> int:
	producer = AIOKafkaProducer(
		bootstrap_servers=BOOTSTRAP_SERVERS,
		value_serializer=lambda value: json.dumps(value).encode("utf-8"),
	)

	published_count = 0
	try:
		await producer.start()
		for event in events:
			await producer.send_and_wait(TOPIC, event)
			published_count += 1
		return published_count
	finally:
		await producer.stop()


async def _stream_events_loop(events: list[dict[str, Any]], request: StreamStartRequest) -> None:
	producer = AIOKafkaProducer(
		bootstrap_servers=BOOTSTRAP_SERVERS,
		value_serializer=lambda value: json.dumps(value).encode("utf-8"),
	)
	published_total = 0
	interval_seconds = max(0.0, float(request.interval_seconds))
	max_events = request.max_events if request.max_events is None else max(1, int(request.max_events))

	try:
		await producer.start()
		while STREAM_STATE.running:
			for event in events:
				if not STREAM_STATE.running:
					break
				try:
					await producer.send_and_wait(TOPIC, event)
					published_total += 1
					increment_simulator_published()
					STREAM_STATE.published_count = published_total
					STREAM_STATE.last_event_id = event.get("event_id")
				except Exception as exc:
					increment_ingestion_failures()
					STREAM_STATE.failed_count += 1
					STREAM_STATE.last_error = str(exc)
				if max_events is not None and published_total >= max_events:
					STREAM_STATE.running = False
					break
				if interval_seconds > 0:
					await asyncio.sleep(interval_seconds)
			if not request.loop:
				break
	finally:
		await producer.stop()
		STREAM_STATE.running = False


@router.post("/publish", response_model=SimulatorPublishResponse)
async def publish_events(
	request: SimulatorPublishRequest,
	_: str = Depends(require_auth),
) -> SimulatorPublishResponse:
	events = _load_demo_events() if request.run_demo else [_build_custom_event(request)]
	try:
		published_count = await _publish_events(events)
		if published_count:
			increment_simulator_published(published_count)
	except Exception:
		increment_ingestion_failures()
		raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Kafka publish failed")
	return SimulatorPublishResponse(published_count=published_count, topic=TOPIC)


@router.post("/stream/start", response_model=StreamControlResponse)
async def start_streaming(
	request: StreamStartRequest,
	_: str = Depends(require_auth),
) -> StreamControlResponse:
	async with STREAM_STATE.lock:
		if STREAM_STATE.running:
			raise HTTPException(
				status_code=status.HTTP_409_CONFLICT,
				detail="Simulator stream is already running. Stop it before starting a new stream.",
			)

		source_path = _resolve_stream_path(request.source_mode, request)
		events = _load_csv_events(source_path) if request.source_mode == "csv" else _load_demo_events(source_path)
		if not events:
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No events found for stream source")

		STREAM_STATE.running = True
		STREAM_STATE.source_mode = request.source_mode
		STREAM_STATE.source_path = str(source_path)
		STREAM_STATE.interval_seconds = max(0.0, float(request.interval_seconds))
		STREAM_STATE.loop = bool(request.loop)
		STREAM_STATE.max_events = request.max_events if request.max_events is None else max(1, int(request.max_events))
		STREAM_STATE.published_count = 0
		STREAM_STATE.failed_count = 0
		STREAM_STATE.last_error = None
		STREAM_STATE.started_at = datetime.now(timezone.utc)
		STREAM_STATE.last_event_id = None
		STREAM_STATE.task = asyncio.create_task(_stream_events_loop(events, request))

	return StreamControlResponse(running=True, detail=f"Started simulator stream from {source_path.name}")


@router.post("/stream/stop", response_model=StreamControlResponse)
async def stop_streaming(_: str = Depends(require_auth)) -> StreamControlResponse:
	async with STREAM_STATE.lock:
		if not STREAM_STATE.running:
			return StreamControlResponse(running=False, detail="Simulator stream is already stopped")

		STREAM_STATE.running = False
		task = STREAM_STATE.task
		STREAM_STATE.task = None

	if task is not None:
		task.cancel()
		try:
			await task
		except asyncio.CancelledError:
			pass

	return StreamControlResponse(running=False, detail="Stopped simulator stream")


@router.get("/stream/status", response_model=StreamStatusResponse)
async def stream_status(_: str = Depends(require_auth)) -> StreamStatusResponse:
	return StreamStatusResponse(
		running=STREAM_STATE.running,
		source_mode=STREAM_STATE.source_mode,
		source_path=STREAM_STATE.source_path,
		interval_seconds=STREAM_STATE.interval_seconds,
		loop=STREAM_STATE.loop,
		max_events=STREAM_STATE.max_events,
		published_count=STREAM_STATE.published_count,
		failed_count=STREAM_STATE.failed_count,
		last_error=STREAM_STATE.last_error,
		started_at=STREAM_STATE.started_at,
		last_event_id=STREAM_STATE.last_event_id,
	)
