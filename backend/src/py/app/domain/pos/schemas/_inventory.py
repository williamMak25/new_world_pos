"""Inventory schemas."""

from datetime import datetime
from uuid import UUID

from app.lib.schema import CamelizedBaseStruct


class Inventory(CamelizedBaseStruct):
    id: UUID
    store_id: UUID
    product_id: UUID
    quantity: int = 0
    low_stock_threshold: int = 5
    product_name: str | None = None
    sku: str | None = None


class InventorySet(CamelizedBaseStruct):
    """Set the absolute stock quantity for a product at a store."""

    quantity: int
    low_stock_threshold: int | None = None
    reason: str | None = None


class InventoryAdjust(CamelizedBaseStruct):
    """Adjust stock by a positive or negative delta (e.g. restock, breakage)."""

    delta: int
    reason: str | None = None


class InventoryAdjustmentRecord(CamelizedBaseStruct):
    """An entry in a store's stock adjustment history."""

    id: UUID
    product_id: UUID | None
    product_name: str
    user_label: str | None
    delta: int
    quantity_after: int
    reason: str
    created_at: datetime
