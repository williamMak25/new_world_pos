"""Sale (checkout, history, void/refund) controllers."""

from __future__ import annotations

from typing import TYPE_CHECKING, Annotated
from uuid import UUID

from litestar import Controller, get, post
from litestar.params import Dependency, Parameter
from sqlalchemy import select

from app.db import models as m
from app.domain.pos.guards import requires_store_access, requires_store_manager
from app.domain.pos.schemas import CheckoutRequest, Sale
from app.domain.pos.services import SaleService, StoreService
from app.lib.deps import create_service_dependencies

if TYPE_CHECKING:
    from advanced_alchemy.filters import FilterTypes
    from advanced_alchemy.service.pagination import OffsetPagination


class SaleController(Controller):
    """Point-of-sale transactions: checkout, history, voids and refunds."""

    tags = ["Sales"]
    dependencies = {
        **create_service_dependencies(
            SaleService,
            key="sales_service",
            filters={
                "id_filter": UUID,
                "search": "sale_number",
                "pagination_type": "limit_offset",
                "pagination_size": 25,
                "created_at": True,
                "updated_at": True,
                "sort_field": "created_at",
                "sort_order": "desc",
            },
        ),
        **create_service_dependencies(StoreService, key="stores_service"),
    }

    @get(
        operation_id="ListSales",
        path="/api/stores/{store_id:uuid}/sales",
        guards=[requires_store_access],
    )
    async def list_sales(
        self,
        sales_service: SaleService,
        store_id: Annotated[UUID, Parameter(title="Store ID")],
        filters: Annotated[list[FilterTypes], Dependency(skip_validation=True)],
        status: Annotated[m.SaleStatus | None, Parameter(title="Filter by sale status")] = None,
        payment_method: Annotated[
            m.PaymentMethod | None, Parameter(title="Filter by payment method used", query="paymentMethod")
        ] = None,
    ) -> OffsetPagination[Sale]:
        """List sales for a store, most recent first.

        Supports the generic `searchString` (matches sale number),
        `createdAfter`/`createdBefore` (date range), plus `status` and
        `paymentMethod` query params.

        Returns:
            A paginated list of sales.
        """
        extra_filters = [m.Sale.store_id == store_id]
        if status is not None:
            extra_filters.append(m.Sale.status == status)
        if payment_method is not None:
            extra_filters.append(m.Sale.id.in_(select(m.Payment.sale_id).where(m.Payment.method == payment_method)))
        results, total = await sales_service.list_and_count(*filters, *extra_filters)
        return sales_service.to_schema(results, total, filters, schema_type=Sale)

    @post(
        operation_id="Checkout",
        path="/api/stores/{store_id:uuid}/sales/checkout",
        guards=[requires_store_access],
    )
    async def checkout(
        self,
        sales_service: SaleService,
        stores_service: StoreService,
        current_user: m.User,
        store_id: Annotated[UUID, Parameter(title="Store ID")],
        data: CheckoutRequest,
    ) -> Sale:
        """Complete a sale: validate the cart, take payment, and decrement stock.

        Returns:
            The newly created sale, including its line items and payments.
        """
        store = await stores_service.get(store_id)
        sale = await sales_service.checkout(store=store, cashier_id=current_user.id, data=data)
        return sales_service.to_schema(sale, schema_type=Sale)

    @get(
        operation_id="GetSale",
        path="/api/stores/{store_id:uuid}/sales/{sale_id:uuid}",
        guards=[requires_store_access],
    )
    async def get_sale(
        self,
        sales_service: SaleService,
        sale_id: Annotated[UUID, Parameter(title="Sale ID")],
    ) -> Sale:
        """Get a sale's full receipt details.

        Returns:
            The requested sale.
        """
        db_obj = await sales_service.get(sale_id)
        return sales_service.to_schema(db_obj, schema_type=Sale)

    @post(
        operation_id="VoidSale",
        path="/api/stores/{store_id:uuid}/sales/{sale_id:uuid}/void",
        guards=[requires_store_manager],
    )
    async def void_sale(
        self,
        sales_service: SaleService,
        sale_id: Annotated[UUID, Parameter(title="Sale ID")],
    ) -> Sale:
        """Void a completed sale and restock its items.

        Returns:
            The updated sale.
        """
        sale = await sales_service.void(sale_id)
        return sales_service.to_schema(sale, schema_type=Sale)

    @post(
        operation_id="RefundSale",
        path="/api/stores/{store_id:uuid}/sales/{sale_id:uuid}/refund",
        guards=[requires_store_manager],
    )
    async def refund_sale(
        self,
        sales_service: SaleService,
        sale_id: Annotated[UUID, Parameter(title="Sale ID")],
    ) -> Sale:
        """Refund a completed sale and restock its items.

        Returns:
            The updated sale.
        """
        sale = await sales_service.refund(sale_id)
        return sales_service.to_schema(sale, schema_type=Sale)
