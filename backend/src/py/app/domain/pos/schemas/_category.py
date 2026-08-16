"""Category schemas."""

from uuid import UUID

import msgspec

from app.lib.schema import CamelizedBaseStruct


class Category(CamelizedBaseStruct):
    id: UUID
    team_id: UUID
    name: str
    slug: str
    is_active: bool = True
    description: str | None = None


class CategoryCreate(CamelizedBaseStruct):
    name: str
    description: str | None = None


class CategoryUpdate(CamelizedBaseStruct, omit_defaults=True):
    name: str | msgspec.UnsetType = msgspec.UNSET
    description: str | None | msgspec.UnsetType = msgspec.UNSET
    is_active: bool | msgspec.UnsetType = msgspec.UNSET
