"""Product schemas."""

from decimal import Decimal
from uuid import UUID

import msgspec

from app.lib.schema import CamelizedBaseStruct


class Product(CamelizedBaseStruct):
    sku: str
    slug: str
    name: str
    price: Decimal
    id: UUID
    team_id: UUID
    cost: Decimal = Decimal(0)
    track_inventory: bool = True
    is_active: bool = True
    category_id: UUID | None = None
    barcode: str | None = None
    description: str | None = None

class ProductCreate(CamelizedBaseStruct):
    sku: str
    name: str
    price: Decimal
    cost: Decimal = Decimal(0)
    track_inventory: bool = True
    category_id: UUID | None = None
    barcode: str | None = None
    description: str | None = None


class ProductUpdate(CamelizedBaseStruct, omit_defaults=True):
    sku: str | msgspec.UnsetType = msgspec.UNSET
    name: str | msgspec.UnsetType = msgspec.UNSET
    price: Decimal | msgspec.UnsetType = msgspec.UNSET
    category_id: UUID | None | msgspec.UnsetType = msgspec.UNSET
    barcode: str | None | msgspec.UnsetType = msgspec.UNSET
    description: str | None | msgspec.UnsetType = msgspec.UNSET
    cost: Decimal | msgspec.UnsetType = msgspec.UNSET
    track_inventory: bool | msgspec.UnsetType = msgspec.UNSET
    is_active: bool | msgspec.UnsetType = msgspec.UNSET
