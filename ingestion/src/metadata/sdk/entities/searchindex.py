"""
Search Index entity implementation for OpenMetadata Python SDK.
"""
from typing import List, Optional

from metadata.generated.schema.api.data.createSearchIndex import (
    CreateSearchIndexRequest,
)
from metadata.generated.schema.entity.data.searchIndex import (
    SearchIndex as SearchIndexEntity,
)
from metadata.sdk.entities.base import BaseEntity


class SearchIndex(BaseEntity):
    """Search Index entity operations for OpenMetadata SDK"""

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return SearchIndexEntity

    @classmethod
    def create(cls, request: CreateSearchIndexRequest) -> SearchIndexEntity:
        """
        Create a new search index.

        Args:
            request: CreateSearchIndexRequest with search index details

        Returns:
            Created SearchIndex entity
        """
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(
        cls, entity_id: str, fields: Optional[List[str]] = None
    ) -> SearchIndexEntity:
        """
        Retrieve a search index by ID.

        Args:
            entity_id: SearchIndex UUID
            fields: Optional list of fields to include

        Returns:
            SearchIndex entity
        """
        client = cls._get_client()
        return client.get_by_id(
            entity=SearchIndexEntity, entity_id=entity_id, fields=fields
        )

    @classmethod
    def retrieve_by_name(
        cls, fqn: str, fields: Optional[List[str]] = None
    ) -> SearchIndexEntity:
        """
        Retrieve a search index by fully qualified name.

        Args:
            fqn: Fully qualified name
            fields: Optional list of fields to include

        Returns:
            SearchIndex entity
        """
        client = cls._get_client()
        return client.get_by_name(entity=SearchIndexEntity, fqn=fqn, fields=fields)

    @classmethod
    def update(cls, entity_id: str, entity: SearchIndexEntity) -> SearchIndexEntity:
        """
        Update a search index (PUT operation).

        Args:
            entity_id: SearchIndex UUID
            entity: Updated SearchIndex entity

        Returns:
            Updated SearchIndex entity
        """
        entity.id = entity_id
        client = cls._get_client()
        return client.create_or_update(entity)

    @classmethod
    def patch(cls, entity_id: str, json_patch: List[dict]) -> SearchIndexEntity:
        """
        Patch a search index (PATCH operation).

        Args:
            entity_id: SearchIndex UUID
            json_patch: JSON patch operations

        Returns:
            Patched SearchIndex entity
        """
        client = cls._get_client()
        return client.patch(
            entity=SearchIndexEntity, entity_id=entity_id, json_patch=json_patch
        )

    @classmethod
    def delete(
        cls, entity_id: str, recursive: bool = False, hard_delete: bool = False
    ) -> None:
        """
        Delete a search index.

        Args:
            entity_id: SearchIndex UUID
            recursive: Delete recursively
            hard_delete: Hard delete (permanent)
        """
        client = cls._get_client()
        client.delete(
            entity=SearchIndexEntity,
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
    ) -> List[SearchIndexEntity]:
        """
        List search indexs.

        Args:
            fields: Fields to include
            after: Pagination cursor
            before: Pagination cursor
            limit: Number of results

        Returns:
            List of SearchIndex entities
        """
        client = cls._get_client()
        response = client.list_entities(
            entity=SearchIndexEntity,
            fields=fields,
            after=after,
            before=before,
            limit=limit,
        )
        return response.entities if response else []
