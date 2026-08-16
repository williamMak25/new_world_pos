from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from advanced_alchemy.base import UUIDv7AuditBase
from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.db.models._sale import Sale


class SaleItem(UUIDv7AuditBase):
    """A single line item within a sale.

    Product name/sku/price/cost are snapshotted at the time of sale so
    historical receipts and cost-of-goods reporting remain accurate even if
    the product is later renamed, repriced, re-costed, or deleted.
    """

    __tablename__ = "sale_item"
    __table_args__ = {"comment": "Line items belonging to a point-of-sale transaction"}

    sale_id: Mapped[UUID] = mapped_column(ForeignKey("sale.id", ondelete="cascade"), nullable=False, index=True)
    product_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("product.id", ondelete="set null"), nullable=True, index=True
    )
    product_name: Mapped[str] = mapped_column(String(length=255), nullable=False)
    sku: Mapped[str | None] = mapped_column(String(length=64), nullable=True, default=None)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal(0))
    quantity: Mapped[int] = mapped_column(nullable=False, default=1)
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    sale: Mapped[Sale] = relationship(
        back_populates="items",
        foreign_keys="SaleItem.sale_id",
        lazy="joined",
        innerjoin=True,
        uselist=False,
    )
