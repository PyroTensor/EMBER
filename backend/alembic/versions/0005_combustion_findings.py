"""combustion_findings: microgravity-combustion data that fits no other table (I10)

The read-only role ``ember_ro`` gets SELECT through the default privileges set in 0004
(``ALTER DEFAULT PRIVILEGES ... GRANT SELECT ON TABLES``), so no extra GRANT here.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-14
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "combustion_findings",
        sa.Column("finding_id", sa.Text(), nullable=False),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("gravity_context", sa.Text(), nullable=False),
        sa.Column("statement", sa.Text(), nullable=False),
        sa.Column("subject", sa.Text(), nullable=True),
        sa.Column("program", sa.Text(), nullable=True),
        sa.Column("investigation_id", sa.Text(), nullable=True),
        sa.Column("quantity", sa.Text(), nullable=True),
        sa.Column("value_num", sa.Float(), nullable=True),
        sa.Column("value_text", sa.Text(), nullable=True),
        sa.Column("unit", sa.Text(), nullable=True),
        sa.Column("conditions", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("origin", sa.Text(), nullable=False),
        sa.Column("source_doc_id", sa.Text(), nullable=True),
        sa.Column("source_page", sa.Integer(), nullable=True),
        sa.Column("source_file", sa.Text(), nullable=True),
        sa.Column("source_row", sa.Integer(), nullable=True),
        sa.Column("evidence_quote", sa.Text(), nullable=True),
        sa.Column("quote_found", sa.Boolean(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("relevance", sa.Float(), nullable=False),
        sa.Column("extraction", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("review_flags", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.PrimaryKeyConstraint("finding_id", name="pk_combustion_findings"),
        sa.ForeignKeyConstraint(
            ["investigation_id"],
            ["investigations.id"],
            name="fk_combustion_findings_investigation_id_investigations",
        ),
        sa.ForeignKeyConstraint(
            ["source_doc_id"],
            ["documents.doc_id"],
            name="fk_combustion_findings_source_doc_id_documents",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "(source_doc_id IS NOT NULL AND source_page IS NOT NULL) "
            "OR (source_file IS NOT NULL AND source_row IS NOT NULL)",
            name="ck_combustion_findings_provenance",
        ),
    )
    op.create_index("ix_combustion_findings_category", "combustion_findings", ["category"])
    op.create_index("ix_combustion_findings_source_doc_id", "combustion_findings", ["source_doc_id"])
    op.create_index(
        "ix_combustion_findings_conditions", "combustion_findings", ["conditions"], postgresql_using="gin"
    )


def downgrade() -> None:
    op.drop_index("ix_combustion_findings_conditions", table_name="combustion_findings")
    op.drop_index("ix_combustion_findings_source_doc_id", table_name="combustion_findings")
    op.drop_index("ix_combustion_findings_category", table_name="combustion_findings")
    op.drop_table("combustion_findings")
