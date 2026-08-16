from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import TYPE_CHECKING

from advanced_alchemy.extensions.litestar import repository, service
from sqlalchemy import func, select

from app.db import models as m
from app.lib.deps import CompositeServiceMixin
from app.lib.exceptions import ApplicationClientError

if TYPE_CHECKING:
    from uuid import UUID

    from app.domain.pos import schemas

TWO_PLACES = Decimal("0.01")
BREAKDOWN_DAILY_MAX_DAYS = 31
BREAKDOWN_WEEKLY_MAX_DAYS = 180


def _round_money(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


class SaleService(CompositeServiceMixin, service.SQLAlchemyAsyncRepositoryService[m.Sale]):
    """Handles checkout, voids, refunds, and reporting for point-of-sale transactions."""

    class Repo(repository.SQLAlchemyAsyncRepository[m.Sale]):
        """Sale Repository."""

        model_type = m.Sale

    repository_type = Repo

    async def checkout(self, *, store: m.Store, cashier_id: UUID | None, data: schemas.CheckoutRequest) -> m.Sale:
        """Validate a cart, decrement inventory, and record a completed sale.

        Raises:
            ApplicationClientError: If the cart is empty, a product cannot be found,
                stock is insufficient, or payments don't cover the total.

        Returns:
            The newly created sale, including its line items and payments.
        """
        if not data.items:
            msg = "Cannot checkout an empty cart."
            raise ApplicationClientError(msg)

        session = self.repository.session
        product_ids = [item.product_id for item in data.items]
        products_result = await session.execute(
            select(m.Product).where(m.Product.id.in_(product_ids), m.Product.team_id == store.team_id)
        )
        products_by_id = {p.id: p for p in products_result.scalars().all()}

        sale_items: list[m.SaleItem] = []
        subtotal = Decimal(0)
        for cart_item in data.items:
            product = products_by_id.get(cart_item.product_id)
            if product is None:
                msg = f"Product {cart_item.product_id} was not found in this business's catalog."
                raise ApplicationClientError(msg)
            if cart_item.quantity <= 0:
                msg = f"Quantity for {product.name} must be greater than zero."
                raise ApplicationClientError(msg)

            unit_price = cart_item.unit_price if cart_item.unit_price is not None else product.price
            line_total = _round_money(unit_price * cart_item.quantity)
            subtotal += line_total
            sale_items.append(
                m.SaleItem(
                    product_id=product.id,
                    product_name=product.name,
                    sku=product.sku,
                    unit_price=unit_price,
                    unit_cost=product.cost,
                    quantity=cart_item.quantity,
                    line_total=line_total,
                )
            )

            if product.track_inventory:
                inv_result = await session.execute(
                    select(m.Inventory).where(m.Inventory.store_id == store.id, m.Inventory.product_id == product.id)
                )
                inventory = inv_result.scalar_one_or_none()
                if inventory is None:
                    inventory = m.Inventory(store_id=store.id, product_id=product.id, quantity=0)
                    session.add(inventory)
                    await session.flush()
                if inventory.quantity < cart_item.quantity:
                    msg = f"Insufficient stock for {product.name}: {inventory.quantity} available."
                    raise ApplicationClientError(msg)
                inventory.quantity -= cart_item.quantity

        discount_amount = _round_money(data.discount_amount or Decimal(0))
        if discount_amount > subtotal:
            msg = "Discount cannot exceed the sale subtotal."
            raise ApplicationClientError(msg)
        taxable_amount = subtotal - discount_amount
        tax_amount = _round_money(taxable_amount * store.tax_rate)
        total = _round_money(taxable_amount + tax_amount)

        if not data.payments:
            msg = "At least one payment is required to complete a sale."
            raise ApplicationClientError(msg)
        payments = [m.Payment(method=p.method, amount=p.amount, reference=p.reference) for p in data.payments]
        paid_total = _round_money(sum((p.amount for p in payments), Decimal(0)))
        if paid_total < total:
            msg = f"Payment total {paid_total} is less than the sale total {total}."
            raise ApplicationClientError(msg)

        sale = m.Sale(
            store_id=store.id,
            cashier_id=cashier_id,
            customer_id=data.customer_id,
            sale_number=self._generate_sale_number(),
            status=m.SaleStatus.COMPLETED,
            subtotal=subtotal,
            discount_amount=discount_amount,
            tax_amount=tax_amount,
            total=total,
            notes=data.notes,
            items=sale_items,
            payments=payments,
        )
        return await self.create(sale)

    async def void(self, sale_id: UUID) -> m.Sale:
        """Void a completed sale and restock its items.

        Raises:
            ApplicationClientError: If the sale is not currently completed.

        Returns:
            The updated sale.
        """
        return await self._reverse(sale_id, m.SaleStatus.VOIDED)

    async def refund(self, sale_id: UUID) -> m.Sale:
        """Refund a completed sale and restock its items.

        Raises:
            ApplicationClientError: If the sale is not currently completed.

        Returns:
            The updated sale.
        """
        return await self._reverse(sale_id, m.SaleStatus.REFUNDED)

    async def _reverse(self, sale_id: UUID, new_status: str) -> m.Sale:
        sale = await self.get(sale_id)
        if sale.status != m.SaleStatus.COMPLETED:
            msg = f"Only completed sales can be marked as {new_status.lower()}; this sale is {sale.status.lower()}."
            raise ApplicationClientError(msg)
        session = self.repository.session
        for item in sale.items:
            if item.product_id is None:
                continue
            result = await session.execute(
                select(m.Inventory).where(
                    m.Inventory.store_id == sale.store_id, m.Inventory.product_id == item.product_id
                )
            )
            inventory = result.scalar_one_or_none()
            if inventory is not None:
                inventory.quantity += item.quantity
        sale.status = new_status
        await session.flush()
        await session.refresh(sale)
        return sale

    async def sales_summary(self, *, store_id: UUID, start: datetime, end: datetime) -> dict[str, object]:
        """Aggregate completed sales for a store within a time window.

        Returns:
            A dict of aggregate totals suitable for building a `SalesSummary` schema.
        """
        result = await self.repository.session.execute(
            select(
                func.count(m.Sale.id),
                func.coalesce(func.sum(m.Sale.subtotal), 0),
                func.coalesce(func.sum(m.Sale.discount_amount), 0),
                func.coalesce(func.sum(m.Sale.tax_amount), 0),
                func.coalesce(func.sum(m.Sale.total), 0),
            ).where(
                m.Sale.store_id == store_id,
                m.Sale.status == m.SaleStatus.COMPLETED,
                m.Sale.created_at >= start,
                m.Sale.created_at < end,
            )
        )
        count, gross, discount, tax, net = result.one()

        # Cost of goods sold has to be a separate query: joining SaleItem
        # into the aggregate above would fan out one Sale row per line item
        # and inflate gross_sales/discount_total/tax_total.
        cost_result = await self.repository.session.execute(
            select(func.coalesce(func.sum(m.SaleItem.unit_cost * m.SaleItem.quantity), 0))
            .join(m.Sale, m.Sale.id == m.SaleItem.sale_id)
            .where(
                m.Sale.store_id == store_id,
                m.Sale.status == m.SaleStatus.COMPLETED,
                m.Sale.created_at >= start,
                m.Sale.created_at < end,
            )
        )
        total_cost = Decimal(cost_result.scalar_one())
        net_sales = Decimal(net)

        return {
            "sale_count": int(count),
            "gross_sales": Decimal(gross),
            "discount_total": Decimal(discount),
            "tax_total": Decimal(tax),
            "net_sales": net_sales,
            "total_cost": total_cost,
            "gross_profit": net_sales - total_cost,
        }

    async def sales_breakdown(
        self, *, store_id: UUID, start: datetime, end: datetime, granularity: str
    ) -> list[dict[str, object]]:
        """Aggregate completed sales for a store within a time window, bucketed by day/week/month.

        Returns:
            A chronological list of per-bucket totals suitable for building `SalesBreakdownRow` rows.
        """
        bucket = func.date_trunc(granularity, m.Sale.created_at)
        result = await self.repository.session.execute(
            select(bucket, func.count(m.Sale.id), func.coalesce(func.sum(m.Sale.total), 0))
            .where(
                m.Sale.store_id == store_id,
                m.Sale.status == m.SaleStatus.COMPLETED,
                m.Sale.created_at >= start,
                m.Sale.created_at < end,
            )
            .group_by(bucket)
        )
        sales_by_bucket = {row[0]: (int(row[1]), Decimal(row[2])) for row in result.all()}

        cost_result = await self.repository.session.execute(
            select(bucket, func.coalesce(func.sum(m.SaleItem.unit_cost * m.SaleItem.quantity), 0))
            .join(m.Sale, m.Sale.id == m.SaleItem.sale_id)
            .where(
                m.Sale.store_id == store_id,
                m.Sale.status == m.SaleStatus.COMPLETED,
                m.Sale.created_at >= start,
                m.Sale.created_at < end,
            )
            .group_by(bucket)
        )
        cost_by_bucket = {row[0]: Decimal(row[1]) for row in cost_result.all()}

        rows = []
        for period_start in sorted(sales_by_bucket):
            sale_count, net_sales = sales_by_bucket[period_start]
            total_cost = cost_by_bucket.get(period_start, Decimal(0))
            rows.append(
                {
                    "period_start": period_start.isoformat(),
                    "sale_count": sale_count,
                    "net_sales": net_sales,
                    "total_cost": total_cost,
                    "gross_profit": net_sales - total_cost,
                }
            )
        return rows

    async def top_products(self, *, store_id: UUID, since: datetime, limit: int = 5) -> list[dict[str, object]]:
        """Return the best-selling products for a store since a given time.

        Returns:
            A list of dicts with product id/name, quantity sold, and revenue, ordered by revenue descending.
        """
        result = await self.repository.session.execute(
            select(
                m.SaleItem.product_id,
                m.SaleItem.product_name,
                func.sum(m.SaleItem.quantity),
                func.sum(m.SaleItem.line_total),
            )
            .join(m.Sale, m.Sale.id == m.SaleItem.sale_id)
            .where(
                m.Sale.store_id == store_id,
                m.Sale.status == m.SaleStatus.COMPLETED,
                m.Sale.created_at >= since,
            )
            .group_by(m.SaleItem.product_id, m.SaleItem.product_name)
            .order_by(func.sum(m.SaleItem.line_total).desc())
            .limit(limit)
        )
        return [
            {"product_id": product_id, "product_name": name, "quantity_sold": int(qty), "revenue": Decimal(revenue)}
            for product_id, name, qty, revenue in result.all()
        ]

    @staticmethod
    def _generate_sale_number() -> str:
        now = datetime.now(UTC)
        return f"S-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}"

    @staticmethod
    def day_bounds(reference: datetime | None = None) -> tuple[datetime, datetime]:
        """Return the start/end of the UTC day containing ``reference``.

        Returns:
            A (start, end) tuple of timezone-aware datetimes.
        """
        now = reference or datetime.now(UTC)
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return start, start + timedelta(days=1)

    @staticmethod
    def pick_breakdown_granularity(days: int) -> str:
        """Choose a sensible date_trunc bucket for a trailing-N-days window.

        Returns:
            "day" for short windows, "week" for medium ones, "month" for long ones.
        """
        if days <= BREAKDOWN_DAILY_MAX_DAYS:
            return "day"
        if days <= BREAKDOWN_WEEKLY_MAX_DAYS:
            return "week"
        return "month"
