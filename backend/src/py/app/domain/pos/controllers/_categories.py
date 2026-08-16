"""Category controllers."""

from __future__ import annotations

from typing import TYPE_CHECKING, Annotated
from uuid import UUID

from litestar import Controller, delete, get, patch, post
from litestar.params import Dependency, Parameter

from app.db import models as m
from app.domain.pos.guards import requires_team_catalog_access, requires_team_manager_access
from app.domain.pos.schemas import Category, CategoryCreate, CategoryUpdate
from app.domain.pos.services import CategoryService
from app.lib.deps import create_service_dependencies

if TYPE_CHECKING:
    from advanced_alchemy.filters import FilterTypes
    from advanced_alchemy.service.pagination import OffsetPagination


class CategoryController(Controller):
    """Product categories, shared across a business's stores."""

    tags = ["Categories"]
    dependencies = create_service_dependencies(
        CategoryService,
        key="categories_service",
        filters={
            "id_filter": UUID,
            "search": "name",
            "pagination_type": "limit_offset",
            "pagination_size": 100,
            "created_at": True,
            "updated_at": True,
            "sort_field": "name",
            "sort_order": "asc",
        },
    )

    @get(
        operation_id="ListCategories",
        path="/api/teams/{team_id:uuid}/categories",
        guards=[requires_team_catalog_access],
    )
    async def list_categories(
        self,
        categories_service: CategoryService,
        team_id: Annotated[UUID, Parameter(title="Team ID")],
        filters: Annotated[list[FilterTypes], Dependency(skip_validation=True)],
    ) -> OffsetPagination[Category]:
        """List categories for a business.

        Returns:
            A paginated list of categories.
        """
        results, total = await categories_service.list_and_count(*filters, m.Category.team_id == team_id)
        return categories_service.to_schema(results, total, filters, schema_type=Category)

    @post(
        operation_id="CreateCategory",
        path="/api/teams/{team_id:uuid}/categories",
        guards=[requires_team_manager_access],
    )
    async def create_category(
        self,
        categories_service: CategoryService,
        team_id: Annotated[UUID, Parameter(title="Team ID")],
        data: CategoryCreate,
    ) -> Category:
        """Create a new category.

        Returns:
            The newly created category.
        """
        obj = data.to_dict()
        obj["team_id"] = team_id
        db_obj = await categories_service.create(obj)
        return categories_service.to_schema(db_obj, schema_type=Category)

    @patch(
        operation_id="UpdateCategory",
        path="/api/teams/{team_id:uuid}/categories/{category_id:uuid}",
        guards=[requires_team_manager_access],
    )
    async def update_category(
        self,
        categories_service: CategoryService,
        category_id: Annotated[UUID, Parameter(title="Category ID")],
        data: CategoryUpdate,
    ) -> Category:
        """Update a category.

        Returns:
            The updated category.
        """
        db_obj = await categories_service.update(item_id=category_id, data=data.to_dict())
        return categories_service.to_schema(db_obj, schema_type=Category)

    @delete(
        operation_id="DeleteCategory",
        path="/api/teams/{team_id:uuid}/categories/{category_id:uuid}",
        guards=[requires_team_manager_access],
        return_dto=None,
    )
    async def delete_category(
        self,
        categories_service: CategoryService,
        category_id: Annotated[UUID, Parameter(title="Category ID")],
    ) -> None:
        """Delete a category. Products in this category keep their history but lose the category link."""
        _ = await categories_service.delete(category_id)
