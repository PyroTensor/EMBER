"""core tables: investigations, documents, test_runs, telemetry, presets

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "investigations",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("program", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("source_doc_id", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_investigations"),
    )

    op.create_table(
        "documents",
        sa.Column("doc_id", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("source_type", sa.Text(), nullable=False),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("checksum", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("doc_id", name="pk_documents"),
    )

    op.create_table(
        "test_runs",
        sa.Column("experiment_id", sa.Text(), nullable=False),
        sa.Column("investigation_id", sa.Text(), nullable=True),
        sa.Column("program", sa.Text(), nullable=False),
        sa.Column("fuel_material", sa.Text(), nullable=False),
        sa.Column("fuel_geometry", sa.Text(), nullable=False),
        sa.Column("gravity_g", sa.Float(), nullable=False),
        sa.Column("oxygen_pct", sa.Float(), nullable=False),
        sa.Column("pressure_kpa", sa.Float(), nullable=False),
        sa.Column("flow_velocity_cm_s", sa.Float(), nullable=False),
        sa.Column("diluent_gas", sa.Text(), nullable=False),
        sa.Column("combustion_regime", sa.Text(), nullable=False),
        sa.Column("spread_or_burn_rate", sa.Float(), nullable=True),
        sa.Column("peak_radiative_flux_kw_m2", sa.Float(), nullable=True),
        sa.Column("limiting_oxygen_index_pct", sa.Float(), nullable=True),
        sa.Column("burn_duration_s", sa.Float(), nullable=True),
        sa.Column("source_doc_id", sa.Text(), nullable=True),
        sa.Column("source_page", sa.Integer(), nullable=True),
        sa.Column(
            "extra_telemetry",
            postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "review_flags",
            postgresql.ARRAY(sa.Text()),
            server_default=sa.text("'{}'::text[]"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("experiment_id", name="pk_test_runs"),
        sa.ForeignKeyConstraint(
            ["investigation_id"],
            ["investigations.id"],
            name="fk_test_runs_investigation_id_investigations",
        ),
    )
    op.create_index("ix_test_runs_program", "test_runs", ["program"])
    op.create_index("ix_test_runs_fuel_material", "test_runs", ["fuel_material"])
    op.create_index("ix_test_runs_combustion_regime", "test_runs", ["combustion_regime"])
    op.create_index("ix_test_runs_extra_telemetry", "test_runs", ["extra_telemetry"], postgresql_using="gin")

    op.create_table(
        "telemetry",
        sa.Column("experiment_id", sa.Text(), nullable=False),
        sa.Column("series", postgresql.JSONB(), nullable=False),
        sa.PrimaryKeyConstraint("experiment_id", name="pk_telemetry"),
        sa.ForeignKeyConstraint(
            ["experiment_id"],
            ["test_runs.experiment_id"],
            name="fk_telemetry_experiment_id_test_runs",
            ondelete="CASCADE",
        ),
    )

    op.create_table(
        "presets",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("oxygen_pct", sa.Float(), nullable=False),
        sa.Column("pressure_kpa", sa.Float(), nullable=False),
        sa.Column("flow_velocity_cm_s", sa.Float(), nullable=False),
        sa.Column("gravity_g", sa.Float(), nullable=False),
        sa.Column("fuel_material", sa.Text(), nullable=False),
        sa.Column("diluent_gas", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_presets"),
    )


def downgrade() -> None:
    op.drop_table("presets")
    op.drop_table("telemetry")
    op.drop_index("ix_test_runs_extra_telemetry", table_name="test_runs")
    op.drop_index("ix_test_runs_combustion_regime", table_name="test_runs")
    op.drop_index("ix_test_runs_fuel_material", table_name="test_runs")
    op.drop_index("ix_test_runs_program", table_name="test_runs")
    op.drop_table("test_runs")
    op.drop_table("documents")
    op.drop_table("investigations")
