from __future__ import annotations

from advanced_alchemy.extensions.litestar import repository, service

from app.db import models as m
from app.lib.service import AutoSlugServiceMixin


class StoreService(AutoSlugServiceMixin[m.Store], service.SQLAlchemyAsyncRepositoryService[m.Store]):
    """Handles CRUD operations for Store resources."""

    class Repo(repository.SQLAlchemyAsyncSlugRepository[m.Store]):
        """Store Repository."""

        model_type = m.Store

    repository_type = Repo
    match_fields = ["name"]
