"""
Base entity class with common CRUD operations for all entities.
This provides a clean API that avoids conflicts with Pydantic models.
Enhanced with improved list operations, CSV import/export with async and WebSocket support.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, ClassVar, Dict, Generic, List, Optional, Type, TypeVar, Union
from uuid import UUID

from pydantic import BaseModel

from metadata.ingestion.ometa.ometa_api import OpenMetadata as OMeta
from metadata.sdk.client import OpenMetadata
from metadata.sdk.entities.csv_operations import BaseCsvExporter, BaseCsvImporter

# Type variables for generic entity types
TEntity = TypeVar("TEntity", bound=BaseModel)
TCreateRequest = TypeVar("TCreateRequest", bound=BaseModel)


@dataclass
class ListResponse:
    """Response wrapper for list operations with pagination"""

    entities: List[TEntity]
    total: Optional[int] = None
    after: Optional[str] = None
    before: Optional[str] = None


class BaseEntity(ABC, Generic[TEntity, TCreateRequest]):
    """
    Base class for all entity wrappers.
    Provides common CRUD operations following the Java SDK pattern.
    """

    _default_client: ClassVar[Optional[OMeta]] = None

    @classmethod
    @abstractmethod
    def entity_type(cls) -> Type[TEntity]:
        """Return the Pydantic entity type this wrapper handles"""
        pass

    @classmethod
    def set_default_client(cls, client: Union[OpenMetadata, OMeta]) -> None:
        """Set the default client for static methods"""
        if isinstance(client, OpenMetadata):
            cls._default_client = client.ometa
        else:
            cls._default_client = client

    @classmethod
    def _get_client(cls) -> OMeta:
        """Get the default client, initializing if needed"""
        if cls._default_client is None:
            cls._default_client = OpenMetadata.get_default_client()
        return cls._default_client

    @classmethod
    def create(cls, request: Union[TCreateRequest, TEntity]) -> TEntity:
        """
        Create a new entity.

        Args:
            request: CreateRequest object or Entity object

        Returns:
            Created entity
        """
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(cls, entity_id: str, fields: Optional[List[str]] = None) -> TEntity:
        """
        Retrieve an entity by ID.

        Args:
            entity_id: Entity UUID
            fields: Optional list of fields to include

        Returns:
            Retrieved entity
        """
        client = cls._get_client()
        return client.get_by_id(
            entity=cls.entity_type(), entity_id=entity_id, fields=fields
        )

    @classmethod
    def retrieve_by_name(cls, fqn: str, fields: Optional[List[str]] = None) -> TEntity:
        """
        Retrieve an entity by fully qualified name.

        Args:
            fqn: Fully qualified name
            fields: Optional list of fields to include

        Returns:
            Retrieved entity
        """
        client = cls._get_client()
        return client.get_by_name(entity=cls.entity_type(), fqn=fqn, fields=fields)

    @classmethod
    def update(cls, entity: TEntity) -> TEntity:
        """
        Update an entity (uses PATCH internally for efficiency).

        Args:
            entity: Modified entity object with ID

        Returns:
            Updated entity

        Note: This method automatically generates a PATCH request
              by comparing the entity with its current state
        """
        if not hasattr(entity, "id") or not entity.id:
            raise ValueError("Entity must have an ID for update")

        client = cls._get_client()

        # Get entity ID as string
        entity_id = (
            str(entity.id.root) if hasattr(entity.id, "root") else str(entity.id)
        )

        # Following Java SDK pattern:
        # 1. Get the current entity state from the server
        # 2. Use the ometa patch method which generates JSON Patch internally

        # Fetch current state of the entity
        current = client.get_by_id(
            entity=cls.entity_type(),
            entity_id=entity_id
            # Don't specify fields to avoid getting computed fields
        )

        # The ometa.patch method generates JSON Patch by comparing source and destination
        # source = current state (from server)
        # destination = desired state (modified entity)
        return client.patch(
            entity=cls.entity_type(),
            source=current,  # Current state from server
            destination=entity,  # Desired state with changes
            skip_on_failure=False,  # Raise errors for debugging
        )

    @classmethod
    def delete(
        cls, entity_id: str, recursive: bool = False, hard_delete: bool = False
    ) -> None:
        """
        Delete an entity.

        Args:
            entity_id: Entity UUID
            recursive: Delete recursively
            hard_delete: Hard delete (permanent)
        """
        client = cls._get_client()
        client.delete(
            entity=cls.entity_type(),
            entity_id=entity_id,
            recursive=recursive,
            hard_delete=hard_delete,
        )

    @classmethod
    def list(
        cls,
        fields: Optional[List[str]] = None,
        after: Optional[str] = None,
        before: Optional[str] = None,
        limit: int = 10,
        filters: Optional[Dict[str, Any]] = None,
    ) -> ListResponse:
        """
        List entities with pagination.

        Args:
            fields: Optional list of fields to include
            after: Pagination cursor for next page
            before: Pagination cursor for previous page
            limit: Number of entities to return
            filters: Optional filters to apply

        Returns:
            ListResponse with entities and pagination info
        """
        client = cls._get_client()
        response = client.list_entities(
            entity=cls.entity_type(),
            fields=fields,
            after=after,
            before=before,
            limit=limit,
        )

        return ListResponse(
            entities=response.entities,
            total=getattr(response, "total", None),
            after=getattr(response, "after", None),
            before=getattr(response, "before", None),
        )

    @classmethod
    def list_all(
        cls,
        fields: Optional[List[str]] = None,
        filters: Optional[Dict[str, Any]] = None,
        batch_size: int = 100,
    ) -> List[TEntity]:
        """
        List all entities, automatically handling pagination.

        Args:
            fields: Optional list of fields to include
            filters: Optional filters to apply
            batch_size: Number of entities per batch

        Returns:
            Complete list of all entities
        """
        all_entities = []
        after = None

        while True:
            response = cls.list(
                fields=fields, after=after, limit=batch_size, filters=filters
            )

            all_entities.extend(response.entities)

            if not response.after or len(response.entities) < batch_size:
                break

            after = response.after

        return all_entities

    @classmethod
    def search(
        cls,
        query: str,
        fields: Optional[List[str]] = None,
        size: int = 10,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[TEntity]:
        """
        Search for entities.

        Args:
            query: Search query string
            fields: Optional list of fields to include
            size: Number of results to return
            filters: Optional filters

        Returns:
            List of matching entities
        """
        client = cls._get_client()
        # This would need to be implemented in the OMeta client
        # For now, return empty list as placeholder
        return []

    @classmethod
    def export_csv(cls, name: str) -> BaseCsvExporter:
        """
        Create a CSV exporter for this entity.

        Args:
            name: Entity name for export

        Returns:
            CsvExporter instance for fluent configuration
        """
        entity_type = cls.entity_type()

        class EntityCsvExporter(BaseCsvExporter):
            """CSV exporter with entity-specific operations"""

            def perform_sync_export(self) -> str:
                """Perform synchronous CSV export"""
                client = cls._get_client()
                return client.export_csv(entity=entity_type, name=name)

            def perform_async_export(self) -> str:
                """Perform asynchronous CSV export"""
                client = cls._get_client()
                return client.export_csv_async(entity=entity_type, name=name)

        return EntityCsvExporter(cls._get_client(), name)

    @classmethod
    def import_csv(cls, name: str) -> BaseCsvImporter:
        """
        Create a CSV importer for this entity.

        Args:
            name: Entity name for import

        Returns:
            CsvImporter instance for fluent configuration
        """
        entity_type = cls.entity_type()

        class EntityCsvImporter(BaseCsvImporter):
            """CSV importer with entity-specific operations"""

            def perform_sync_import(self) -> Dict:
                """Perform synchronous CSV import"""
                client = cls._get_client()
                return client.import_csv(
                    entity=entity_type,
                    name=name,
                    csv_data=self.csv_data,
                    dry_run=self.dry_run,
                )

            def perform_async_import(self) -> str:
                """Perform asynchronous CSV import"""
                client = cls._get_client()
                return client.import_csv_async(
                    entity=entity_type,
                    name=name,
                    csv_data=self.csv_data,
                    dry_run=self.dry_run,
                )

        return EntityCsvImporter(cls._get_client(), name)

    @classmethod
    def update_custom_properties(
        cls, entity_id: Union[str, UUID]
    ) -> "CustomPropertyUpdater":
        """
        Update custom properties on an entity by ID.

        Args:
            entity_id: The entity UUID

        Returns:
            CustomPropertyUpdater instance for fluent configuration
        """
        from metadata.sdk.entities.custom_properties import CustomProperties

        return CustomProperties.update(cls.entity_type(), entity_id, cls._get_client())

    @classmethod
    def update_custom_properties_by_name(
        cls, entity_name: str
    ) -> "CustomPropertyUpdater":
        """
        Update custom properties on an entity by name/FQN.

        Args:
            entity_name: The entity name or FQN

        Returns:
            CustomPropertyUpdater instance for fluent configuration
        """
        from metadata.sdk.entities.custom_properties import CustomProperties

        return CustomProperties.update_by_name(
            cls.entity_type(), entity_name, cls._get_client()
        )
