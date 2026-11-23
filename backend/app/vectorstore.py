from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import KnowledgeVersion


VECTOR_SIZE = 384


def _validate_embedding(embedding: list[float]) -> None:
    if len(embedding) != VECTOR_SIZE:
        raise ValueError(f"Expected embedding length {VECTOR_SIZE}, got {len(embedding)}")


def upsert_embedding(
    session: Session,
    knowledge_version_id: int,
    embedding: list[float],
) -> None:
    _validate_embedding(embedding)

    row = session.get(KnowledgeVersion, knowledge_version_id)
    if row is None:
        raise ValueError(f"knowledge_versions row {knowledge_version_id} not found")

    row.embedding = embedding


def similarity_search(
    session: Session,
    query_embedding: list[float],
    entity_id: str | None = None,
    limit: int = 10,
) -> list[KnowledgeVersion]:
    _validate_embedding(query_embedding)

    stmt = select(KnowledgeVersion).where(KnowledgeVersion.embedding.is_not(None))

    if entity_id is not None:
        stmt = stmt.where(KnowledgeVersion.entity_id == entity_id)

    stmt = stmt.order_by(KnowledgeVersion.embedding.cosine_distance(query_embedding)).limit(limit)
    return list(session.scalars(stmt))
