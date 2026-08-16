"""Reporting controllers."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from litestar import Controller, get
from litestar.params import Parameter

from app.domain.pos.guards import requires_store_access, requires_store_manager
from app.domain.pos.schemas import LowStockItem, SalesBreakdownRow, SalesSummary, StoreDashboard, TopProduct
from app.domain.pos.services import InventoryService, SaleService
from app.lib.deps import create_service_dependencies


class ReportController(Controller):
    """Store-level dashboards and sales reporting."""

    tags = ["Reports"]
    dependencies = {
        **create_service_dependencies(SaleService, key="sales_service"),
        **create_service_dependencies(InventoryService, key="inventory_service"),
    }

    @get(
        operation_id="GetStoreDashboard",
        path="/api/stores/{store_id:uuid}/reports/dashboard",
        guards=[requires_store_access],
    )
    async def get_dashboard(
        self,
        sales_service: SaleService,
        inventory_service: InventoryService,
        store_id: Annotated[UUID, Parameter(title="Store ID")],
    ) -> StoreDashboard:
        """Summarize today's and this week's sales, top products, and low stock for a store.

        Returns:
            A dashboard summary for the store.
        """
        today_start, today_end = sales_service.day_bounds()
        week_start = today_start - timedelta(days=today_start.weekday())

        today_summary = await sales_service.sales_summary(store_id=store_id, start=today_start, end=today_end)
        week_summary = await sales_service.sales_summary(store_id=store_id, start=week_start, end=today_end)
        top = await sales_service.top_products(store_id=store_id, since=today_start - timedelta(days=30), limit=5)
        low_stock_records = await inventory_service.low_stock(store_id=store_id)

        return StoreDashboard(
            store_id=store_id,
            today_sales=today_summary["net_sales"],  # type: ignore[arg-type]
            today_sale_count=today_summary["sale_count"],  # type: ignore[arg-type]
            week_sales=week_summary["net_sales"],  # type: ignore[arg-type]
            low_stock_count=len(low_stock_records),
            top_products=[
                TopProduct(
                    product_id=row["product_id"],  # type: ignore[arg-type]
                    product_name=row["product_name"],  # type: ignore[arg-type]
                    quantity_sold=row["quantity_sold"],  # type: ignore[arg-type]
                    revenue=row["revenue"],  # type: ignore[arg-type]
                )
                for row in top
            ],
            low_stock_items=[
                LowStockItem(
                    product_id=r.product_id,
                    product_name=r.product.name if r.product else "",
                    sku=r.product.sku if r.product else None,
                    quantity=r.quantity,
                    low_stock_threshold=r.low_stock_threshold,
                )
                for r in low_stock_records
            ],
        )

    @get(
        operation_id="GetSalesSummary",
        path="/api/stores/{store_id:uuid}/reports/sales-summary",
        guards=[requires_store_manager],
    )
    async def get_sales_summary(
        self,
        sales_service: SaleService,
        store_id: Annotated[UUID, Parameter(title="Store ID")],
        days: Annotated[int, Parameter(title="Number of trailing days to summarize", ge=1, le=365)] = 7,
    ) -> SalesSummary:
        """Summarize completed sales for a store over the trailing N days, including cost of goods sold.

        Cost/margin data is more sensitive than plain revenue, so this is
        restricted to ADMIN/MANAGER (unlike the revenue-only dashboard,
        which any store role can view).

        Returns:
            Aggregate sales, cost, and profit totals for the requested period.
        """
        end = datetime.now(UTC)
        start = end - timedelta(days=days)
        summary = await sales_service.sales_summary(store_id=store_id, start=start, end=end)
        granularity = sales_service.pick_breakdown_granularity(days)
        breakdown = await sales_service.sales_breakdown(
            store_id=store_id, start=start, end=end, granularity=granularity
        )
        return SalesSummary(
            store_id=store_id,
            period_start=start.isoformat(),
            period_end=end.isoformat(),
            breakdown_granularity=granularity,
            breakdown=[SalesBreakdownRow(**row) for row in breakdown],  # type: ignore[arg-type]
            **summary,  # type: ignore[arg-type]
        )
