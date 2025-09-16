"""
Query entity implementation for OpenMetadata Python SDK.
"""
from typing import List, Optional

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.entity.data.query import Query as QueryEntity
from metadata.sdk.entities.base import BaseEntity


class Query(BaseEntity):
    """Query entity operations for OpenMetadata SDK"""

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return QueryEntity

    @classmethod
    def create(cls, request: CreateQueryRequest) -> QueryEntity:
        """
        Create a new query.

        Args:
            request: CreateQueryRequest with query details

        Returns:
            Created Query entity
        """
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(
        cls, entity_id: str, fields: Optional[List[str]] = None
    ) -> QueryEntity:
        """
        Retrieve a query by ID.

        Args:
            entity_id: Query UUID
            fields: Optional list of fields to include

        Returns:
            Query entity
        """
        client = cls._get_client()
        return client.get_by_id(entity=QueryEntity, entity_id=entity_id, fields=fields)

    @classmethod
    def retrieve_by_name(
        cls, fqn: str, fields: Optional[List[str]] = None
    ) -> QueryEntity:
        """
        Retrieve a query by fully qualified name.

        Args:
            fqn: Fully qualified name
            fields: Optional list of fields to include

        Returns:
            Query entity
        """
        client = cls._get_client()
        return client.get_by_name(entity=QueryEntity, fqn=fqn, fields=fields)

    @classmethod
    def update(cls, entity_id: str, entity: QueryEntity) -> QueryEntity:
        """
        Update a query (PUT operation).

        Args:
            entity_id: Query UUID
            entity: Updated Query entity

        Returns:
            Updated Query entity
        """
        entity.id = entity_id
        client = cls._get_client()
        return client.create_or_update(entity)

    @classmethod
    def patch(cls, entity_id: str, json_patch: List[dict]) -> QueryEntity:
        """
        Patch a query (PATCH operation).

        Args:
            entity_id: Query UUID
            json_patch: JSON patch operations

        Returns:
            Patched Query entity
        """
        client = cls._get_client()
        return client.patch(
            entity=QueryEntity, entity_id=entity_id, json_patch=json_patch
        )

    @classmethod
    def delete(
        cls, entity_id: str, recursive: bool = False, hard_delete: bool = False
    ) -> None:
        """
        Delete a query.

        Args:
            entity_id: Query UUID
            recursive: Delete recursively
            hard_delete: Hard delete (permanent)
        """
        client = cls._get_client()
        client.delete(
            entity=QueryEntity,
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
        limit: int = 100,
    ) -> List[QueryEntity]:
        """
        List querys.

        Args:
            fields: Fields to include
            after: Pagination cursor
            before: Pagination cursor
            limit: Number of results

        Returns:
            List of Query entities
        """
        client = cls._get_client()
        response = client.list_entities(
            entity=QueryEntity,
            fields=fields,
            after=after,
            before=before,
            limit=limit,
        )
        return response.entities if response else []
