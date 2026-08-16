"""add sale_item unit_cost

Revision ID: 0289ec3eed65
Revises: fcd907cd2a8f
Create Date: 2026-08-17 01:23:53.372309

"""
import warnings
from typing import TYPE_CHECKING

import sqlalchemy as sa
from alembic import op
from advanced_alchemy.types import EncryptedString, EncryptedText, GUID, ORA_JSONB, DateTimeUTC, StoredObject, PasswordHash
from sqlalchemy import Text  # pyright: ignore  # noqa: F401

if TYPE_CHECKING:
    from collections.abc import Sequence  # pyright: ignore

__all__ = ("downgrade", "upgrade", "schema_upgrades", "schema_downgrades", "data_upgrades", "data_downgrades")

sa.GUID = GUID # pyright: ignore
sa.DateTimeUTC = DateTimeUTC  # pyright: ignore
sa.ORA_JSONB = ORA_JSONB  # pyright: ignore
sa.EncryptedString = EncryptedString  # pyright: ignore
sa.EncryptedText = EncryptedText  # pyright: ignore
sa.StoredObject = StoredObject  # pyright: ignore
sa.PasswordHash = PasswordHash  # pyright: ignore

# revision identifiers, used by Alembic.
revision = '0289ec3eed65'
down_revision = 'fcd907cd2a8f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=UserWarning)
        with op.get_context().autocommit_block():
            schema_upgrades()
            data_upgrades()

def downgrade() -> None:
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=UserWarning)
        with op.get_context().autocommit_block():
            data_downgrades()
            schema_downgrades()

def schema_upgrades() -> None:
    """schema upgrade migrations go here."""
    # Note: autogenerate also picked up unrelated pre-existing drift (slug/
    # sale_number unique constraint & index drops on category/product/sale/
    # store) that has nothing to do with this change — intentionally left
    # out of this migration rather than applied blind.
    with op.batch_alter_table('sale_item', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('unit_cost', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0')
        )

def schema_downgrades() -> None:
    """schema downgrade migrations go here."""
    with op.batch_alter_table('sale_item', schema=None) as batch_op:
        batch_op.drop_column('unit_cost')

def data_upgrades() -> None:
    """Add any optional data upgrade migrations here!"""

def data_downgrades() -> None:
    """Add any optional data downgrade migrations here!"""
