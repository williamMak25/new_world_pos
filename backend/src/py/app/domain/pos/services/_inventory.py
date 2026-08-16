from __future__ import annotations

from uuid import UUID

from advanced_alchemy.extensions.litestar import repository, service
from sqlalchemy import select

from app.db import models as m
from app.lib.exceptions import ApplicationClientError


class InventoryService(service.SQLAlchemyAsyncRepositoryService[m.Inventory]):
    """Handles per-store stock level operations."""

    class Repo(repository.SQLAlchemyAsyncRepository[m.Inventory]):
        """Inventory Repository."""

        model_type = m.Inventory

    repository_type = Repo

    async def get_or_create_for(self, *, store_id: UUID, product_id: UUID) -> m.Inventory:
        """Get the inventory row for a store/product pair, creating one at zero stock if missing.

        Returns:
            The inventory record.
        """
        session = self.repository.session
        result = await session.execute(
            select(m.Inventory).where(m.Inventory.store_id == store_id, m.Inventory.product_id == product_id)
        )
        inventory = result.scalar_one_or_none()
        if inventory is None:
            inventory = m.Inventory(store_id=store_id, product_id=product_id, quantity=0)
            session.add(inventory)
            await session.flush()
        return inventory

    async def set_quantity(
        self, *, store_id: UUID, product_id: UUID, quantity: int, low_stock_threshold: int | None = None
    ) -> m.Inventory:
        """Set the absolute stock quantity for a product at a store.

        Returns:
            The updated inventory record.
        """
        if quantity < 0:
            msg = "Quantity cannot be negative."
            raise ApplicationClientError(msg)
        inventory = await self.get_or_create_for(store_id=store_id, product_id=product_id)
        inventory.quantity = quantity
        if low_stock_threshold is not None:
            inventory.low_stock_threshold = low_stock_threshold
        await self.repository.session.flush()
        return inventory

    async def adjust_quantity(self, *, store_id: UUID, product_id: UUID, delta: int) -> m.Inventory:
        """Adjust stock by a positive or negative delta.

        Returns:
            The updated inventory record.
        """
        inventory = await self.get_or_create_for(store_id=store_id, product_id=product_id)
        new_quantity = inventory.quantity + delta
        if new_quantity < 0:
            msg = "Adjustment would result in negative stock."
            raise ApplicationClientError(msg)
        inventory.quantity = new_quantity
        await self.repository.session.flush()
        return inventory

    async def low_stock(self, *, store_id: UUID) -> list[m.Inventory]:
        """List inventory records at or below their low-stock threshold.

        Returns:
            Inventory records that are low on stock.
        """
        result = await self.repository.session.execute(
            select(m.Inventory).where(
                m.Inventory.store_id == store_id,
                m.Inventory.quantity <= m.Inventory.low_stock_threshold,
            )
        )
        return list(result.scalars().all())
