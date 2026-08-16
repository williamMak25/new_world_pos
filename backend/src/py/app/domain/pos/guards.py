"""POS domain guards.

Access to a business's data is scoped through team membership (see
``app.domain.teams``). Within a team:

- ``ADMIN`` members can access every store owned by the team.
- ``MANAGER`` and ``CASHIER`` members are restricted to their
  ``assigned_store_id``.

Most POS routes are scoped by ``store_id`` in the path. A handful (catalog
management: products/categories, and customers) are scoped by ``team_id``
instead, since the catalog and customer list are shared across a business's
stores.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from litestar.exceptions import PermissionDeniedException

from app.db import models as m
from app.lib import constants

if TYPE_CHECKING:
    from typing import Any

    from litestar.connection import ASGIConnection
    from litestar.handlers.base import BaseRouteHandler
    from litestar.security.jwt import Token


def _has_system_override(connection: ASGIConnection[Any, m.User, Token, Any]) -> bool:
    if connection.user.is_superuser:
        return True
    return any(
        assigned_role.role_name
        for assigned_role in connection.user.roles
        if assigned_role.role_name == constants.SUPERUSER_ACCESS_ROLE
    )


def requires_team_catalog_access(connection: ASGIConnection[Any, m.User, Token, Any], _: BaseRouteHandler) -> None:
    """Verify the connection user belongs to the team (any role).

    Used for catalog resources (products, categories, customers) that are
    shared across a business's stores rather than scoped to a single store.

    Raises:
        PermissionDeniedException: Not authorized.
    """
    team_id = connection.path_params["team_id"]
    if _has_system_override(connection):
        return
    if any(membership.team_id == team_id for membership in connection.user.teams):
        return
    raise PermissionDeniedException(detail="Insufficient permissions to access this business.")


def requires_team_manager_access(connection: ASGIConnection[Any, m.User, Token, Any], _: BaseRouteHandler) -> None:
    """Verify the connection user is an ADMIN or MANAGER of the team.

    Used for catalog mutations (creating/editing products, categories).

    Raises:
        PermissionDeniedException: Not authorized.
    """
    team_id = connection.path_params["team_id"]
    if _has_system_override(connection):
        return
    if any(
        membership.team_id == team_id and membership.role in (m.TeamRoles.ADMIN, m.TeamRoles.MANAGER)
        for membership in connection.user.teams
    ):
        return
    raise PermissionDeniedException(detail="Insufficient permissions to manage this business's catalog.")


def requires_store_access(connection: ASGIConnection[Any, m.User, Token, Any], _: BaseRouteHandler) -> None:
    """Verify the connection user can access the given store (any role).

    ADMIN members may access any store in their team; MANAGER/CASHIER
    members must be assigned to this specific store.

    Raises:
        PermissionDeniedException: Not authorized.
    """
    store_id = connection.path_params["store_id"]
    if _has_system_override(connection):
        return
    for membership in connection.user.teams:
        if membership.role == m.TeamRoles.ADMIN and any(store.id == store_id for store in membership.team.stores):
            return
        if membership.assigned_store_id == store_id:
            return
    raise PermissionDeniedException(detail="Insufficient permissions to access this store.")


def requires_store_manager(connection: ASGIConnection[Any, m.User, Token, Any], _: BaseRouteHandler) -> None:
    """Verify the connection user is an ADMIN (any store) or MANAGER of this store.

    Used for store-level management actions (editing inventory levels,
    viewing store reports, managing store staff).

    Raises:
        PermissionDeniedException: Not authorized.
    """
    store_id = connection.path_params["store_id"]
    if _has_system_override(connection):
        return
    for membership in connection.user.teams:
        if membership.role == m.TeamRoles.ADMIN and any(store.id == store_id for store in membership.team.stores):
            return
        if membership.role == m.TeamRoles.MANAGER and membership.assigned_store_id == store_id:
            return
    raise PermissionDeniedException(detail="Insufficient permissions to manage this store.")


def requires_store_admin(connection: ASGIConnection[Any, m.User, Token, Any], _: BaseRouteHandler) -> None:
    """Verify the connection user is an ADMIN of the team that owns this store.

    Used for destructive, store-level actions (deleting a store) that
    MANAGERs of that store should not be able to perform.

    Raises:
        PermissionDeniedException: Not authorized.
    """
    store_id = connection.path_params["store_id"]
    if _has_system_override(connection):
        return
    for membership in connection.user.teams:
        if membership.role == m.TeamRoles.ADMIN and any(store.id == store_id for store in membership.team.stores):
            return
    raise PermissionDeniedException(detail="Only a business admin can perform this action.")


__all__ = (
    "requires_store_access",
    "requires_store_admin",
    "requires_store_manager",
    "requires_team_catalog_access",
    "requires_team_manager_access",
)
