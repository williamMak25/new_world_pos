from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from advanced_alchemy.base import UUIDv7AuditBase
from advanced_alchemy.mixins import SlugKey
from sqlalchemy import ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.db.models._category import Category
    from app.db.models._inventory import Inventory


class Product(UUIDv7AuditBase, SlugKey):
    """A sellable product, shared across all stores in a business.

    Stock levels are tracked per-store via :class:`Inventory`.
    """

    __tablename__ = "product"
    __table_args__ = (
        UniqueConstraint("team_id", "sku", name="uq_product_team_sku"),
        {"comment": "Sellable products in a business catalog"},
    )

    team_id: Mapped[UUID] = mapped_column(ForeignKey("team.id", ondelete="cascade"), nullable=False, index=True)
    category_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("category.id", ondelete="set null"), nullable=True, index=True
    )
    sku: Mapped[str] = mapped_column(String(length=64), nullable=False, index=True)
    barcode: Mapped[str | None] = mapped_column(String(length=64), nullable=True, index=True, default=None)
    name: Mapped[str] = mapped_column(String(length=255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(length=1000), nullable=True, default=None)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal(0))
    cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal(0))
    track_inventory: Mapped[bool] = mapped_column(default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    category: Mapped[Category | None] = relationship(
        back_populates="products",
        foreign_keys="Product.category_id",
        lazy="joined",
        uselist=False,
    )
    inventory_records: Mapped[list[Inventory]] = relationship(
        back_populates="product",
        foreign_keys="Inventory.product_id",
        cascade="all, delete",
        passive_deletes=True,
        lazy="noload",
    )
