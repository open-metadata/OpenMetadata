"""Databases entity SDK with fluent API"""
from __future__ import annotations

from typing import Any, Dict, Type

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.sdk.entities.base import BaseEntity
from metadata.sdk.types import UuidLike


class Databases(BaseEntity[Database, CreateDatabaseRequest]):
    """Databases SDK class - plural to avoid conflict with generated Database entity"""

    @classmethod
    def entity_type(cls) -> Type[Database]:
        """Return the Database entity type"""
        return Database

    @classmethod
    def get_profiler_config(cls, database_id: UuidLike) -> Any:
        """Get the profiler configuration for a database."""
        client = cls._get_client()
        rest_client = cls._get_rest_client(client)
        endpoint = cls._get_endpoint_path(client)
        entity_id_str = cls._stringify_identifier(database_id)
        return rest_client.get(f"{endpoint}/{entity_id_str}/profilerConfig")

    @classmethod
    def set_profiler_config(cls, database_id: UuidLike, config: Dict[str, Any]) -> Any:
        """Set the profiler configuration for a database."""
        client = cls._get_client()
        rest_client = cls._get_rest_client(client)
        endpoint = cls._get_endpoint_path(client)
        entity_id_str = cls._stringify_identifier(database_id)
        return rest_client.put(
            f"{endpoint}/{entity_id_str}/profilerConfig", json=config
        )

    @classmethod
    def delete_profiler_config(cls, database_id: UuidLike) -> None:
        """Delete the profiler configuration for a database."""
        client = cls._get_client()
        rest_client = cls._get_rest_client(client)
        endpoint = cls._get_endpoint_path(client)
        entity_id_str = cls._stringify_identifier(database_id)
        rest_client.delete(f"{endpoint}/{entity_id_str}/profilerConfig")
