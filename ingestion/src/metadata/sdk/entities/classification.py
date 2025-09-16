"""
Classification entity implementation for OpenMetadata Python SDK.
"""
from typing import List, Optional

from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.entity.classification.classification import (
    Classification as ClassificationEntity,
)
from metadata.sdk.entities.base import BaseEntity


class Classification(BaseEntity):
    """Classification entity operations for OpenMetadata SDK"""

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return ClassificationEntity

    @classmethod
    def create(cls, request: CreateClassificationRequest) -> ClassificationEntity:
        """
        Create a new classification.

        Args:
            request: CreateClassificationRequest with classification details

        Returns:
            Created Classification entity
        """
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(
        cls, entity_id: str, fields: Optional[List[str]] = None
    ) -> ClassificationEntity:
        """
        Retrieve a classification by ID.

        Args:
            entity_id: Classification UUID
            fields: Optional list of fields to include

        Returns:
            Classification entity
        """
        client = cls._get_client()
        return client.get_by_id(
            entity=ClassificationEntity, entity_id=entity_id, fields=fields
        )

    @classmethod
    def retrieve_by_name(
        cls, fqn: str, fields: Optional[List[str]] = None
    ) -> ClassificationEntity:
        """
        Retrieve a classification by fully qualified name.

        Args:
            fqn: Fully qualified name
            fields: Optional list of fields to include

        Returns:
            Classification entity
        """
        client = cls._get_client()
        return client.get_by_name(entity=ClassificationEntity, fqn=fqn, fields=fields)

    @classmethod
    def update(
        cls, entity_id: str, entity: ClassificationEntity
    ) -> ClassificationEntity:
        """
        Update a classification (PUT operation).

        Args:
            entity_id: Classification UUID
            entity: Updated Classification entity

        Returns:
            Updated Classification entity
        """
        entity.id = entity_id
        client = cls._get_client()
        return client.create_or_update(entity)

    @classmethod
    def patch(cls, entity_id: str, json_patch: List[dict]) -> ClassificationEntity:
        """
        Patch a classification (PATCH operation).

        Args:
            entity_id: Classification UUID
            json_patch: JSON patch operations

        Returns:
            Patched Classification entity
        """
        client = cls._get_client()
        return client.patch(
            entity=ClassificationEntity, entity_id=entity_id, json_patch=json_patch
        )

    @classmethod
    def delete(
        cls, entity_id: str, recursive: bool = False, hard_delete: bool = False
    ) -> None:
        """
        Delete a classification.

        Args:
            entity_id: Classification UUID
            recursive: Delete recursively
            hard_delete: Hard delete (permanent)
        """
        client = cls._get_client()
        client.delete(
            entity=ClassificationEntity,
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
    ) -> List[ClassificationEntity]:
        """
        List classifications.

        Args:
            fields: Fields to include
            after: Pagination cursor
            before: Pagination cursor
            limit: Number of results

        Returns:
            List of Classification entities
        """
        client = cls._get_client()
        response = client.list_entities(
            entity=ClassificationEntity,
            fields=fields,
            after=after,
            before=before,
            limit=limit,
        )
        return response.entities if response else []
