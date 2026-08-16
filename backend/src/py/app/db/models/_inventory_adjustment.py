from __future__ import annotations

from uuid import UUID

from advanced_alchemy.base import UUIDv7AuditBase
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column


class InventoryAdjustment(UUIDv7AuditBase):
    """A record of a stock quantity change at a store, for audit/history purposes.

    Product name and the acting user's label are snapshotted at the time of
    the change so history remains readable even if the product is renamed/
    deleted or the user account is removed later — same reasoning as the
    snapshotting on :class:`~app.db.models._sale_item.SaleItem`.
    """

    __tablename__ = "inventory_adjustment"
    __table_args__ = {"comment": "Audit trail of stock quantity changes at a store"}

    store_id: Mapped[UUID] = mapped_column(ForeignKey("store.id", ondelete="cascade"), nullable=False, index=True)
    product_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("product.id", ondelete="set null"), nullable=True, index=True
    )
    product_name: Mapped[str] = mapped_column(String(length=255), nullable=False)
    user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("user_account.id", ondelete="set null"), nullable=True, index=True
    )
    user_label: Mapped[str | None] = mapped_column(String(length=255), nullable=True, default=None)
    delta: Mapped[int] = mapped_column(nullable=False)
    quantity_after: Mapped[int] = mapped_column(nullable=False)
    reason: Mapped[str] = mapped_column(String(length=50), nullable=False)
