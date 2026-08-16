from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from advanced_alchemy.base import UUIDv7AuditBase
from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models._sale_status import PaymentMethod

if TYPE_CHECKING:
    from app.db.models._sale import Sale


class Payment(UUIDv7AuditBase):
    """A payment applied to a sale. Sales may have multiple (split) payments."""

    __tablename__ = "payment"
    __table_args__ = {"comment": "Payments applied to a point-of-sale transaction"}

    sale_id: Mapped[UUID] = mapped_column(ForeignKey("sale.id", ondelete="cascade"), nullable=False, index=True)
    method: Mapped[str] = mapped_column(String(length=20), nullable=False, default=PaymentMethod.CASH)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(length=255), nullable=True, default=None)

    sale: Mapped[Sale] = relationship(
        back_populates="payments",
        foreign_keys="Payment.sale_id",
        lazy="joined",
        innerjoin=True,
        uselist=False,
    )
