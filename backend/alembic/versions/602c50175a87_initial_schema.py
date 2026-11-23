"""initial_schema

Revision ID: 602c50175a87
Revises: 
Create Date: 2026-09-27 22:03:41.722286

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = '602c50175a87'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    op.create_table(
        "raw_events",
        sa.Column("event_id", sa.Text(), nullable=False),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("entity_id", sa.Text(), nullable=False),
        sa.Column("event_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "ingested_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("event_id"),
    )

    op.create_table(
        "knowledge_versions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("entity_id", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("valid_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("event_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_event_id", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("embedding", Vector(384), nullable=True),
        sa.ForeignKeyConstraint(["source_event_id"], ["raw_events.event_id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_knowledge_versions_entity_id_valid_from",
        "knowledge_versions",
        ["entity_id", "valid_from"],
        unique=False,
    )
    op.create_index(
        "ix_knowledge_versions_entity_id_valid_to",
        "knowledge_versions",
        ["entity_id", "valid_to"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_knowledge_versions_entity_id_valid_to", table_name="knowledge_versions")
    op.drop_index("ix_knowledge_versions_entity_id_valid_from", table_name="knowledge_versions")
    op.drop_table("knowledge_versions")
    op.drop_table("raw_events")
    op.drop_table("users")
    op.execute("DROP EXTENSION IF EXISTS vector")
