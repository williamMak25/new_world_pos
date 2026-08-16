"""Product controllers."""

from __future__ import annotations

from typing import TYPE_CHECKING, Annotated
from uuid import UUID

from litestar import Controller, delete, get, patch, post
from litestar.params import Dependency, Parameter
from sqlalchemy.orm import selectinload

from app.db import models as m
from app.domain.pos.guards import requires_team_catalog_access, requires_team_manager_access
from app.domain.pos.schemas import Product, ProductCreate, ProductUpdate
from app.domain.pos.services import ProductService
from app.lib.deps import create_service_dependencies

if TYPE_CHECKING:
    from advanced_alchemy.filters import FilterTypes
    from advanced_alchemy.service.pagination import OffsetPagination


class ProductController(Controller):
    """Sellable products in a business's shared catalog."""

    tags = ["Products"]
    dependencies = create_service_dependencies(
        ProductService,
        key="products_service",
        load=[selectinload(m.Product.category)],
        filters={
            "id_filter": UUID,
            "search": "name,sku,barcode",
            "pagination_type": "limit_offset",
            "pagination_size": 50,
            "created_at": True,
            "updated_at": True,
            "sort_field": "name",
            "sort_order": "asc",
        },
    )

    @get(
        operation_id="ListProducts",
        path="/api/teams/{team_id:uuid}/products",
        guards=[requires_team_catalog_access],
    )
    async def list_products(
        self,
        products_service: ProductService,
        team_id: Annotated[UUID, Parameter(title="Team ID")],
        filters: Annotated[list[FilterTypes], Dependency(skip_validation=True)],
    ) -> OffsetPagination[Product]:
        """List products in a business's catalog.

        Returns:
            A paginated list of products.
        """
        results, total = await products_service.list_and_count(*filters, m.Product.team_id == team_id)
        return products_service.to_schema(results, total, filters, schema_type=Product)

    @post(
        operation_id="CreateProduct",
        path="/api/teams/{team_id:uuid}/products",
        guards=[requires_team_manager_access],
    )
    async def create_product(
        self,
        products_service: ProductService,
        team_id: Annotated[UUID, Parameter(title="Team ID")],
        data: ProductCreate,
    ) -> Product:
        """Create a new product.

        Returns:
            The newly created product.
        """
        obj = data.to_dict()
        obj["team_id"] = team_id
        db_obj = await products_service.create(obj)
        return products_service.to_schema(db_obj, schema_type=Product)

    @get(
        operation_id="GetProduct",
        path="/api/teams/{team_id:uuid}/products/{product_id:uuid}",
        guards=[requires_team_catalog_access],
    )
    async def get_product(
        self,
        products_service: ProductService,
        product_id: Annotated[UUID, Parameter(title="Product ID")],
    ) -> Product:
        """Get details about a product.

        Returns:
            The requested product.
        """
        db_obj = await products_service.get(product_id)
        return products_service.to_schema(db_obj, schema_type=Product)

    @patch(
        operation_id="UpdateProduct",
        path="/api/teams/{team_id:uuid}/products/{product_id:uuid}",
        guards=[requires_team_manager_access],
    )
    async def update_product(
        self,
        products_service: ProductService,
        product_id: Annotated[UUID, Parameter(title="Product ID")],
        data: ProductUpdate,
    ) -> Product:
        """Update a product.

        Returns:
            The updated product.
        """
        db_obj = await products_service.update(item_id=product_id, data=data.to_dict())
        return products_service.to_schema(db_obj, schema_type=Product)

    @delete(
        operation_id="DeleteProduct",
        path="/api/teams/{team_id:uuid}/products/{product_id:uuid}",
        guards=[requires_team_manager_access],
        return_dto=None,
    )
    async def delete_product(
        self,
        products_service: ProductService,
        product_id: Annotated[UUID, Parameter(title="Product ID")],
    ) -> None:
        """Delete a product. Past sales retain a snapshot of the product's name/price."""
        _ = await products_service.delete(product_id)
