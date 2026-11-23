from __future__ import annotations

from collections import deque

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError

from ..dependencies import require_auth
from ..db import SessionLocal
from ..models import KnowledgeVersion


router = APIRouter(prefix="/api", tags=["status"])

METRIC_EVENTS_PROCESSED = "events_processed"
METRIC_INGESTION_FAILURES = "ingestion_failures"
METRIC_KAFKA_CONSUMER_STATUS = "kafka_consumer_status"

_query_latency_ms: deque[float] = deque(maxlen=200)
_retrieval_latency_ms: deque[float] = deque(maxlen=200)
_llm_latency_ms: deque[float] = deque(maxlen=200)


def set_kafka_consumer_status(value: str) -> None:
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
			{"key": METRIC_KAFKA_CONSUMER_STATUS, "text_value": value},
		)
		session.commit()
	except SQLAlchemyError:
		session.rollback()
	finally:
		session.close()


def increment_events_processed(count: int = 1) -> None:
	_increment_counter(METRIC_EVENTS_PROCESSED, count)


def increment_ingestion_failures(count: int = 1) -> None:
	_increment_counter(METRIC_INGESTION_FAILURES, count)


def _increment_counter(metric_key: str, count: int) -> None:
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


def _read_metric_int(metric_key: str, default: int = 0) -> int:
	session = SessionLocal()
	try:
		value = session.scalar(
			text("SELECT int_value FROM metrics WHERE key = :key"),
			{"key": metric_key},
		)
		if value is None:
			return default
		return int(value)
	except SQLAlchemyError:
		raise
	finally:
		session.close()


def _read_metric_text(metric_key: str, default: str) -> str:
	session = SessionLocal()
	try:
		value = session.scalar(
			text("SELECT text_value FROM metrics WHERE key = :key"),
			{"key": metric_key},
		)
		if value is None:
			return default
		return str(value)
	except SQLAlchemyError:
		raise
	finally:
		session.close()


def record_query_latency(milliseconds: float) -> None:
	_query_latency_ms.append(milliseconds)


def record_retrieval_latency(milliseconds: float) -> None:
	_retrieval_latency_ms.append(milliseconds)


def record_llm_latency(milliseconds: float) -> None:
	_llm_latency_ms.append(milliseconds)


def _avg(values: deque[float]) -> float | None:
	if not values:
		return None
	return round(sum(values) / len(values), 2)


class StatusResponse(BaseModel):
	kafka_consumer_status: str
	events_processed: int
	indexed_versions_count: int
	avg_query_latency_ms: float | None
	ingestion_failures: int
	avg_retrieval_latency_ms: float | None
	avg_llm_latency_ms: float | None


@router.get("/status", response_model=StatusResponse)
def get_status(_: str = Depends(require_auth)) -> StatusResponse:
	session = SessionLocal()
	try:
		indexed_versions_count = session.scalar(select(func.count(KnowledgeVersion.id))) or 0
		return StatusResponse(
			kafka_consumer_status=_read_metric_text(METRIC_KAFKA_CONSUMER_STATUS, "disconnected"),
			events_processed=_read_metric_int(METRIC_EVENTS_PROCESSED, 0),
			indexed_versions_count=int(indexed_versions_count),
			avg_query_latency_ms=_avg(_query_latency_ms),
			ingestion_failures=_read_metric_int(METRIC_INGESTION_FAILURES, 0),
			avg_retrieval_latency_ms=_avg(_retrieval_latency_ms),
			avg_llm_latency_ms=_avg(_llm_latency_ms),
		)
	except SQLAlchemyError:
		raise HTTPException(
			status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
			detail="Database unavailable while reading status. Please retry shortly.",
		)
	finally:
		session.close()
