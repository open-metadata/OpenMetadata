"""DatabaseServices entity SDK."""
from __future__ import annotations

from typing import Type

from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.sdk.entities.base import BaseEntity


class DatabaseServices(BaseEntity[DatabaseService, CreateDatabaseServiceRequest]):
    """Fluent facade for database service operations."""

    @classmethod
    def entity_type(cls) -> Type[DatabaseService]:
        return DatabaseService
