from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from advanced_alchemy.extensions.litestar import repository, service
from sqlalchemy import func, select

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
        self,
        *,
        store_id: UUID,
        product_id: UUID,
        quantity: int,
        low_stock_threshold: int | None = None,
        reason: str | None = None,
        user_id: UUID | None = None,
        user_label: str | None = None,
    ) -> m.Inventory:
        """Set the absolute stock quantity for a product at a store.

        Returns:
            The updated inventory record.
        """
        if quantity < 0:
            msg = "Quantity cannot be negative."
            raise ApplicationClientError(msg)
        inventory = await self.get_or_create_for(store_id=store_id, product_id=product_id)
        delta = quantity - inventory.quantity
        inventory.quantity = quantity
        if low_stock_threshold is not None:
            inventory.low_stock_threshold = low_stock_threshold
        await self._record_adjustment(
            inventory=inventory, delta=delta, reason=reason, user_id=user_id, user_label=user_label
        )
        await self.repository.session.flush()
        return inventory

    async def adjust_quantity(
        self,
        *,
        store_id: UUID,
        product_id: UUID,
        delta: int,
        reason: str | None = None,
        user_id: UUID | None = None,
        user_label: str | None = None,
    ) -> m.Inventory:
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
        await self._record_adjustment(
            inventory=inventory, delta=delta, reason=reason, user_id=user_id, user_label=user_label
        )
        await self.repository.session.flush()
        return inventory

    async def _record_adjustment(
        self,
        *,
        inventory: m.Inventory,
        delta: int,
        reason: str | None,
        user_id: UUID | None,
        user_label: str | None,
    ) -> None:
        """Insert an audit row for a stock change, unless the quantity didn't actually move."""
        if delta == 0:
            return
        # Query the name directly rather than via inventory.product: for a
        # freshly created row (first time tracking a product) the
        # relationship hasn't been loaded, and AsyncSession doesn't support
        # implicit lazy-loading on attribute access.
        name_result = await self.repository.session.execute(
            select(m.Product.name).where(m.Product.id == inventory.product_id)
        )
        self.repository.session.add(
            m.InventoryAdjustment(
                store_id=inventory.store_id,
                product_id=inventory.product_id,
                product_name=name_result.scalar_one(),
                user_id=user_id,
                user_label=user_label,
                delta=delta,
                quantity_after=inventory.quantity,
                reason=reason or "ADJUSTMENT",
            )
        )

    async def list_adjustments(
        self, *, store_id: UUID, product_id: UUID | None = None, limit: int = 50
    ) -> list[m.InventoryAdjustment]:
        """List recent stock adjustments for a store, newest first.

        Returns:
            Recent adjustment records, optionally scoped to one product.
        """
        stmt = select(m.InventoryAdjustment).where(m.InventoryAdjustment.store_id == store_id)
        if product_id is not None:
            stmt = stmt.where(m.InventoryAdjustment.product_id == product_id)
        stmt = stmt.order_by(m.InventoryAdjustment.created_at.desc()).limit(limit)
        result = await self.repository.session.execute(stmt)
        return list(result.scalars().all())

    async def inventory_value(self, *, store_id: UUID) -> Decimal:
        """Total cost basis of stock currently on hand at a store (quantity x cost, summed).

        This is a snapshot of stock right now — unlike sales reporting, there's
        no history of past stock levels to compute this for a prior date.

        Returns:
            The total cost of all unsold inventory at the store.
        """
        result = await self.repository.session.execute(
            select(func.coalesce(func.sum(m.Inventory.quantity * m.Product.cost), 0))
            .join(m.Product, m.Product.id == m.Inventory.product_id)
            .where(m.Inventory.store_id == store_id)
        )
        return Decimal(result.scalar_one())

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
