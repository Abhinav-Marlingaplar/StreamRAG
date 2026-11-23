import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError


BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret")

from app.main import app
from app.dependencies import require_auth
from app.rag.pipeline import QueryDatabaseUnavailableError
from app.routers import auth as auth_router
from app.routers import events as events_router
from app.routers import query as query_router
from app.routers import status as status_router
from app.routers import timeline as timeline_router


class BrokenSession:
	def scalar(self, *_args, **_kwargs):
		raise SQLAlchemyError("db unavailable")

	def scalars(self, *_args, **_kwargs):
		raise SQLAlchemyError("db unavailable")

	def execute(self, *_args, **_kwargs):
		raise SQLAlchemyError("db unavailable")

	def rollback(self):
		return None

	def close(self):
		return None


def _broken_session_factory():
	return BrokenSession()


class _FakeScalarResult:
	def __init__(self, rows):
		self._rows = rows

	def all(self):
		return self._rows


class _EventsSession:
	def __init__(self):
		self._calls = 0

	def scalars(self, *_args, **_kwargs):
		self._calls += 1
		if self._calls == 1:
			return _FakeScalarResult(
				[
					SimpleNamespace(
						event_id="evt-1",
						event_type="incident_created",
						entity_id="INC-1000",
						source="simulator",
						ingested_at=datetime(2026, 9, 26, 10, 0, tzinfo=timezone.utc),
					),
					SimpleNamespace(
						event_id="evt-2",
						event_type="incident_updated",
						entity_id="INC-1000",
						source="simulator",
						ingested_at=datetime(2026, 9, 26, 11, 0, tzinfo=timezone.utc),
					),
				]
			)

		return _FakeScalarResult(
			[
				SimpleNamespace(
					id=8,
					entity_id="INC-1000",
					source_event_id="evt-3",
					version=3,
					status="resolved",
					created_at=datetime(2026, 9, 26, 12, 0, tzinfo=timezone.utc),
				),
			]
		)

	def close(self):
		return None


def _events_session_factory():
	return _EventsSession()


def test_auth_register_returns_503_when_database_is_unavailable(monkeypatch):
	monkeypatch.setattr(auth_router, "SessionLocal", _broken_session_factory)
	client = TestClient(app)

	response = client.post("/auth/register", json={"email": "user@example.com", "password": "secret"})

	assert response.status_code == 503
	assert "Database unavailable during registration" in response.json()["detail"]


def test_events_recent_returns_503_when_database_is_unavailable(monkeypatch):
	monkeypatch.setattr(events_router, "SessionLocal", _broken_session_factory)
	app.dependency_overrides[require_auth] = lambda: "demo@example.com"
	client = TestClient(app)

	try:
		response = client.get("/api/events/recent")
	finally:
		app.dependency_overrides.clear()

	assert response.status_code == 503
	assert "Database unavailable while reading recent events" in response.json()["detail"]


def test_timeline_returns_503_when_database_is_unavailable(monkeypatch):
	monkeypatch.setattr(timeline_router, "SessionLocal", _broken_session_factory)
	app.dependency_overrides[require_auth] = lambda: "demo@example.com"
	client = TestClient(app)

	try:
		response = client.get("/api/timeline/INC-1234")
	finally:
		app.dependency_overrides.clear()

	assert response.status_code == 503
	assert "Database unavailable while reading timeline" in response.json()["detail"]


def test_status_returns_503_when_database_is_unavailable(monkeypatch):
	monkeypatch.setattr(status_router, "SessionLocal", _broken_session_factory)
	app.dependency_overrides[require_auth] = lambda: "demo@example.com"
	client = TestClient(app)

	try:
		response = client.get("/api/status")
	finally:
		app.dependency_overrides.clear()

	assert response.status_code == 503
	assert "Database unavailable while reading status" in response.json()["detail"]


def test_query_requires_bearer_token():
	client = TestClient(app)

	response = client.post("/api/query", json={"query": "What is status of INC-1024?"})

	assert response.status_code == 401
	assert response.json()["detail"] == "Missing authorization header"


def test_query_returns_503_when_run_query_hits_database_error(monkeypatch):
	def _raise_db_unavailable(*_args, **_kwargs):
		raise QueryDatabaseUnavailableError("Database unavailable during query execution")

	monkeypatch.setattr(query_router, "run_query", _raise_db_unavailable)
	app.dependency_overrides[require_auth] = lambda: "demo@example.com"
	client = TestClient(app)

	try:
		response = client.post(
			"/api/query",
			json={"query": "What is status of INC-1024?"},
		)
	finally:
		app.dependency_overrides.clear()

	assert response.status_code == 503
	assert "Database unavailable during query" in response.json()["detail"]


def test_query_returns_expected_response_shape(monkeypatch):
	def _ok_query(*_args, **_kwargs):
		return {
			"answer": "INC-1024 is resolved.",
			"citations": [
				{
					"knowledge_version_id": 11,
					"content": "INC-1024 status is resolved.",
					"valid_from": datetime(2026, 9, 26, 11, 0, tzinfo=timezone.utc),
					"valid_to": None,
				}
			],
			"query_time_used": datetime(2026, 9, 26, 11, 30, tzinfo=timezone.utc),
			"retrieval_latency_ms": 8.2,
			"llm_latency_ms": 18.4,
		}

	monkeypatch.setattr(query_router, "run_query", _ok_query)
	app.dependency_overrides[require_auth] = lambda: "demo@example.com"
	client = TestClient(app)

	try:
		response = client.post("/api/query", json={"query": "status of INC-1024"})
	finally:
		app.dependency_overrides.clear()

	assert response.status_code == 200
	body = response.json()
	assert body["answer"] == "INC-1024 is resolved."
	assert isinstance(body["citations"], list)
	assert body["citations"][0]["knowledge_version_id"] == 11
	assert "query_time_used" in body


def test_events_recent_returns_combined_feed_sorted_desc(monkeypatch):
	monkeypatch.setattr(events_router, "SessionLocal", _events_session_factory)
	app.dependency_overrides[require_auth] = lambda: "demo@example.com"
	client = TestClient(app)

	try:
		response = client.get("/api/events/recent?limit=2")
	finally:
		app.dependency_overrides.clear()

	assert response.status_code == 200
	items = response.json()
	assert len(items) == 2
	assert items[0]["timestamp"] >= items[1]["timestamp"]
	assert items[0]["kind"] == "knowledge_version"
