"""
Tag entity implementation for OpenMetadata Python SDK.
"""
from typing import List, Optional

from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.entity.classification.tag import Tag as TagEntity
from metadata.sdk.entities.base import BaseEntity


class Tag(BaseEntity):
    """Tag entity operations for OpenMetadata SDK"""

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return TagEntity

    @classmethod
    def create(cls, request: CreateTagRequest) -> TagEntity:
        """
        Create a new tag.

        Args:
            request: CreateTagRequest with tag details

        Returns:
            Created Tag entity
        """
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(cls, entity_id: str, fields: Optional[List[str]] = None) -> TagEntity:
        """
        Retrieve a tag by ID.

        Args:
            entity_id: Tag UUID
            fields: Optional list of fields to include

        Returns:
            Tag entity
        """
        client = cls._get_client()
        return client.get_by_id(entity=TagEntity, entity_id=entity_id, fields=fields)

    @classmethod
    def retrieve_by_name(
        cls, fqn: str, fields: Optional[List[str]] = None
    ) -> TagEntity:
        """
        Retrieve a tag by fully qualified name.

        Args:
            fqn: Fully qualified name
            fields: Optional list of fields to include

        Returns:
            Tag entity
        """
        client = cls._get_client()
        return client.get_by_name(entity=TagEntity, fqn=fqn, fields=fields)

    @classmethod
    def update(cls, entity_id: str, entity: TagEntity) -> TagEntity:
        """
        Update a tag (PUT operation).

        Args:
            entity_id: Tag UUID
            entity: Updated Tag entity

        Returns:
            Updated Tag entity
        """
        entity.id = entity_id
        client = cls._get_client()
        return client.create_or_update(entity)

    @classmethod
    def patch(cls, entity_id: str, json_patch: List[dict]) -> TagEntity:
        """
        Patch a tag (PATCH operation).

        Args:
            entity_id: Tag UUID
            json_patch: JSON patch operations

        Returns:
            Patched Tag entity
        """
        client = cls._get_client()
        return client.patch(
            entity=TagEntity, entity_id=entity_id, json_patch=json_patch
        )

    @classmethod
    def delete(
        cls, entity_id: str, recursive: bool = False, hard_delete: bool = False
    ) -> None:
        """
        Delete a tag.

        Args:
            entity_id: Tag UUID
            recursive: Delete recursively
            hard_delete: Hard delete (permanent)
        """
        client = cls._get_client()
        client.delete(
            entity=TagEntity,
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
    ) -> List[TagEntity]:
        """
        List tags.

        Args:
            fields: Fields to include
            after: Pagination cursor
            before: Pagination cursor
            limit: Number of results

        Returns:
            List of Tag entities
        """
        client = cls._get_client()
        response = client.list_entities(
            entity=TagEntity,
            fields=fields,
            after=after,
            before=before,
            limit=limit,
        )
        return response.entities if response else []
