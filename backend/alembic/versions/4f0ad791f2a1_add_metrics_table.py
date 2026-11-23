"""add_metrics_table

Revision ID: 4f0ad791f2a1
Revises: 602c50175a87
Create Date: 2026-10-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4f0ad791f2a1"
down_revision: Union[str, Sequence[str], None] = "602c50175a87"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "metrics",
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("int_value", sa.BigInteger(), nullable=True),
        sa.Column("text_value", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("key"),
    )

    op.execute(
        """
        INSERT INTO metrics (key, int_value, text_value)
        VALUES
            ('events_processed', 0, NULL),
            ('ingestion_failures', 0, NULL),
            ('kafka_consumer_status', NULL, 'disconnected')
        ON CONFLICT (key) DO NOTHING
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("metrics")
