"""Customer schemas."""

from uuid import UUID

import msgspec

from app.lib.schema import CamelizedBaseStruct


class Customer(CamelizedBaseStruct):
    id: UUID
    team_id: UUID
    name: str
    loyalty_points: int = 0
    notes: str | None = None
    email: str | None = None
    phone: str | None = None


class CustomerCreate(CamelizedBaseStruct):
    name: str
    email: str | None = None
    phone: str | None = None
    notes: str | None = None


class CustomerUpdate(CamelizedBaseStruct, omit_defaults=True):
    name: str | msgspec.UnsetType = msgspec.UNSET
    email: str | None | msgspec.UnsetType = msgspec.UNSET
    phone: str | None | msgspec.UnsetType = msgspec.UNSET
    loyalty_points: int | msgspec.UnsetType = msgspec.UNSET
    notes: str | None | msgspec.UnsetType = msgspec.UNSET
