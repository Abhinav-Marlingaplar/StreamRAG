import argparse
import asyncio
import csv
import json
import os
from pathlib import Path
from typing import Any

from aiokafka import AIOKafkaProducer


TOPIC = "operations-events"
BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
SCENARIO_PATH = Path(__file__).with_name("demo_scenario.json")
CSV_PATH = Path(__file__).with_name("operational_events.csv")
VALID_EVENT_TYPES = {"incident_created", "incident_updated", "incident_resolved"}


def _validate_event(event: dict[str, Any], index: int, source_label: str) -> None:
	required_top_level = {"event_id", "event_type", "entity_id", "event_time", "source", "payload"}
	missing = required_top_level.difference(event.keys())
	if missing:
		raise ValueError(f"{source_label} event {index} missing required fields: {sorted(missing)}")

	event_type = event["event_type"]
	if event_type not in VALID_EVENT_TYPES:
		raise ValueError(
			f"{source_label} event {index} has invalid event_type '{event_type}'. "
			f"Expected one of {sorted(VALID_EVENT_TYPES)}"
		)

	payload = event["payload"]
	if not isinstance(payload, dict):
		raise ValueError(f"{source_label} event {index} payload must be a JSON object")
	if "status" not in payload or not str(payload["status"]).strip():
		raise ValueError(f"{source_label} event {index} payload must include non-empty 'status'")


def _load_json_scenario(path: Path) -> list[dict[str, Any]]:
	with path.open("r", encoding="utf-8") as scenario_file:
		events = json.load(scenario_file)
	if not isinstance(events, list):
		raise ValueError(f"{path.name} must contain a top-level JSON array")
	for index, event in enumerate(events, start=1):
		if not isinstance(event, dict):
			raise ValueError(f"{path.name} event {index} must be a JSON object")
		_validate_event(event, index, path.name)
	return events


def _normalize_optional(value: str | None) -> str | None:
	if value is None:
		return None
	normalized = value.strip()
	return normalized if normalized else None


def _load_csv_scenario(path: Path) -> list[dict[str, Any]]:
	events: list[dict[str, Any]] = []
	with path.open("r", encoding="utf-8", newline="") as file_obj:
		reader = csv.DictReader(file_obj)
		required_columns = {
			"event_id",
			"event_type",
			"entity_id",
			"event_time",
			"source",
			"status",
			"service",
			"severity",
			"description",
			"root_cause",
			"mitigation",
		}
		if reader.fieldnames is None:
			raise ValueError(f"{path.name} is missing a header row")
		missing_columns = required_columns.difference(reader.fieldnames)
		if missing_columns:
			raise ValueError(f"{path.name} missing required columns: {sorted(missing_columns)}")

		for index, row in enumerate(reader, start=2):
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
			_validate_event(event, index, path.name)
			events.append(event)
	return events


async def publish_scenario(
	events: list[dict[str, Any]],
	interval_seconds: float,
	loop: bool,
	max_events: int | None,
) -> None:
	producer = AIOKafkaProducer(
		bootstrap_servers=BOOTSTRAP_SERVERS,
		value_serializer=lambda value: json.dumps(value).encode("utf-8"),
	)

	await producer.start()
	published = 0
	try:
		while True:
			for event in events:
				await producer.send_and_wait(TOPIC, event)
				published += 1
				print(f"[{published}] Published {event['event_id']} ({event['event_type']}) to {TOPIC}")
				if max_events is not None and published >= max_events:
					print(f"Reached max_events={max_events}; stopping producer.")
					return
				if interval_seconds > 0:
					await asyncio.sleep(interval_seconds)
			if not loop:
				return
	except KeyboardInterrupt:
		print("Interrupted by user; stopping producer.")
	finally:
		await producer.stop()
		print(f"Published {published} total events to {TOPIC} via {BOOTSTRAP_SERVERS}")


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(description="Publish StreamRAG incident events to Kafka.")
	parser.add_argument(
		"--mode",
		choices=["json", "csv"],
		default="json",
		help="Input format mode: JSON demo scenario or CSV event stream.",
	)
	parser.add_argument(
		"--scenario-path",
		type=str,
		default=str(SCENARIO_PATH),
		help="Path to JSON scenario file (used in --mode json).",
	)
	parser.add_argument(
		"--csv-path",
		type=str,
		default=str(CSV_PATH),
		help="Path to CSV event dataset (used in --mode csv).",
	)
	parser.add_argument(
		"--interval-seconds",
		type=float,
		default=0.0,
		help="Delay between publishes (seconds). Example: 2.5 for one event every 2.5s.",
	)
	parser.add_argument(
		"--loop",
		action="store_true",
		help="Restart from first event after reaching end of dataset.",
	)
	parser.add_argument(
		"--max-events",
		type=int,
		default=None,
		help="Optional cap on total events published in this run.",
	)
	return parser.parse_args()


async def main() -> None:
	args = parse_args()
	if args.mode == "json":
		events = _load_json_scenario(Path(args.scenario_path))
	else:
		events = _load_csv_scenario(Path(args.csv_path))

	if not events:
		raise ValueError("No events found in selected scenario input.")

	await publish_scenario(
		events=events,
		interval_seconds=max(0.0, float(args.interval_seconds)),
		loop=bool(args.loop),
		max_events=args.max_events if args.max_events is None else max(1, int(args.max_events)),
	)


if __name__ == "__main__":
	asyncio.run(main())
