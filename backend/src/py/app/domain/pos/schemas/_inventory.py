"""Inventory schemas."""

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


class InventoryAdjust(CamelizedBaseStruct):
    """Adjust stock by a positive or negative delta (e.g. restock, breakage)."""

    delta: int
    reason: str | None = None
