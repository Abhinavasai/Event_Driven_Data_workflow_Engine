"""create api_keys table

Revision ID: 001_create_api_keys
Revises:
Create Date: 2026-10-08

"""

from typing import Sequence, Union

from alembic import op

revision: str = "001_create_api_keys"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS api_keys (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            key_hash VARCHAR(128) NOT NULL UNIQUE,
            name VARCHAR(100) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'viewer',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_used_at TIMESTAMPTZ
        );
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys (key_hash);
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_api_keys_is_active
        ON api_keys (is_active) WHERE is_active = TRUE;
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS api_keys;")
