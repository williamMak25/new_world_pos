from __future__ import annotations

from uuid import UUID

from advanced_alchemy.base import UUIDv7AuditBase
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column


class Customer(UUIDv7AuditBase):
    """A customer of a business, shared across all of its stores."""

    __tablename__ = "customer"
    __table_args__ = {"comment": "Customers associated with a business"}
    __pii_columns__ = {"name", "email", "phone"}

    team_id: Mapped[UUID] = mapped_column(ForeignKey("team.id", ondelete="cascade"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(length=255), nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(length=255), nullable=True, default=None, index=True)
    phone: Mapped[str | None] = mapped_column(String(length=20), nullable=True, default=None, index=True)
    loyalty_points: Mapped[int] = mapped_column(default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(length=500), nullable=True, default=None)
