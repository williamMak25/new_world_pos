"""Store schemas."""

from decimal import Decimal
from uuid import UUID

import msgspec

from app.lib.schema import CamelizedBaseStruct


class Store(CamelizedBaseStruct):
    id: UUID
    team_id: UUID
    name: str
    slug: str
    currency: str = "USD"
    tax_rate: Decimal = Decimal(0)
    is_active: bool = True
    address: str | None = None
    phone: str | None = None
    email: str | None = None


class StoreCreate(CamelizedBaseStruct):
    name: str
    currency: str = "USD"
    tax_rate: Decimal = Decimal(0)
    address: str | None = None
    phone: str | None = None
    email: str | None = None


class StoreUpdate(CamelizedBaseStruct, omit_defaults=True):
    name: str | msgspec.UnsetType = msgspec.UNSET
    address: str | None | msgspec.UnsetType = msgspec.UNSET
    phone: str | None | msgspec.UnsetType = msgspec.UNSET
    email: str | None | msgspec.UnsetType = msgspec.UNSET
    currency: str | msgspec.UnsetType = msgspec.UNSET
    tax_rate: Decimal | msgspec.UnsetType = msgspec.UNSET
    is_active: bool | msgspec.UnsetType = msgspec.UNSET
