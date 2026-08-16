from __future__ import annotations

from advanced_alchemy.extensions.litestar import repository, service

from app.db import models as m


class CustomerService(service.SQLAlchemyAsyncRepositoryService[m.Customer]):
    """Handles CRUD operations for Customer resources."""

    class Repo(repository.SQLAlchemyAsyncRepository[m.Customer]):
        """Customer Repository."""

        model_type = m.Customer

    repository_type = Repo
    match_fields = ["name", "email"]
