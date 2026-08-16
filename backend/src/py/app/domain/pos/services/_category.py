from __future__ import annotations

from advanced_alchemy.extensions.litestar import repository, service

from app.db import models as m
from app.lib.service import AutoSlugServiceMixin


class CategoryService(AutoSlugServiceMixin[m.Category], service.SQLAlchemyAsyncRepositoryService[m.Category]):
    """Handles CRUD operations for Category resources."""

    class Repo(repository.SQLAlchemyAsyncSlugRepository[m.Category]):
        """Category Repository."""

        model_type = m.Category

    repository_type = Repo
    match_fields = ["name"]
