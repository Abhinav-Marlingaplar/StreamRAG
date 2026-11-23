import asyncio
import json
import os
from pathlib import Path

from aiokafka import AIOKafkaProducer


TOPIC = "operations-events"
BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
SCENARIO_PATH = Path(__file__).with_name("demo_scenario.json")
VALID_EVENT_TYPES = {"incident_created", "incident_updated", "incident_resolved"}


def _load_scenario(path: Path) -> list[dict]:
	with path.open("r", encoding="utf-8") as scenario_file:
		events = json.load(scenario_file)

	if not isinstance(events, list):
		raise ValueError("demo_scenario.json must contain a top-level JSON array")

	for index, event in enumerate(events, start=1):
		_validate_event(event, index)

	return events


def _validate_event(event: dict, index: int) -> None:
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
		raise ValueError(f"Event {index} is missing required fields: {sorted(missing)}")

	event_type = event["event_type"]
	if event_type not in VALID_EVENT_TYPES:
		raise ValueError(
			f"Event {index} has invalid event_type '{event_type}'. "
			f"Expected one of {sorted(VALID_EVENT_TYPES)}"
		)

	payload = event["payload"]
	if not isinstance(payload, dict):
		raise ValueError(f"Event {index} payload must be a JSON object")

	if "status" not in payload:
		raise ValueError(f"Event {index} payload must include 'status'")


async def publish_scenario() -> None:
	events = _load_scenario(SCENARIO_PATH)

	producer = AIOKafkaProducer(
		bootstrap_servers=BOOTSTRAP_SERVERS,
		value_serializer=lambda value: json.dumps(value).encode("utf-8"),
	)

	await producer.start()
	try:
		for event in events:
			await producer.send_and_wait(TOPIC, event)
			print(f"Published {event['event_id']} to {TOPIC}")
	finally:
		await producer.stop()

	print(f"Published {len(events)} total events to {TOPIC} via {BOOTSTRAP_SERVERS}")


if __name__ == "__main__":
	asyncio.run(publish_scenario())
