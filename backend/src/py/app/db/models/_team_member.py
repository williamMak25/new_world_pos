from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from advanced_alchemy.base import UUIDv7AuditBase
from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models._team_roles import TeamRoles

if TYPE_CHECKING:
    from app.db.models._store import Store
    from app.db.models._team import Team
    from app.db.models._user import User


class TeamMember(UUIDv7AuditBase):
    """Team Membership."""

    __tablename__ = "team_member"
    __table_args__ = (UniqueConstraint("user_id", "team_id"),)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("user_account.id", ondelete="cascade"), nullable=False)
    team_id: Mapped[UUID] = mapped_column(ForeignKey("team.id", ondelete="cascade"), nullable=False)
    role: Mapped[TeamRoles] = mapped_column(
        String(length=50),
        default=TeamRoles.CASHIER,
        nullable=False,
        index=True,
    )
    is_owner: Mapped[bool] = mapped_column(default=False, nullable=False)
    assigned_store_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("store.id", ondelete="set null"), nullable=True, index=True, default=None
    )
    """The store this staff member primarily works at.

    ADMIN members can access every store owned by the team regardless of
    this value. MANAGER and CASHIER members are restricted to this store.
    """

    assigned_store: Mapped[Store | None] = relationship(
        foreign_keys="TeamMember.assigned_store_id",
        lazy="joined",
        uselist=False,
    )
    user: Mapped[User] = relationship(
        back_populates="teams",
        foreign_keys="TeamMember.user_id",
        innerjoin=True,
        uselist=False,
        lazy="joined",
    )
    name: AssociationProxy[str] = association_proxy("user", "name")
    email: AssociationProxy[str] = association_proxy("user", "email")
    team: Mapped[Team] = relationship(
        back_populates="members",
        foreign_keys="TeamMember.team_id",
        innerjoin=True,
        uselist=False,
        lazy="joined",
    )
    team_name: AssociationProxy[str] = association_proxy("team", "name")
