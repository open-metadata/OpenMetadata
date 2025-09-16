"""
API Collection entity implementation for OpenMetadata Python SDK.
"""
from typing import List, Optional

from metadata.generated.schema.api.data.createAPICollection import (
    CreateAPICollectionRequest,
)
from metadata.generated.schema.entity.data.apiCollection import (
    APICollection as APICollectionEntity,
)
from metadata.sdk.entities.base import BaseEntity


class APICollection(BaseEntity):
    """API Collection entity operations for OpenMetadata SDK"""

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return APICollectionEntity

    @classmethod
    def create(cls, request: CreateAPICollectionRequest) -> APICollectionEntity:
        """
        Create a new api collection.

        Args:
            request: CreateAPICollectionRequest with api collection details

        Returns:
            Created APICollection entity
        """
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(
        cls, entity_id: str, fields: Optional[List[str]] = None
    ) -> APICollectionEntity:
        """
        Retrieve a api collection by ID.

        Args:
            entity_id: APICollection UUID
            fields: Optional list of fields to include

        Returns:
            APICollection entity
        """
        client = cls._get_client()
        return client.get_by_id(
            entity=APICollectionEntity, entity_id=entity_id, fields=fields
        )

    @classmethod
    def retrieve_by_name(
        cls, fqn: str, fields: Optional[List[str]] = None
    ) -> APICollectionEntity:
        """
        Retrieve a api collection by fully qualified name.

        Args:
            fqn: Fully qualified name
            fields: Optional list of fields to include

        Returns:
            APICollection entity
        """
        client = cls._get_client()
        return client.get_by_name(entity=APICollectionEntity, fqn=fqn, fields=fields)

    @classmethod
    def update(cls, entity_id: str, entity: APICollectionEntity) -> APICollectionEntity:
        """
        Update a api collection (PUT operation).

        Args:
            entity_id: APICollection UUID
            entity: Updated APICollection entity

        Returns:
            Updated APICollection entity
        """
        entity.id = entity_id
        client = cls._get_client()
        return client.create_or_update(entity)

    @classmethod
    def patch(cls, entity_id: str, json_patch: List[dict]) -> APICollectionEntity:
        """
        Patch a api collection (PATCH operation).

        Args:
            entity_id: APICollection UUID
            json_patch: JSON patch operations

        Returns:
            Patched APICollection entity
        """
        client = cls._get_client()
        return client.patch(
            entity=APICollectionEntity, entity_id=entity_id, json_patch=json_patch
        )

    @classmethod
    def delete(
        cls, entity_id: str, recursive: bool = False, hard_delete: bool = False
    ) -> None:
        """
        Delete a api collection.

        Args:
            entity_id: APICollection UUID
            recursive: Delete recursively
            hard_delete: Hard delete (permanent)
        """
        client = cls._get_client()
        client.delete(
            entity=APICollectionEntity,
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
    ) -> List[APICollectionEntity]:
        """
        List api collections.

        Args:
            fields: Fields to include
            after: Pagination cursor
            before: Pagination cursor
            limit: Number of results

        Returns:
            List of APICollection entities
        """
        client = cls._get_client()
        response = client.list_entities(
            entity=APICollectionEntity,
            fields=fields,
            after=after,
            before=before,
            limit=limit,
        )
        return response.entities if response else []
