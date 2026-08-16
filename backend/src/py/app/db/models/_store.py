from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from advanced_alchemy.base import UUIDv7AuditBase
from advanced_alchemy.mixins import SlugKey
from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.db.models._team import Team


class Store(UUIDv7AuditBase, SlugKey):
    """A single store / branch location that belongs to a business (team).

    A business can operate multiple stores; products and categories are
    shared across the business while inventory and sales are tracked
    per-store.
    """

    __tablename__ = "store"
    __table_args__ = {"comment": "Physical or virtual store locations for a business"}
    __pii_columns__ = {"name", "address", "phone", "email"}

    team_id: Mapped[UUID] = mapped_column(ForeignKey("team.id", ondelete="cascade"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(length=255), nullable=False, index=True)
    address: Mapped[str | None] = mapped_column(String(length=500), nullable=True, default=None)
    phone: Mapped[str | None] = mapped_column(String(length=20), nullable=True, default=None)
    email: Mapped[str | None] = mapped_column(String(length=255), nullable=True, default=None)
    currency: Mapped[str] = mapped_column(String(length=3), nullable=False, default="USD")
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False, default=Decimal(0))
    """Tax rate expressed as a fraction, e.g. 0.0825 for 8.25%."""
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    team: Mapped[Team] = relationship(
        back_populates="stores",
        foreign_keys="Store.team_id",
        lazy="joined",
        innerjoin=True,
        uselist=False,
    )
