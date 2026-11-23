from __future__ import annotations

from datetime import datetime
from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..dependencies import require_auth
from ..rag.pipeline import QueryDatabaseUnavailableError, run_query
from .status import record_llm_latency, record_query_latency, record_retrieval_latency


router = APIRouter(prefix="/api", tags=["query"])


class QueryRequest(BaseModel):
	query: str
	as_of: datetime | None = None


class CitationResponse(BaseModel):
	knowledge_version_id: int
	content: str
	valid_from: datetime
	valid_to: datetime | None
	event_time: datetime | None = None
	semantic_similarity: float | None = None
	recency_score: float | None = None
	tar_score: float | None = None
	delta_minutes: float | None = None


class RetrievalDiagnosticsResponse(BaseModel):
	query_classification: str
	st: float
	sr: float
	sc: float
	selected_tier: str
	selected_k: int
	selected_alpha: float
	lambda_per_minute: float
	gamma: float
	preliminary_k: int
	candidate_count: int
	causal_candidate_count: int


class QueryResponse(BaseModel):
	answer: str
	citations: list[CitationResponse]
	query_time_used: datetime
	retrieval_diagnostics: RetrievalDiagnosticsResponse | None = None


@router.post("/query", response_model=QueryResponse)
def query(payload: QueryRequest, _: str = Depends(require_auth)) -> QueryResponse:
	started_at = perf_counter()
	try:
		result = run_query(query=payload.query, as_of=payload.as_of)
	except QueryDatabaseUnavailableError:
		raise HTTPException(
			status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
			detail="Database unavailable during query. Please retry shortly.",
		)

	record_retrieval_latency(float(result["retrieval_latency_ms"]))
	record_llm_latency(float(result["llm_latency_ms"]))
	record_query_latency((perf_counter() - started_at) * 1000)

	return QueryResponse(
		answer=str(result["answer"]),
		citations=[CitationResponse(**citation) for citation in result["citations"]],
		query_time_used=result["query_time_used"],
		retrieval_diagnostics=(
			RetrievalDiagnosticsResponse(**result["retrieval_diagnostics"])
			if result.get("retrieval_diagnostics")
			else None
		),
	)
