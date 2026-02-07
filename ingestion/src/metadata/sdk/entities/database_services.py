"""DatabaseServices entity SDK."""
from __future__ import annotations

from typing import Any, Dict, Type

from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.sdk.entities.base import BaseEntity
from metadata.sdk.types import UuidLike


class DatabaseServices(BaseEntity[DatabaseService, CreateDatabaseServiceRequest]):
    """Fluent facade for database service operations."""

    @classmethod
    def entity_type(cls) -> Type[DatabaseService]:
        return DatabaseService

    @classmethod
    def add_test_connection_result(
        cls, service_id: UuidLike, result: Dict[str, Any]
    ) -> Any:
        """Add a test connection result to a database service."""
        client = cls._get_client()
        rest_client = cls._get_rest_client(client)
        endpoint = cls._get_endpoint_path(client)
        entity_id_str = cls._stringify_identifier(service_id)
        return rest_client.put(
            f"{endpoint}/{entity_id_str}/testConnectionResult", json=result
        )
