from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal

from aiokafka import AIOKafkaConsumer
from aiokafka.errors import KafkaError
from pydantic import BaseModel, ValidationError
from sentence_transformers import SentenceTransformer
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .. import config as app_config
from ..core.temporal import IncomingTemporalEvent, apply_temporal_versioning
from ..db import SessionLocal
from ..vectorstore import upsert_embedding


LOGGER = logging.getLogger(__name__)
logging.basicConfig(
	level=os.getenv("LOG_LEVEL", "INFO"),
	format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

TOPIC = "operations-events"
BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
GROUP_ID = os.getenv("KAFKA_CONSUMER_GROUP", "streamrag-ingestion")
KAFKA_BASE_BACKOFF_SECONDS = 1
KAFKA_MAX_BACKOFF_SECONDS = 30
DB_MAX_RETRIES = 3
DB_RETRY_BASE_SECONDS = 1
EMBED_RETRY_BASE_SECONDS = 1
METRIC_EVENTS_PROCESSED = "events_processed"
METRIC_INGESTION_FAILURES = "ingestion_failures"
METRIC_KAFKA_CONSUMER_STATUS = "kafka_consumer_status"


def _resolve_embedding_model_name() -> str:
	configured = getattr(app_config, "embedding_model", None)
	if configured:
		return str(configured)
	return os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")


class EventPayload(BaseModel):
	status: str
	service: str | None = None
	severity: str | None = None
	root_cause: str | None = None
	mitigation: str | None = None
	description: str | None = None


class KafkaEvent(BaseModel):
	event_id: str
	event_type: Literal["incident_created", "incident_updated", "incident_resolved"]
	entity_id: str
	event_time: datetime
	source: str
	payload: EventPayload


def _validate_event(message_value: dict[str, Any]) -> KafkaEvent:
	validate_method = getattr(KafkaEvent, "model_validate", None)
	if validate_method is not None:
		return validate_method(message_value)
	return KafkaEvent.parse_obj(message_value)


def _model_to_dict(model: BaseModel) -> dict[str, Any]:
	dump_method = getattr(model, "model_dump", None)
	if dump_method is not None:
		return dump_method(exclude_none=True)
	return model.dict(exclude_none=True)


def _build_content(entity_id: str, payload: EventPayload) -> str:
	parts = [f"{entity_id} status is {payload.status.replace('_', ' ')}."]
	if payload.service:
		parts.append(f"Service: {payload.service}.")
	if payload.severity:
		parts.append(f"Severity: {payload.severity}.")
	if payload.root_cause:
		parts.append(f"Root cause: {payload.root_cause}.")
	if payload.mitigation:
		parts.append(f"Mitigation: {payload.mitigation}.")
	if payload.description:
		parts.append(f"Description: {payload.description}.")
	return " ".join(parts)


def _to_float_list(vector: Any) -> list[float]:
	if hasattr(vector, "tolist"):
		vector = vector.tolist()
	return [float(x) for x in vector]


async def _generate_embedding_with_retry(
	embedder: SentenceTransformer, content: str
) -> list[float] | None:
	for attempt in range(1, 3):
		try:
			embedding = embedder.encode(content)
			return _to_float_list(embedding)
		except Exception as exc:
			if attempt == 2:
				LOGGER.exception("Embedding failed after retry: %s", exc)
				return None
			delay = EMBED_RETRY_BASE_SECONDS * attempt
			LOGGER.warning(
				"Embedding failed (attempt %s/2), retrying in %ss: %s",
				attempt,
				delay,
				exc,
			)
			await asyncio.sleep(delay)
	return None


@dataclass(slots=True)
class ProcessResult:
	duplicate: bool
	knowledge_version_id: int | None
	content: str | None


def _apply_temporal(session_event: KafkaEvent) -> ProcessResult:
	session = SessionLocal()
	try:
		incoming = IncomingTemporalEvent(
			entity_id=session_event.entity_id,
			event_time=session_event.event_time,
			content=_build_content(session_event.entity_id, session_event.payload),
			status=session_event.payload.status,
			event_id=session_event.event_id,
			event_type=session_event.event_type,
			source=session_event.source,
			payload=_model_to_dict(session_event.payload),
		)

		knowledge_version = apply_temporal_versioning(session, incoming)
		if knowledge_version is None:
			session.rollback()
			return ProcessResult(duplicate=True, knowledge_version_id=None, content=None)

		knowledge_version_id = knowledge_version.id
		content = knowledge_version.content
		session.commit()
		return ProcessResult(
			duplicate=False,
			knowledge_version_id=knowledge_version_id,
			content=content,
		)
	except SQLAlchemyError:
		session.rollback()
		raise
	finally:
		session.close()


def _store_embedding(knowledge_version_id: int, embedding: list[float]) -> None:
	session = SessionLocal()
	try:
		upsert_embedding(session, knowledge_version_id, embedding)
		session.commit()
	except SQLAlchemyError:
		session.rollback()
		raise
	finally:
		session.close()


def _set_metric_text(metric_key: str, value: str) -> None:
	session = SessionLocal()
	try:
		session.execute(
			text(
				"""
				INSERT INTO metrics (key, int_value, text_value, updated_at)
				VALUES (:key, NULL, :text_value, now())
				ON CONFLICT (key)
				DO UPDATE SET
					text_value = EXCLUDED.text_value,
					updated_at = now()
				"""
			),
			{"key": metric_key, "text_value": value},
		)
		session.commit()
	except SQLAlchemyError:
		session.rollback()
	finally:
		session.close()


def _increment_metric(metric_key: str, count: int = 1) -> None:
	session = SessionLocal()
	try:
		session.execute(
			text(
				"""
				INSERT INTO metrics (key, int_value, text_value, updated_at)
				VALUES (:key, :count, NULL, now())
				ON CONFLICT (key)
				DO UPDATE SET
					int_value = COALESCE(metrics.int_value, 0) + EXCLUDED.int_value,
					updated_at = now()
				"""
			),
			{"key": metric_key, "count": int(count)},
		)
		session.commit()
	except SQLAlchemyError:
		session.rollback()
	finally:
		session.close()


async def _process_message(event: KafkaEvent, embedder: SentenceTransformer) -> bool:
	process_result: ProcessResult | None = None
	for attempt in range(1, DB_MAX_RETRIES + 1):
		try:
			process_result = _apply_temporal(event)
			break
		except SQLAlchemyError as exc:
			if attempt == DB_MAX_RETRIES:
				LOGGER.exception(
					"Database failure while processing event %s after %s attempts: %s",
					event.event_id,
					DB_MAX_RETRIES,
					exc,
				)
				return False

			delay = DB_RETRY_BASE_SECONDS * (2 ** (attempt - 1))
			LOGGER.warning(
				"Database failure processing event %s (attempt %s/%s), retrying in %ss: %s",
				event.event_id,
				attempt,
				DB_MAX_RETRIES,
				delay,
				exc,
			)
			await asyncio.sleep(delay)

	if process_result is None:
		return False

	if process_result.duplicate:
		LOGGER.debug("Duplicate event skipped: %s", event.event_id)
		return True

	if process_result.knowledge_version_id is None or process_result.content is None:
		LOGGER.error("Temporal processing returned an incomplete result for %s", event.event_id)
		return False

	embedding = await _generate_embedding_with_retry(embedder, process_result.content)
	if embedding is None:
		return False

	for attempt in range(1, DB_MAX_RETRIES + 1):
		try:
			_store_embedding(process_result.knowledge_version_id, embedding)
			return True
		except SQLAlchemyError as exc:
			if attempt == DB_MAX_RETRIES:
				LOGGER.exception(
					"Database failure while storing embedding for event %s after %s attempts: %s",
					event.event_id,
					DB_MAX_RETRIES,
					exc,
				)
				return False

			delay = DB_RETRY_BASE_SECONDS * (2 ** (attempt - 1))
			LOGGER.warning(
				"Database failure storing embedding for %s (attempt %s/%s), retrying in %ss: %s",
				event.event_id,
				attempt,
				DB_MAX_RETRIES,
				delay,
				exc,
			)
			await asyncio.sleep(delay)

	return False


async def consume_forever() -> None:
	embedder = SentenceTransformer(_resolve_embedding_model_name())
	kafka_backoff = KAFKA_BASE_BACKOFF_SECONDS

	while True:
		consumer = AIOKafkaConsumer(
			TOPIC,
			bootstrap_servers=BOOTSTRAP_SERVERS,
			group_id=GROUP_ID,
			enable_auto_commit=False,
			auto_offset_reset="earliest",
		)

		try:
			await consumer.start()
			_set_metric_text(METRIC_KAFKA_CONSUMER_STATUS, "connected")
			kafka_backoff = KAFKA_BASE_BACKOFF_SECONDS
			LOGGER.info(
				"Kafka consumer connected to %s and subscribed to topic %s",
				BOOTSTRAP_SERVERS,
				TOPIC,
			)

			async for message in consumer:
				try:
					raw_value = json.loads(message.value.decode("utf-8"))
					event = _validate_event(raw_value)
				except (json.JSONDecodeError, ValidationError) as exc:
					LOGGER.warning("Malformed event skipped at offset %s: %s", message.offset, exc)
					_increment_metric(METRIC_INGESTION_FAILURES)
					await consumer.commit()
					continue

				succeeded = await _process_message(event, embedder)
				if succeeded:
					_increment_metric(METRIC_EVENTS_PROCESSED)
				else:
					_increment_metric(METRIC_INGESTION_FAILURES)
				await consumer.commit()

		except KafkaError as exc:
			_set_metric_text(METRIC_KAFKA_CONSUMER_STATUS, "disconnected")
			LOGGER.exception(
				"Kafka connection failure: %s. Reconnecting in %ss",
				exc,
				kafka_backoff,
			)
			await asyncio.sleep(kafka_backoff)
			kafka_backoff = min(kafka_backoff * 2, KAFKA_MAX_BACKOFF_SECONDS)
		except Exception as exc:
			_set_metric_text(METRIC_KAFKA_CONSUMER_STATUS, "disconnected")
			LOGGER.exception(
				"Unexpected consumer failure: %s. Reconnecting in %ss",
				exc,
				kafka_backoff,
			)
			await asyncio.sleep(kafka_backoff)
			kafka_backoff = min(kafka_backoff * 2, KAFKA_MAX_BACKOFF_SECONDS)
		finally:
			_set_metric_text(METRIC_KAFKA_CONSUMER_STATUS, "disconnected")
			await consumer.stop()


if __name__ == "__main__":
	asyncio.run(consume_forever())
