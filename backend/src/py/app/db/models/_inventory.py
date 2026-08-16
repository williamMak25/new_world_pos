from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from advanced_alchemy.base import UUIDv7AuditBase
from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.db.models._product import Product
    from app.db.models._store import Store


class Inventory(UUIDv7AuditBase):
    """Per-store stock level for a product."""

    __tablename__ = "inventory"
    __table_args__ = (
        UniqueConstraint("store_id", "product_id", name="uq_inventory_store_product"),
        {"comment": "Per-store stock levels for products"},
    )

    store_id: Mapped[UUID] = mapped_column(ForeignKey("store.id", ondelete="cascade"), nullable=False, index=True)
    product_id: Mapped[UUID] = mapped_column(ForeignKey("product.id", ondelete="cascade"), nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(default=0, nullable=False)
    low_stock_threshold: Mapped[int] = mapped_column(default=5, nullable=False)

    store: Mapped[Store] = relationship(
        foreign_keys="Inventory.store_id",
        lazy="joined",
        innerjoin=True,
        uselist=False,
    )
    product: Mapped[Product] = relationship(
        back_populates="inventory_records",
        foreign_keys="Inventory.product_id",
        lazy="joined",
        innerjoin=True,
        uselist=False,
    )
