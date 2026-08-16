"""Customer controllers."""

from __future__ import annotations

from typing import TYPE_CHECKING, Annotated
from uuid import UUID

from litestar import Controller, delete, get, patch, post
from litestar.params import Dependency, Parameter

from app.db import models as m
from app.domain.pos.guards import requires_team_catalog_access, requires_team_manager_access
from app.domain.pos.schemas import Customer, CustomerCreate, CustomerUpdate
from app.domain.pos.services import CustomerService
from app.lib.deps import create_service_dependencies

if TYPE_CHECKING:
    from advanced_alchemy.filters import FilterTypes
    from advanced_alchemy.service.pagination import OffsetPagination


class CustomerController(Controller):
    """Customers of a business, shared across its stores."""

    tags = ["Customers"]
    dependencies = create_service_dependencies(
        CustomerService,
        key="customers_service",
        filters={
            "id_filter": UUID,
            "search": "name,email,phone",
            "pagination_type": "limit_offset",
            "pagination_size": 50,
            "created_at": True,
            "updated_at": True,
            "sort_field": "name",
            "sort_order": "asc",
        },
    )

    @get(
        operation_id="ListCustomers",
        path="/api/teams/{team_id:uuid}/customers",
        guards=[requires_team_catalog_access],
    )
    async def list_customers(
        self,
        customers_service: CustomerService,
        team_id: Annotated[UUID, Parameter(title="Team ID")],
        filters: Annotated[list[FilterTypes], Dependency(skip_validation=True)],
    ) -> OffsetPagination[Customer]:
        """List customers for a business.

        Returns:
            A paginated list of customers.
        """
        results, total = await customers_service.list_and_count(*filters, m.Customer.team_id == team_id)
        return customers_service.to_schema(results, total, filters, schema_type=Customer)

    @post(
        operation_id="CreateCustomer",
        path="/api/teams/{team_id:uuid}/customers",
        guards=[requires_team_catalog_access],
    )
    async def create_customer(
        self,
        customers_service: CustomerService,
        team_id: Annotated[UUID, Parameter(title="Team ID")],
        data: CustomerCreate,
    ) -> Customer:
        """Create a new customer record.

        Returns:
            The newly created customer.
        """
        obj = data.to_dict()
        obj["team_id"] = team_id
        db_obj = await customers_service.create(obj)
        return customers_service.to_schema(db_obj, schema_type=Customer)

    @get(
        operation_id="GetCustomer",
        path="/api/teams/{team_id:uuid}/customers/{customer_id:uuid}",
        guards=[requires_team_catalog_access],
    )
    async def get_customer(
        self,
        customers_service: CustomerService,
        customer_id: Annotated[UUID, Parameter(title="Customer ID")],
    ) -> Customer:
        """Get details about a customer.

        Returns:
            The requested customer.
        """
        db_obj = await customers_service.get(customer_id)
        return customers_service.to_schema(db_obj, schema_type=Customer)

    @patch(
        operation_id="UpdateCustomer",
        path="/api/teams/{team_id:uuid}/customers/{customer_id:uuid}",
        guards=[requires_team_catalog_access],
    )
    async def update_customer(
        self,
        customers_service: CustomerService,
        customer_id: Annotated[UUID, Parameter(title="Customer ID")],
        data: CustomerUpdate,
    ) -> Customer:
        """Update a customer's details.

        Returns:
            The updated customer.
        """
        db_obj = await customers_service.update(item_id=customer_id, data=data.to_dict())
        return customers_service.to_schema(db_obj, schema_type=Customer)

    @delete(
        operation_id="DeleteCustomer",
        path="/api/teams/{team_id:uuid}/customers/{customer_id:uuid}",
        guards=[requires_team_manager_access],
        return_dto=None,
    )
    async def delete_customer(
        self,
        customers_service: CustomerService,
        customer_id: Annotated[UUID, Parameter(title="Customer ID")],
    ) -> None:
        """Delete a customer record."""
        _ = await customers_service.delete(customer_id)
