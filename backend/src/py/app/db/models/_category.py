from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from advanced_alchemy.base import UUIDv7AuditBase
from advanced_alchemy.mixins import SlugKey
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.db.models._product import Product


class Category(UUIDv7AuditBase, SlugKey):
    """A product category, shared across all stores in a business."""

    __tablename__ = "category"
    __table_args__ = {"comment": "Product categories for a business catalog"}

    team_id: Mapped[UUID] = mapped_column(ForeignKey("team.id", ondelete="cascade"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(length=255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(length=500), nullable=True, default=None)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    products: Mapped[list[Product]] = relationship(
        back_populates="category",
        foreign_keys="Product.category_id",
        lazy="noload",
        viewonly=True,
    )
