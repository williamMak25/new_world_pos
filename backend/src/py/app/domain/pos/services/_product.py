from __future__ import annotations

from advanced_alchemy.extensions.litestar import repository, service

from app.db import models as m
from app.lib.service import AutoSlugServiceMixin


class ProductService(AutoSlugServiceMixin[m.Product], service.SQLAlchemyAsyncRepositoryService[m.Product]):
    """Handles CRUD operations for Product resources."""

    class Repo(repository.SQLAlchemyAsyncSlugRepository[m.Product]):
        """Product Repository."""

        model_type = m.Product

    repository_type = Repo
    match_fields = ["sku", "name"]
