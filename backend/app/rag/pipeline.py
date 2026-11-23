from __future__ import annotations

import math
import os
import re
import time
from datetime import datetime, timezone
from typing import Any

from sentence_transformers import SentenceTransformer
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..llm import LLMGenerationError, generate
from ..models import KnowledgeVersion
from ..vectorstore import similarity_search


_EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
_EMBEDDER: SentenceTransformer | None = None
_TIME_REFERENCE_RE = re.compile(
	r"\b(?:at|as\s+of)\s+(?P<hour>\d{1,2}):(?P<minute>\d{2})"
	r"(?:\s*(?P<ampm>AM|PM))?"
	r"(?:\s*(?:on\s+)?(?P<month>[A-Za-z]{3,9})\s+(?P<day>\d{1,2}))?",
	flags=re.IGNORECASE,
)
_MONTH_LOOKUP = {
	"jan": 1,
	"january": 1,
	"feb": 2,
	"february": 2,
	"mar": 3,
	"march": 3,
	"apr": 4,
	"april": 4,
	"may": 5,
	"jun": 6,
	"june": 6,
	"jul": 7,
	"july": 7,
	"aug": 8,
	"august": 8,
	"sep": 9,
	"sept": 9,
	"september": 9,
	"oct": 10,
	"october": 10,
	"nov": 11,
	"november": 11,
	"dec": 12,
	"december": 12,
}
_URGENCY_KEYWORDS = (
	"urgent",
	"asap",
	"immediately",
	"right now",
	"current",
	"latest",
	"now",
	"active",
	"ongoing",
	"live",
)
_HISTORICAL_KEYWORDS = (
	"as of",
	"at",
	"before",
	"earlier",
	"historical",
	"previous",
	"timeline",
	"yesterday",
	"last",
)


class QueryDatabaseUnavailableError(RuntimeError):
	pass


def _get_embedder() -> SentenceTransformer:
	global _EMBEDDER
	if _EMBEDDER is None:
		_EMBEDDER = SentenceTransformer(_EMBEDDING_MODEL_NAME)
	return _EMBEDDER


def _to_utc(value: datetime) -> datetime:
	if value.tzinfo is None:
		return value.replace(tzinfo=timezone.utc)
	return value.astimezone(timezone.utc)


def _extract_entity_id(query: str) -> str | None:
	match = re.search(r"\bINC-\d+\b", query, flags=re.IGNORECASE)
	if not match:
		return None
	return match.group(0).upper()


def _parse_hour_minute(hour_raw: str, minute_raw: str, ampm_raw: str | None) -> tuple[int, int] | None:
	hour = int(hour_raw)
	minute = int(minute_raw)

	if minute > 59:
		return None

	if ampm_raw:
		ampm = ampm_raw.upper()
		if hour < 1 or hour > 12:
			return None
		if ampm == "AM":
			hour = 0 if hour == 12 else hour
		else:
			hour = 12 if hour == 12 else hour + 12
	else:
		if hour > 23:
			return None

	return hour, minute


def _resolve_time_only_for_entity(
	session: Session,
	entity_id: str | None,
	hour: int,
	minute: int,
) -> datetime | None:
	if entity_id is None:
		return None

	matched_valid_from = session.scalar(
		select(KnowledgeVersion.valid_from)
		.where(KnowledgeVersion.entity_id == entity_id)
		.where(func.extract("hour", KnowledgeVersion.valid_from) == hour)
		.where(func.extract("minute", KnowledgeVersion.valid_from) == minute)
		.order_by(KnowledgeVersion.valid_from.desc())
	)
	if matched_valid_from is None:
		return None
	return _to_utc(matched_valid_from).replace(second=0, microsecond=0)


def _detect_time_from_query(
	query: str,
	base_time: datetime,
	entity_id: str | None,
	session: Session,
) -> datetime | None:
	match = _TIME_REFERENCE_RE.search(query)
	if not match:
		return None

	parsed_time = _parse_hour_minute(
		match.group("hour"),
		match.group("minute"),
		match.group("ampm"),
	)
	if parsed_time is None:
		return None
	hour, minute = parsed_time

	month_token = match.group("month")
	day_token = match.group("day")
	if month_token and day_token:
		month_number = _MONTH_LOOKUP.get(month_token.lower())
		if month_number is None:
			return None
		try:
			return datetime(
				year=base_time.year,
				month=month_number,
				day=int(day_token),
				hour=hour,
				minute=minute,
				tzinfo=timezone.utc,
			)
		except ValueError:
			return None

	entity_time = _resolve_time_only_for_entity(session, entity_id, hour, minute)
	if entity_time is not None:
		return entity_time

	return base_time.replace(hour=hour, minute=minute, second=0, microsecond=0)


def _resolve_query_time(
	query: str,
	as_of: datetime | None,
	base_time: datetime,
	entity_id: str | None,
	session: Session,
) -> datetime:
	if as_of is not None:
		return _to_utc(as_of)

	parsed_time = _detect_time_from_query(
		query=query,
		base_time=base_time,
		entity_id=entity_id,
		session=session,
	)
	if parsed_time is not None:
		return parsed_time

	return base_time


def _load_tar_config() -> dict[str, float | int]:
	return {
		"lambda_per_minute": float(os.getenv("TAR_LAMBDA_PER_MINUTE", "0.02")),
		"gamma": float(os.getenv("TAR_GAMMA", "0.5")),
		"prelim_k": int(os.getenv("TAR_PRELIM_K", "5")),
		"high_threshold": float(os.getenv("TAR_HIGH_THRESHOLD", "0.65")),
		"low_threshold": float(os.getenv("TAR_LOW_THRESHOLD", "0.35")),
		"tier_high_k": int(os.getenv("TAR_TIER_HIGH_K", "1")),
		"tier_mid_k": int(os.getenv("TAR_TIER_MID_K", "3")),
		"tier_low_k": int(os.getenv("TAR_TIER_LOW_K", "5")),
		"tier_high_alpha": float(os.getenv("TAR_TIER_HIGH_ALPHA", "0.455")),
		"tier_mid_alpha": float(os.getenv("TAR_TIER_MID_ALPHA", "0.65")),
		"tier_low_alpha": float(os.getenv("TAR_TIER_LOW_ALPHA", "0.91")),
	}


def _vector_to_float_list(vector: Any) -> list[float]:
	if vector is None:
		return []
	if hasattr(vector, "tolist"):
		vector = vector.tolist()
	return [float(value) for value in vector]


def _cosine_similarity(query_embedding: list[float], candidate_embedding: list[float]) -> float:
	if not candidate_embedding or len(query_embedding) != len(candidate_embedding):
		return 0.0

	dot_product = 0.0
	query_norm_sq = 0.0
	candidate_norm_sq = 0.0
	for query_value, candidate_value in zip(query_embedding, candidate_embedding):
		dot_product += query_value * candidate_value
		query_norm_sq += query_value * query_value
		candidate_norm_sq += candidate_value * candidate_value

	if query_norm_sq == 0 or candidate_norm_sq == 0:
		return 0.0
	return dot_product / (math.sqrt(query_norm_sq) * math.sqrt(candidate_norm_sq))


def _normalize_similarity(similarity: float) -> float:
	return max(0.0, min(1.0, similarity))


def _minutes_delta(query_time: datetime, event_time: datetime) -> float:
	event_utc = _to_utc(event_time)
	query_utc = _to_utc(query_time)
	delta_seconds = (query_utc - event_utc).total_seconds()
	if delta_seconds < 0:
		return 0.0
	return delta_seconds / 60.0


def _query_instantaneity(query: str) -> tuple[float, str]:
	query_lc = query.lower()
	urgency_hits = sum(1 for keyword in _URGENCY_KEYWORDS if keyword in query_lc)
	historical_hits = sum(1 for keyword in _HISTORICAL_KEYWORDS if keyword in query_lc)

	if urgency_hits == 0 and historical_hits == 0:
		return 0.5, "neutral"

	urgency_score = min(1.0, urgency_hits / 2.0)
	historical_score = min(1.0, historical_hits / 2.0)
	st = max(0.0, min(1.0, 0.5 + 0.5 * (urgency_score - historical_score)))

	if st >= 0.67:
		return st, "urgent"
	if st <= 0.33:
		return st, "historical"
	return st, "mixed"


def _select_tier(sc: float, config: dict[str, float | int]) -> tuple[str, int, float]:
	high_threshold = float(config["high_threshold"])
	low_threshold = float(config["low_threshold"])

	if sc > high_threshold:
		return "high", int(config["tier_high_k"]), float(config["tier_high_alpha"])
	if sc < low_threshold:
		return "low", int(config["tier_low_k"]), float(config["tier_low_alpha"])
	return "mid", int(config["tier_mid_k"]), float(config["tier_mid_alpha"])


def _build_prompt(query: str, query_time: datetime, evidence: list[KnowledgeVersion]) -> str:
	evidence_lines = []
	for row in evidence:
		valid_to = row.valid_to.isoformat().replace("+00:00", "Z") if row.valid_to else "null"
		evidence_lines.append(
			f"- knowledge_version_id={row.id} entity_id={row.entity_id} "
			f"status={row.status} valid_from={row.valid_from.isoformat().replace('+00:00', 'Z')} "
			f"valid_to={valid_to} content={row.content}"
		)

	evidence_block = "\n".join(evidence_lines) if evidence_lines else "- (no evidence found)"
	query_time_text = query_time.isoformat().replace("+00:00", "Z")

	return (
		"You are answering operational incident questions.\n"
		"Use only the provided evidence.\n"
		"Do not infer temporal state beyond evidence validity windows.\n"
		f"Query time: {query_time_text}\n"
		f"User query: {query}\n"
		"Evidence:\n"
		f"{evidence_block}\n"
		"Return one concise sentence."
	)


def run_query(query: str, as_of: datetime | None = None) -> dict[str, Any]:
	start_retrieval = time.perf_counter()
	config = _load_tar_config()

	now_utc = datetime.now(timezone.utc)
	entity_id = _extract_entity_id(query)

	embedder = _get_embedder()
	query_embedding_raw = embedder.encode(query)
	if hasattr(query_embedding_raw, "tolist"):
		query_embedding_raw = query_embedding_raw.tolist()
	query_embedding = [float(value) for value in query_embedding_raw]

	session = SessionLocal()
	try:
		query_time = _resolve_query_time(
			query=query,
			as_of=as_of,
			base_time=now_utc,
			entity_id=entity_id,
			session=session,
		)

		max_k = max(
			int(config["prelim_k"]),
			int(config["tier_high_k"]),
			int(config["tier_mid_k"]),
			int(config["tier_low_k"]),
			10,
		)
		candidates = similarity_search(
			session=session,
			query_embedding=query_embedding,
			entity_id=entity_id,
			limit=max_k,
		)

		causal_candidates = [
			candidate for candidate in candidates if _to_utc(candidate.event_time) <= _to_utc(query_time)
		]

		scored_candidates: list[dict[str, Any]] = []
		for row in causal_candidates:
			semantic_similarity_raw = _cosine_similarity(query_embedding, _vector_to_float_list(row.embedding))
			semantic_similarity = _normalize_similarity(semantic_similarity_raw)
			delta_minutes = _minutes_delta(query_time, row.event_time)
			recency_score = math.exp(-float(config["lambda_per_minute"]) * delta_minutes)
			scored_candidates.append(
				{
					"row": row,
					"semantic_similarity": semantic_similarity,
					"delta_minutes": delta_minutes,
					"recency_score": recency_score,
				}
			)
	except SQLAlchemyError as exc:
		raise QueryDatabaseUnavailableError("Database unavailable during query execution") from exc
	finally:
		session.close()

	scored_candidates.sort(key=lambda entry: entry["semantic_similarity"], reverse=True)
	prelim_k = int(config["prelim_k"])
	preliminary_top = scored_candidates[:prelim_k]
	sr = (
		sum(entry["semantic_similarity"] for entry in preliminary_top) / len(preliminary_top)
		if preliminary_top
		else 0.0
	)
	st, query_classification = _query_instantaneity(query)
	sc = float(config["gamma"]) * st + (1.0 - float(config["gamma"])) * (1.0 - sr)
	selected_tier, selected_k, selected_alpha = _select_tier(sc, config)

	for entry in scored_candidates:
		entry["tar_score"] = selected_alpha * entry["semantic_similarity"] + (1.0 - selected_alpha) * entry["recency_score"]

	scored_candidates.sort(key=lambda entry: entry["tar_score"], reverse=True)
	top_scored = scored_candidates[:selected_k]
	top_evidence = [entry["row"] for entry in top_scored]
	retrieval_latency_ms = (time.perf_counter() - start_retrieval) * 1000

	start_llm = time.perf_counter()
	prompt = _build_prompt(query=query, query_time=query_time, evidence=top_evidence)
	try:
		answer = generate(prompt)
	except LLMGenerationError as exc:
		answer = f"Generation unavailable: {exc}. Showing evidence-based citations only."
	llm_latency_ms = (time.perf_counter() - start_llm) * 1000

	citations = [
		{
			"knowledge_version_id": entry["row"].id,
			"content": entry["row"].content,
			"valid_from": entry["row"].valid_from,
			"valid_to": entry["row"].valid_to,
			"event_time": entry["row"].event_time,
			"semantic_similarity": round(float(entry["semantic_similarity"]), 4),
			"recency_score": round(float(entry["recency_score"]), 4),
			"tar_score": round(float(entry["tar_score"]), 4),
			"delta_minutes": round(float(entry["delta_minutes"]), 2),
		}
		for entry in top_scored
	]

	return {
		"answer": answer,
		"citations": citations,
		"query_time_used": query_time,
		"retrieval_diagnostics": {
			"query_classification": query_classification,
			"st": round(st, 4),
			"sr": round(sr, 4),
			"sc": round(sc, 4),
			"selected_tier": selected_tier,
			"selected_k": selected_k,
			"selected_alpha": round(selected_alpha, 4),
			"lambda_per_minute": round(float(config["lambda_per_minute"]), 4),
			"gamma": round(float(config["gamma"]), 4),
			"preliminary_k": prelim_k,
			"candidate_count": len(candidates),
			"causal_candidate_count": len(causal_candidates),
		},
		"retrieval_latency_ms": round(retrieval_latency_ms, 2),
		"llm_latency_ms": round(llm_latency_ms, 2),
	}
