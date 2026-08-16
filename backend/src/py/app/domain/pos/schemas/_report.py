"""Reporting schemas."""

from decimal import Decimal
from uuid import UUID

from app.lib.schema import CamelizedBaseStruct


class SalesBreakdownRow(CamelizedBaseStruct):
    period_start: str
    sale_count: int
    net_sales: Decimal
    total_cost: Decimal
    gross_profit: Decimal


class SalesSummary(CamelizedBaseStruct):
    store_id: UUID
    period_start: str
    period_end: str
    sale_count: int
    gross_sales: Decimal
    discount_total: Decimal
    tax_total: Decimal
    net_sales: Decimal
    total_cost: Decimal
    gross_profit: Decimal
    breakdown_granularity: str
    breakdown: list[SalesBreakdownRow] = []


class TopProduct(CamelizedBaseStruct):
    product_name: str
    quantity_sold: int
    revenue: Decimal
    product_id: UUID | None


class LowStockItem(CamelizedBaseStruct):
    product_id: UUID
    product_name: str
    quantity: int
    low_stock_threshold: int
    sku: str | None


class StoreDashboard(CamelizedBaseStruct):
    store_id: UUID
    today_sales: Decimal
    today_sale_count: int
    week_sales: Decimal
    low_stock_count: int
    top_products: list[TopProduct] = []
    low_stock_items: list[LowStockItem] = []
