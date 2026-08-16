from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from advanced_alchemy.base import UUIDv7AuditBase
from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models._sale_status import SaleStatus

if TYPE_CHECKING:
    from app.db.models._payment import Payment
    from app.db.models._sale_item import SaleItem


class Sale(UUIDv7AuditBase):
    """A completed (or refunded/voided) point-of-sale transaction."""

    __tablename__ = "sale"
    __table_args__ = {"comment": "Point-of-sale transactions"}

    store_id: Mapped[UUID] = mapped_column(ForeignKey("store.id", ondelete="cascade"), nullable=False, index=True)
    cashier_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user_account.id", ondelete="set null"), nullable=True, index=True
    )
    customer_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("customer.id", ondelete="set null"), nullable=True, index=True
    )
    sale_number: Mapped[str] = mapped_column(String(length=32), nullable=False, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(length=20), default=SaleStatus.COMPLETED, nullable=False, index=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal(0))
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal(0))
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal(0))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal(0))
    notes: Mapped[str | None] = mapped_column(String(length=500), nullable=True, default=None)

    items: Mapped[list[SaleItem]] = relationship(
        back_populates="sale",
        foreign_keys="SaleItem.sale_id",
        cascade="all, delete",
        passive_deletes=True,
        lazy="selectin",
        order_by="SaleItem.created_at",
    )
    payments: Mapped[list[Payment]] = relationship(
        back_populates="sale",
        foreign_keys="Payment.sale_id",
        cascade="all, delete",
        passive_deletes=True,
        lazy="selectin",
    )
