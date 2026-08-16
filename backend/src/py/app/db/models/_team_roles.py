from __future__ import annotations

from enum import StrEnum


class TeamRoles(StrEnum):
    """Valid values for a staff member's role within a business (team).

    ADMIN: Full access to every store owned by the business (products, staff,
        stores, reporting, settings).
    MANAGER: Full access to their assigned store only (products, inventory,
        staff, reporting for that store).
    CASHIER: Checkout access only, scoped to their assigned store.
    """

    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    CASHIER = "CASHIER"
