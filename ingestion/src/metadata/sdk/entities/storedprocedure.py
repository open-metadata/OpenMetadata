"""
Stored Procedure entity implementation for OpenMetadata Python SDK.
"""
from typing import List, Optional

from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.entity.data.storedProcedure import (
    StoredProcedure as StoredProcedureEntity,
)
from metadata.sdk.entities.base import BaseEntity


class StoredProcedure(BaseEntity):
    """Stored Procedure entity operations for OpenMetadata SDK"""

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return StoredProcedureEntity

    @classmethod
    def create(cls, request: CreateStoredProcedureRequest) -> StoredProcedureEntity:
        """
        Create a new stored procedure.

        Args:
            request: CreateStoredProcedureRequest with stored procedure details

        Returns:
            Created StoredProcedure entity
        """
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(
        cls, entity_id: str, fields: Optional[List[str]] = None
    ) -> StoredProcedureEntity:
        """
        Retrieve a stored procedure by ID.

        Args:
            entity_id: StoredProcedure UUID
            fields: Optional list of fields to include

        Returns:
            StoredProcedure entity
        """
        client = cls._get_client()
        return client.get_by_id(
            entity=StoredProcedureEntity, entity_id=entity_id, fields=fields
        )

    @classmethod
    def retrieve_by_name(
        cls, fqn: str, fields: Optional[List[str]] = None
    ) -> StoredProcedureEntity:
        """
        Retrieve a stored procedure by fully qualified name.

        Args:
            fqn: Fully qualified name
            fields: Optional list of fields to include

        Returns:
            StoredProcedure entity
        """
        client = cls._get_client()
        return client.get_by_name(entity=StoredProcedureEntity, fqn=fqn, fields=fields)

    @classmethod
    def update(
        cls, entity_id: str, entity: StoredProcedureEntity
    ) -> StoredProcedureEntity:
        """
        Update a stored procedure (PUT operation).

        Args:
            entity_id: StoredProcedure UUID
            entity: Updated StoredProcedure entity

        Returns:
            Updated StoredProcedure entity
        """
        entity.id = entity_id
        client = cls._get_client()
        return client.create_or_update(entity)

    @classmethod
    def patch(cls, entity_id: str, json_patch: List[dict]) -> StoredProcedureEntity:
        """
        Patch a stored procedure (PATCH operation).

        Args:
            entity_id: StoredProcedure UUID
            json_patch: JSON patch operations

        Returns:
            Patched StoredProcedure entity
        """
        client = cls._get_client()
        return client.patch(
            entity=StoredProcedureEntity, entity_id=entity_id, json_patch=json_patch
        )

    @classmethod
    def delete(
        cls, entity_id: str, recursive: bool = False, hard_delete: bool = False
    ) -> None:
        """
        Delete a stored procedure.

        Args:
            entity_id: StoredProcedure UUID
            recursive: Delete recursively
            hard_delete: Hard delete (permanent)
        """
        client = cls._get_client()
        client.delete(
            entity=StoredProcedureEntity,
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
    ) -> List[StoredProcedureEntity]:
        """
        List stored procedures.

        Args:
            fields: Fields to include
            after: Pagination cursor
            before: Pagination cursor
            limit: Number of results

        Returns:
            List of StoredProcedure entities
        """
        client = cls._get_client()
        response = client.list_entities(
            entity=StoredProcedureEntity,
            fields=fields,
            after=after,
            before=before,
            limit=limit,
        )
        return response.entities if response else []
