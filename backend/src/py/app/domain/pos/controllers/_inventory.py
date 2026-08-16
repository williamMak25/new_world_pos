"""Inventory controllers."""

from __future__ import annotations

from typing import TYPE_CHECKING, Annotated
from uuid import UUID

from advanced_alchemy.service.pagination import OffsetPagination
from litestar import Controller, get, put
from litestar.params import Dependency, Parameter
from sqlalchemy.orm import selectinload

from app.db import models as m
from app.domain.pos.guards import requires_store_access, requires_store_manager
from app.domain.pos.schemas import Inventory, InventoryAdjust, InventorySet
from app.domain.pos.services import InventoryService
from app.lib.deps import create_service_dependencies

if TYPE_CHECKING:
    from advanced_alchemy.filters import FilterTypes


def _to_inventory_schema(record: m.Inventory) -> Inventory:
    return Inventory(
        id=record.id,
        store_id=record.store_id,
        product_id=record.product_id,
        product_name=record.product.name if record.product else None,
        sku=record.product.sku if record.product else None,
        quantity=record.quantity,
        low_stock_threshold=record.low_stock_threshold,
    )


class InventoryController(Controller):
    """Per-store stock levels."""

    tags = ["Inventory"]
    dependencies = create_service_dependencies(
        InventoryService,
        key="inventory_service",
        load=[selectinload(m.Inventory.product)],
        filters={
            "id_filter": UUID,
            "pagination_type": "limit_offset",
            "pagination_size": 100,
            "created_at": True,
            "updated_at": True,
        },
    )

    @get(
        operation_id="ListInventory",
        path="/api/stores/{store_id:uuid}/inventory",
        guards=[requires_store_access],
    )
    async def list_inventory(
        self,
        inventory_service: InventoryService,
        store_id: Annotated[UUID, Parameter(title="Store ID")],
        filters: Annotated[list[FilterTypes], Dependency(skip_validation=True)],
    ) -> OffsetPagination[Inventory]:
        """List stock levels for every product tracked at a store.

        Returns:
            A paginated list of inventory records.
        """
        results, total = await inventory_service.list_and_count(*filters, m.Inventory.store_id == store_id)
        return OffsetPagination(
            items=[_to_inventory_schema(r) for r in results],
            total=total,
            limit=next((f.limit for f in filters if hasattr(f, "limit")), len(results)),
            offset=next((f.offset for f in filters if hasattr(f, "offset")), 0),
        )

    @get(
        operation_id="ListLowStock",
        path="/api/stores/{store_id:uuid}/inventory/low-stock",
        guards=[requires_store_access],
    )
    async def list_low_stock(
        self,
        inventory_service: InventoryService,
        store_id: Annotated[UUID, Parameter(title="Store ID")],
    ) -> list[Inventory]:
        """List products at or below their low-stock threshold for a store.

        Returns:
            Inventory records that need restocking.
        """
        records = await inventory_service.low_stock(store_id=store_id)
        return [_to_inventory_schema(r) for r in records]

    @put(
        operation_id="SetInventory",
        path="/api/stores/{store_id:uuid}/inventory/{product_id:uuid}",
        guards=[requires_store_manager],
    )
    async def set_inventory(
        self,
        inventory_service: InventoryService,
        store_id: Annotated[UUID, Parameter(title="Store ID")],
        product_id: Annotated[UUID, Parameter(title="Product ID")],
        data: InventorySet,
    ) -> Inventory:
        """Set the absolute stock quantity for a product at a store.

        Returns:
            The updated inventory record.
        """
        record = await inventory_service.set_quantity(
            store_id=store_id,
            product_id=product_id,
            quantity=data.quantity,
            low_stock_threshold=data.low_stock_threshold,
        )
        await inventory_service.repository.session.refresh(record, ["product"])
        return _to_inventory_schema(record)

    @put(
        operation_id="AdjustInventory",
        path="/api/stores/{store_id:uuid}/inventory/{product_id:uuid}/adjust",
        guards=[requires_store_manager],
    )
    async def adjust_inventory(
        self,
        inventory_service: InventoryService,
        store_id: Annotated[UUID, Parameter(title="Store ID")],
        product_id: Annotated[UUID, Parameter(title="Product ID")],
        data: InventoryAdjust,
    ) -> Inventory:
        """Adjust stock at a store by a positive or negative delta (e.g. restock, breakage).

        Returns:
            The updated inventory record.
        """
        record = await inventory_service.adjust_quantity(store_id=store_id, product_id=product_id, delta=data.delta)
        await inventory_service.repository.session.refresh(record, ["product"])
        return _to_inventory_schema(record)
