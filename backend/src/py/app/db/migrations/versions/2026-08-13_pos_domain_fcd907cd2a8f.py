"""pos domain: stores, catalog, inventory, customers, sales

Revision ID: fcd907cd2a8f
Revises: dc54b25d8b6c
Create Date: 2026-08-13 00:00:00.000000

"""
import warnings
from typing import TYPE_CHECKING

import sqlalchemy as sa
from alembic import op
from advanced_alchemy.types import EncryptedString, EncryptedText, FernetBackend, GUID, ORA_JSONB, DateTimeUTC, StoredObject, PasswordHash
from sqlalchemy import Text  # pyright: ignore  # noqa: F401
from sqlalchemy.dialects import postgresql
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
revision = 'fcd907cd2a8f'
down_revision = 'dc54b25d8b6c'
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
    op.create_table('store',
    sa.Column('id', sa.GUID(length=16), nullable=False),
    sa.Column('team_id', sa.GUID(length=16), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('address', sa.String(length=500), nullable=True),
    sa.Column('phone', sa.String(length=20), nullable=True),
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.Column('currency', sa.String(length=3), nullable=False),
    sa.Column('tax_rate', sa.Numeric(precision=6, scale=4), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('slug', sa.String(length=100), nullable=False),
    sa.Column('sa_orm_sentinel', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTimeUTC(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTimeUTC(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['team_id'], ['team.id'], name=op.f('fk_store_team_id_team'), ondelete='cascade'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_store')),
    sa.UniqueConstraint('slug', name='uq_store_slug'),
    comment='Physical or virtual store locations for a business'
    )
    with op.batch_alter_table('store', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_store_name'), ['name'], unique=False)
        batch_op.create_index(batch_op.f('ix_store_team_id'), ['team_id'], unique=False)
        batch_op.create_index('ix_store_slug_unique', ['slug'], unique=True)

    op.create_table('category',
    sa.Column('id', sa.GUID(length=16), nullable=False),
    sa.Column('team_id', sa.GUID(length=16), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('description', sa.String(length=500), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('slug', sa.String(length=100), nullable=False),
    sa.Column('sa_orm_sentinel', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTimeUTC(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTimeUTC(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['team_id'], ['team.id'], name=op.f('fk_category_team_id_team'), ondelete='cascade'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_category')),
    sa.UniqueConstraint('slug', name='uq_category_slug'),
    comment='Product categories for a business catalog'
    )
    with op.batch_alter_table('category', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_category_name'), ['name'], unique=False)
        batch_op.create_index(batch_op.f('ix_category_team_id'), ['team_id'], unique=False)
        batch_op.create_index('ix_category_slug_unique', ['slug'], unique=True)

    op.create_table('product',
    sa.Column('id', sa.GUID(length=16), nullable=False),
    sa.Column('team_id', sa.GUID(length=16), nullable=False),
    sa.Column('category_id', sa.GUID(length=16), nullable=True),
    sa.Column('sku', sa.String(length=64), nullable=False),
    sa.Column('barcode', sa.String(length=64), nullable=True),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('description', sa.String(length=1000), nullable=True),
    sa.Column('price', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('cost', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('track_inventory', sa.Boolean(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('slug', sa.String(length=100), nullable=False),
    sa.Column('sa_orm_sentinel', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTimeUTC(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTimeUTC(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['category_id'], ['category.id'], name=op.f('fk_product_category_id_category'), ondelete='set null'),
    sa.ForeignKeyConstraint(['team_id'], ['team.id'], name=op.f('fk_product_team_id_team'), ondelete='cascade'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_product')),
    sa.UniqueConstraint('team_id', 'sku', name='uq_product_team_sku'),
    sa.UniqueConstraint('slug', name='uq_product_slug'),
    comment='Sellable products in a business catalog'
    )
    with op.batch_alter_table('product', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_product_barcode'), ['barcode'], unique=False)
        batch_op.create_index(batch_op.f('ix_product_category_id'), ['category_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_product_name'), ['name'], unique=False)
        batch_op.create_index(batch_op.f('ix_product_sku'), ['sku'], unique=False)
        batch_op.create_index(batch_op.f('ix_product_team_id'), ['team_id'], unique=False)
        batch_op.create_index('ix_product_slug_unique', ['slug'], unique=True)

    op.create_table('inventory',
    sa.Column('id', sa.GUID(length=16), nullable=False),
    sa.Column('store_id', sa.GUID(length=16), nullable=False),
    sa.Column('product_id', sa.GUID(length=16), nullable=False),
    sa.Column('quantity', sa.Integer(), nullable=False),
    sa.Column('low_stock_threshold', sa.Integer(), nullable=False),
    sa.Column('sa_orm_sentinel', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTimeUTC(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTimeUTC(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['product_id'], ['product.id'], name=op.f('fk_inventory_product_id_product'), ondelete='cascade'),
    sa.ForeignKeyConstraint(['store_id'], ['store.id'], name=op.f('fk_inventory_store_id_store'), ondelete='cascade'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_inventory')),
    sa.UniqueConstraint('store_id', 'product_id', name='uq_inventory_store_product'),
    comment='Per-store stock levels for products'
    )
    with op.batch_alter_table('inventory', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_inventory_product_id'), ['product_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_inventory_store_id'), ['store_id'], unique=False)

    op.create_table('customer',
    sa.Column('id', sa.GUID(length=16), nullable=False),
    sa.Column('team_id', sa.GUID(length=16), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.Column('phone', sa.String(length=20), nullable=True),
    sa.Column('loyalty_points', sa.Integer(), nullable=False),
    sa.Column('notes', sa.String(length=500), nullable=True),
    sa.Column('sa_orm_sentinel', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTimeUTC(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTimeUTC(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['team_id'], ['team.id'], name=op.f('fk_customer_team_id_team'), ondelete='cascade'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_customer')),
    comment='Customers associated with a business'
    )
    with op.batch_alter_table('customer', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_customer_email'), ['email'], unique=False)
        batch_op.create_index(batch_op.f('ix_customer_name'), ['name'], unique=False)
        batch_op.create_index(batch_op.f('ix_customer_phone'), ['phone'], unique=False)
        batch_op.create_index(batch_op.f('ix_customer_team_id'), ['team_id'], unique=False)

    op.create_table('sale',
    sa.Column('id', sa.GUID(length=16), nullable=False),
    sa.Column('store_id', sa.GUID(length=16), nullable=False),
    sa.Column('cashier_id', sa.GUID(length=16), nullable=True),
    sa.Column('customer_id', sa.GUID(length=16), nullable=True),
    sa.Column('sale_number', sa.String(length=32), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('subtotal', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('discount_amount', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('tax_amount', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('total', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('notes', sa.String(length=500), nullable=True),
    sa.Column('sa_orm_sentinel', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTimeUTC(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTimeUTC(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['cashier_id'], ['user_account.id'], name=op.f('fk_sale_cashier_id_user_account'), ondelete='set null'),
    sa.ForeignKeyConstraint(['customer_id'], ['customer.id'], name=op.f('fk_sale_customer_id_customer'), ondelete='set null'),
    sa.ForeignKeyConstraint(['store_id'], ['store.id'], name=op.f('fk_sale_store_id_store'), ondelete='cascade'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_sale')),
    sa.UniqueConstraint('sale_number', name=op.f('uq_sale_sale_number')),
    comment='Point-of-sale transactions'
    )
    with op.batch_alter_table('sale', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_sale_cashier_id'), ['cashier_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_sale_customer_id'), ['customer_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_sale_sale_number'), ['sale_number'], unique=True)
        batch_op.create_index(batch_op.f('ix_sale_status'), ['status'], unique=False)
        batch_op.create_index(batch_op.f('ix_sale_store_id'), ['store_id'], unique=False)

    op.create_table('sale_item',
    sa.Column('id', sa.GUID(length=16), nullable=False),
    sa.Column('sale_id', sa.GUID(length=16), nullable=False),
    sa.Column('product_id', sa.GUID(length=16), nullable=True),
    sa.Column('product_name', sa.String(), nullable=False),
    sa.Column('sku', sa.String(length=64), nullable=True),
    sa.Column('unit_price', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('quantity', sa.Integer(), nullable=False),
    sa.Column('line_total', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('sa_orm_sentinel', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTimeUTC(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTimeUTC(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['product_id'], ['product.id'], name=op.f('fk_sale_item_product_id_product'), ondelete='set null'),
    sa.ForeignKeyConstraint(['sale_id'], ['sale.id'], name=op.f('fk_sale_item_sale_id_sale'), ondelete='cascade'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_sale_item')),
    comment='Line items belonging to a point-of-sale transaction'
    )
    with op.batch_alter_table('sale_item', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_sale_item_product_id'), ['product_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_sale_item_sale_id'), ['sale_id'], unique=False)

    op.create_table('payment',
    sa.Column('id', sa.GUID(length=16), nullable=False),
    sa.Column('sale_id', sa.GUID(length=16), nullable=False),
    sa.Column('method', sa.String(length=20), nullable=False),
    sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('reference', sa.String(length=255), nullable=True),
    sa.Column('sa_orm_sentinel', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTimeUTC(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTimeUTC(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['sale_id'], ['sale.id'], name=op.f('fk_payment_sale_id_sale'), ondelete='cascade'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_payment')),
    comment='Payments applied to a point-of-sale transaction'
    )
    with op.batch_alter_table('payment', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_payment_sale_id'), ['sale_id'], unique=False)

    with op.batch_alter_table('team_member', schema=None) as batch_op:
        batch_op.add_column(sa.Column('assigned_store_id', sa.GUID(length=16), nullable=True))
        batch_op.create_foreign_key(batch_op.f('fk_team_member_assigned_store_id_store'), 'store', ['assigned_store_id'], ['id'], ondelete='set null')
        batch_op.create_index(batch_op.f('ix_team_member_assigned_store_id'), ['assigned_store_id'], unique=False)

def schema_downgrades() -> None:
    """schema downgrade migrations go here."""
    with op.batch_alter_table('team_member', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_team_member_assigned_store_id'))
        batch_op.drop_constraint(batch_op.f('fk_team_member_assigned_store_id_store'), type_='foreignkey')
        batch_op.drop_column('assigned_store_id')

    with op.batch_alter_table('payment', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_payment_sale_id'))
    op.drop_table('payment')

    with op.batch_alter_table('sale_item', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_sale_item_sale_id'))
        batch_op.drop_index(batch_op.f('ix_sale_item_product_id'))
    op.drop_table('sale_item')

    with op.batch_alter_table('sale', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_sale_store_id'))
        batch_op.drop_index(batch_op.f('ix_sale_status'))
        batch_op.drop_index(batch_op.f('ix_sale_sale_number'))
        batch_op.drop_index(batch_op.f('ix_sale_customer_id'))
        batch_op.drop_index(batch_op.f('ix_sale_cashier_id'))
    op.drop_table('sale')

    with op.batch_alter_table('customer', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_customer_team_id'))
        batch_op.drop_index(batch_op.f('ix_customer_phone'))
        batch_op.drop_index(batch_op.f('ix_customer_name'))
        batch_op.drop_index(batch_op.f('ix_customer_email'))
    op.drop_table('customer')

    with op.batch_alter_table('inventory', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_inventory_store_id'))
        batch_op.drop_index(batch_op.f('ix_inventory_product_id'))
    op.drop_table('inventory')

    with op.batch_alter_table('product', schema=None) as batch_op:
        batch_op.drop_index('ix_product_slug_unique')
        batch_op.drop_index(batch_op.f('ix_product_team_id'))
        batch_op.drop_index(batch_op.f('ix_product_sku'))
        batch_op.drop_index(batch_op.f('ix_product_name'))
        batch_op.drop_index(batch_op.f('ix_product_category_id'))
        batch_op.drop_index(batch_op.f('ix_product_barcode'))
    op.drop_table('product')

    with op.batch_alter_table('category', schema=None) as batch_op:
        batch_op.drop_index('ix_category_slug_unique')
        batch_op.drop_index(batch_op.f('ix_category_team_id'))
        batch_op.drop_index(batch_op.f('ix_category_name'))
    op.drop_table('category')

    with op.batch_alter_table('store', schema=None) as batch_op:
        batch_op.drop_index('ix_store_slug_unique')
        batch_op.drop_index(batch_op.f('ix_store_team_id'))
        batch_op.drop_index(batch_op.f('ix_store_name'))
    op.drop_table('store')

def data_upgrades() -> None:
    """Add any optional data upgrade migrations here!"""

def data_downgrades() -> None:
    """Add any optional data downgrade migrations here!"""
