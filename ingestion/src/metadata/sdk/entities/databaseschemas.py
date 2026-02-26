"""DatabaseSchemas entity SDK with fluent API"""
from __future__ import annotations

from typing import Any, Dict, Type

from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.sdk.entities.base import BaseEntity
from metadata.sdk.types import UuidLike


class DatabaseSchemas(BaseEntity[DatabaseSchema, CreateDatabaseSchemaRequest]):
    """DatabaseSchemas SDK class - plural to avoid conflict with generated DatabaseSchema entity"""

    @classmethod
    def entity_type(cls) -> Type[DatabaseSchema]:
        """Return the DatabaseSchema entity type"""
        return DatabaseSchema

    @classmethod
    def get_profiler_config(cls, schema_id: UuidLike) -> Any:
        """Get the profiler configuration for a database schema."""
        client = cls._get_client()
        rest_client = cls._get_rest_client(client)
        endpoint = cls._get_endpoint_path(client)
        entity_id_str = cls._stringify_identifier(schema_id)
        return rest_client.get(f"{endpoint}/{entity_id_str}/profilerConfig")

    @classmethod
    def set_profiler_config(cls, schema_id: UuidLike, config: Dict[str, Any]) -> Any:
        """Set the profiler configuration for a database schema."""
        client = cls._get_client()
        rest_client = cls._get_rest_client(client)
        endpoint = cls._get_endpoint_path(client)
        entity_id_str = cls._stringify_identifier(schema_id)
        return rest_client.put(
            f"{endpoint}/{entity_id_str}/profilerConfig", json=config
        )

    @classmethod
    def delete_profiler_config(cls, schema_id: UuidLike) -> None:
        """Delete the profiler configuration for a database schema."""
        client = cls._get_client()
        rest_client = cls._get_rest_client(client)
        endpoint = cls._get_endpoint_path(client)
        entity_id_str = cls._stringify_identifier(schema_id)
        rest_client.delete(f"{endpoint}/{entity_id_str}/profilerConfig")
