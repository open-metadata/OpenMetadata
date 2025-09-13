"""
Base entity class with common CRUD operations for all entities.
This provides a clean API that avoids conflicts with Pydantic models.
"""
import asyncio
from abc import ABC, abstractmethod
from typing import Any, ClassVar, Dict, Generic, List, Optional, Type, TypeVar, Union

from pydantic import BaseModel

from metadata.ingestion.ometa.ometa_api import OpenMetadata as OMeta
from metadata.sdk.client import OpenMetadata

# Type variables for generic entity types
TEntity = TypeVar("TEntity", bound=BaseModel)
TCreateRequest = TypeVar("TCreateRequest", bound=BaseModel)


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
    def update(cls, entity_id: str, entity: TEntity) -> TEntity:
        """
        Update an entity (PUT operation).

        Args:
            entity_id: Entity UUID
            entity: Updated entity object

        Returns:
            Updated entity
        """
        client = cls._get_client()
        entity.id = entity_id
        return client.create_or_update(entity)

    @classmethod
    def patch(cls, entity_id: str, json_patch: List[Dict[str, Any]]) -> TEntity:
        """
        Apply JSON patch to an entity (PATCH operation).

        Args:
            entity_id: Entity UUID
            json_patch: JSON patch operations

        Returns:
            Patched entity
        """
        client = cls._get_client()
        return client.patch(
            entity=cls.entity_type(), entity_id=entity_id, json_patch=json_patch
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
    ) -> List[TEntity]:
        """
        List entities with pagination.

        Args:
            fields: Optional list of fields to include
            after: Pagination cursor for next page
            before: Pagination cursor for previous page
            limit: Number of entities to return

        Returns:
            List of entities
        """
        client = cls._get_client()
        return client.list_entities(
            entity=cls.entity_type(),
            fields=fields,
            after=after,
            before=before,
            limit=limit,
        ).entities

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
    def export_csv(cls, name: str) -> str:
        """
        Export entity metadata to CSV.

        Args:
            name: Export name

        Returns:
            CSV data as string
        """
        client = cls._get_client()
        return client.export_csv(entity=cls.entity_type(), name=name)

    @classmethod
    def import_csv(cls, csv_data: str, dry_run: bool = False) -> str:
        """
        Import entity metadata from CSV.

        Args:
            csv_data: CSV data as string
            dry_run: Perform dry run without actual import

        Returns:
            Import status
        """
        client = cls._get_client()
        return client.import_csv(
            entity=cls.entity_type(), csv_data=csv_data, dry_run=dry_run
        )

    # Async methods using asyncio
    @classmethod
    async def create_async(cls, request: Union[TCreateRequest, TEntity]) -> TEntity:
        """Async create an entity"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls.create, request)

    @classmethod
    async def retrieve_async(
        cls, entity_id: str, fields: Optional[List[str]] = None
    ) -> TEntity:
        """Async retrieve an entity"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls.retrieve, entity_id, fields)

    @classmethod
    async def retrieve_by_name_async(
        cls, fqn: str, fields: Optional[List[str]] = None
    ) -> TEntity:
        """Async retrieve an entity by name"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls.retrieve_by_name, fqn, fields)

    @classmethod
    async def update_async(cls, entity_id: str, entity: TEntity) -> TEntity:
        """Async update an entity"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls.update, entity_id, entity)

    @classmethod
    async def patch_async(
        cls, entity_id: str, json_patch: List[Dict[str, Any]]
    ) -> TEntity:
        """Async patch an entity"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls.patch, entity_id, json_patch)

    @classmethod
    async def delete_async(
        cls, entity_id: str, recursive: bool = False, hard_delete: bool = False
    ) -> None:
        """Async delete an entity"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, cls.delete, entity_id, recursive, hard_delete
        )
