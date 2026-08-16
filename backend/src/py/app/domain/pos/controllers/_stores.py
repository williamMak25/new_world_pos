"""Store controllers."""

from __future__ import annotations

from typing import TYPE_CHECKING, Annotated
from uuid import UUID

from litestar import Controller, delete, get, patch, post
from litestar.params import Dependency, Parameter

from app.db import models as m
from app.domain.pos.guards import requires_store_access, requires_store_admin, requires_store_manager
from app.domain.pos.schemas import Store, StoreCreate, StoreUpdate
from app.domain.pos.services import StoreService
from app.domain.teams.guards import requires_team_admin, requires_team_membership
from app.lib.deps import create_service_dependencies

if TYPE_CHECKING:
    from advanced_alchemy.filters import FilterTypes
    from advanced_alchemy.service.pagination import OffsetPagination


class StoreController(Controller):
    """Store locations belonging to a business."""

    tags = ["Stores"]
    dependencies = create_service_dependencies(
        StoreService,
        key="stores_service",
        filters={
            "id_filter": UUID,
            "search": "name",
            "pagination_type": "limit_offset",
            "pagination_size": 50,
            "created_at": True,
            "updated_at": True,
            "sort_field": "name",
            "sort_order": "asc",
        },
    )

    @get(
        operation_id="ListStores",
        path="/api/teams/{team_id:uuid}/stores",
        guards=[requires_team_membership],
    )
    async def list_stores(
        self,
        stores_service: StoreService,
        team_id: Annotated[UUID, Parameter(title="Team ID")],
        filters: Annotated[list[FilterTypes], Dependency(skip_validation=True)],
    ) -> OffsetPagination[Store]:
        """List the store locations belonging to a business.

        Returns:
            A paginated list of stores.
        """
        results, total = await stores_service.list_and_count(*filters, m.Store.team_id == team_id)
        return stores_service.to_schema(results, total, filters, schema_type=Store)

    @post(
        operation_id="CreateStore",
        path="/api/teams/{team_id:uuid}/stores",
        guards=[requires_team_admin],
    )
    async def create_store(
        self,
        stores_service: StoreService,
        team_id: Annotated[UUID, Parameter(title="Team ID")],
        data: StoreCreate,
    ) -> Store:
        """Create a new store location for a business.

        Returns:
            The newly created store.
        """
        obj = data.to_dict()
        obj["team_id"] = team_id
        db_obj = await stores_service.create(obj)
        return stores_service.to_schema(db_obj, schema_type=Store)

    @get(
        operation_id="GetStore",
        path="/api/stores/{store_id:uuid}",
        guards=[requires_store_access],
    )
    async def get_store(
        self,
        stores_service: StoreService,
        store_id: Annotated[UUID, Parameter(title="Store ID")],
    ) -> Store:
        """Get details about a store.

        Returns:
            The requested store.
        """
        db_obj = await stores_service.get(store_id)
        return stores_service.to_schema(db_obj, schema_type=Store)

    @patch(
        operation_id="UpdateStore",
        path="/api/stores/{store_id:uuid}",
        guards=[requires_store_manager],
    )
    async def update_store(
        self,
        stores_service: StoreService,
        store_id: Annotated[UUID, Parameter(title="Store ID")],
        data: StoreUpdate,
    ) -> Store:
        """Update a store's details.

        Returns:
            The updated store.
        """
        db_obj = await stores_service.update(item_id=store_id, data=data.to_dict())
        return stores_service.to_schema(db_obj, schema_type=Store)

    @delete(
        operation_id="DeleteStore",
        path="/api/stores/{store_id:uuid}",
        guards=[requires_store_admin],
        return_dto=None,
    )
    async def delete_store(
        self,
        stores_service: StoreService,
        store_id: Annotated[UUID, Parameter(title="Store ID")],
    ) -> None:
        """Delete a store location. Only business admins may do this."""
        _ = await stores_service.delete(store_id)
