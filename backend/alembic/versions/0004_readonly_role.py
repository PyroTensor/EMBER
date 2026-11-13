"""read-only role ember_ro (SELECT only; GET endpoints + RAG sql_tool)

The password 'ember_ro' is for local dev only. In prod, create the role beforehand (the DO block skips an
existing role) or run ``ALTER ROLE ember_ro PASSWORD ...``; settings reject the placeholder in prod.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-12
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ROLE = "ember_ro"


def upgrade() -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '{ROLE}') THEN
                CREATE ROLE {ROLE} LOGIN PASSWORD '{ROLE}';
            END IF;
            EXECUTE format('GRANT CONNECT ON DATABASE %I TO {ROLE}', current_database());
        END
        $$;
        """
    )
    op.execute(f"GRANT USAGE ON SCHEMA public TO {ROLE}")
    op.execute(f"GRANT SELECT ON ALL TABLES IN SCHEMA public TO {ROLE}")
    op.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO {ROLE}")


def downgrade() -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '{ROLE}') THEN
                ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM {ROLE};
                REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM {ROLE};
                REVOKE USAGE ON SCHEMA public FROM {ROLE};
                EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM {ROLE}', current_database());
                DROP ROLE {ROLE};
            END IF;
        END
        $$;
        """
    )
