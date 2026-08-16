"""add inventory_adjustment table

Revision ID: 9046c394d291
Revises: 0289ec3eed65
Create Date: 2026-08-17 02:50:29.571486

"""
import warnings

import sqlalchemy as sa
from advanced_alchemy.types import (
    GUID,
    ORA_JSONB,
    DateTimeUTC,
    EncryptedString,
    EncryptedText,
    PasswordHash,
    StoredObject,
)
from alembic import op
from sqlalchemy import Text  # pyright: ignore  # noqa: F401

__all__ = ("data_downgrades", "data_upgrades", "downgrade", "schema_downgrades", "schema_upgrades", "upgrade")

sa.GUID = GUID # pyright: ignore
sa.DateTimeUTC = DateTimeUTC  # pyright: ignore
sa.ORA_JSONB = ORA_JSONB  # pyright: ignore
sa.EncryptedString = EncryptedString  # pyright: ignore
sa.EncryptedText = EncryptedText  # pyright: ignore
sa.StoredObject = StoredObject  # pyright: ignore
sa.PasswordHash = PasswordHash  # pyright: ignore

# revision identifiers, used by Alembic.
revision = "9046c394d291"
down_revision = "0289ec3eed65"
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
    """Schema upgrade migrations go here."""
    # Note: autogenerate also picked up unrelated pre-existing drift (slug/
    # sale_number unique constraint & index drops on category/product/sale/
    # store) that has nothing to do with this change — intentionally left
    # out of this migration rather than applied blind, same as
    # 2026-08-17_add_sale_item_unit_cost_0289ec3eed65.py.
    op.create_table("inventory_adjustment",
    sa.Column("id", sa.GUID(length=16), nullable=False),
    sa.Column("store_id", sa.GUID(length=16), nullable=False),
    sa.Column("product_id", sa.GUID(length=16), nullable=True),
    sa.Column("product_name", sa.String(length=255), nullable=False),
    sa.Column("user_id", sa.GUID(length=16), nullable=True),
    sa.Column("user_label", sa.String(length=255), nullable=True),
    sa.Column("delta", sa.Integer(), nullable=False),
    sa.Column("quantity_after", sa.Integer(), nullable=False),
    sa.Column("reason", sa.String(length=50), nullable=False),
    sa.Column("sa_orm_sentinel", sa.Integer(), nullable=True),
    sa.Column("created_at", sa.DateTimeUTC(timezone=True), nullable=False),
    sa.Column("updated_at", sa.DateTimeUTC(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(["product_id"], ["product.id"], name=op.f("fk_inventory_adjustment_product_id_product"), ondelete="set null"),
    sa.ForeignKeyConstraint(["store_id"], ["store.id"], name=op.f("fk_inventory_adjustment_store_id_store"), ondelete="cascade"),
    sa.ForeignKeyConstraint(["user_id"], ["user_account.id"], name=op.f("fk_inventory_adjustment_user_id_user_account"), ondelete="set null"),
    sa.PrimaryKeyConstraint("id", name=op.f("pk_inventory_adjustment")),
    comment="Audit trail of stock quantity changes at a store"
    )
    with op.batch_alter_table("inventory_adjustment", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_inventory_adjustment_product_id"), ["product_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_inventory_adjustment_store_id"), ["store_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_inventory_adjustment_user_id"), ["user_id"], unique=False)
    # ### end Alembic commands ###

def schema_downgrades() -> None:
    """Schema downgrade migrations go here."""
    with op.batch_alter_table("inventory_adjustment", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_inventory_adjustment_user_id"))
        batch_op.drop_index(batch_op.f("ix_inventory_adjustment_store_id"))
        batch_op.drop_index(batch_op.f("ix_inventory_adjustment_product_id"))

    op.drop_table("inventory_adjustment")
    # ### end Alembic commands ###

def data_upgrades() -> None:
    """Add any optional data upgrade migrations here!"""

def data_downgrades() -> None:
    """Add any optional data downgrade migrations here!"""
