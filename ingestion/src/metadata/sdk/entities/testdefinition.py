"""
Test Definition entity implementation for OpenMetadata Python SDK.
"""
from typing import List, Optional

from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.entity.tests.testDefinition import (
    TestDefinition as TestDefinitionEntity,
)
from metadata.sdk.entities.base import BaseEntity


class TestDefinition(BaseEntity):
    """Test Definition entity operations for OpenMetadata SDK"""

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return TestDefinitionEntity

    @classmethod
    def create(cls, request: CreateTestDefinitionRequest) -> TestDefinitionEntity:
        """
        Create a new test definition.

        Args:
            request: CreateTestDefinitionRequest with test definition details

        Returns:
            Created TestDefinition entity
        """
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(
        cls, entity_id: str, fields: Optional[List[str]] = None
    ) -> TestDefinitionEntity:
        """
        Retrieve a test definition by ID.

        Args:
            entity_id: TestDefinition UUID
            fields: Optional list of fields to include

        Returns:
            TestDefinition entity
        """
        client = cls._get_client()
        return client.get_by_id(
            entity=TestDefinitionEntity, entity_id=entity_id, fields=fields
        )

    @classmethod
    def retrieve_by_name(
        cls, fqn: str, fields: Optional[List[str]] = None
    ) -> TestDefinitionEntity:
        """
        Retrieve a test definition by fully qualified name.

        Args:
            fqn: Fully qualified name
            fields: Optional list of fields to include

        Returns:
            TestDefinition entity
        """
        client = cls._get_client()
        return client.get_by_name(entity=TestDefinitionEntity, fqn=fqn, fields=fields)

    @classmethod
    def update(
        cls, entity_id: str, entity: TestDefinitionEntity
    ) -> TestDefinitionEntity:
        """
        Update a test definition (PUT operation).

        Args:
            entity_id: TestDefinition UUID
            entity: Updated TestDefinition entity

        Returns:
            Updated TestDefinition entity
        """
        entity.id = entity_id
        client = cls._get_client()
        return client.create_or_update(entity)

    @classmethod
    def patch(cls, entity_id: str, json_patch: List[dict]) -> TestDefinitionEntity:
        """
        Patch a test definition (PATCH operation).

        Args:
            entity_id: TestDefinition UUID
            json_patch: JSON patch operations

        Returns:
            Patched TestDefinition entity
        """
        client = cls._get_client()
        return client.patch(
            entity=TestDefinitionEntity, entity_id=entity_id, json_patch=json_patch
        )

    @classmethod
    def delete(
        cls, entity_id: str, recursive: bool = False, hard_delete: bool = False
    ) -> None:
        """
        Delete a test definition.

        Args:
            entity_id: TestDefinition UUID
            recursive: Delete recursively
            hard_delete: Hard delete (permanent)
        """
        client = cls._get_client()
        client.delete(
            entity=TestDefinitionEntity,
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
    ) -> List[TestDefinitionEntity]:
        """
        List test definitions.

        Args:
            fields: Fields to include
            after: Pagination cursor
            before: Pagination cursor
            limit: Number of results

        Returns:
            List of TestDefinition entities
        """
        client = cls._get_client()
        response = client.list_entities(
            entity=TestDefinitionEntity,
            fields=fields,
            after=after,
            before=before,
            limit=limit,
        )
        return response.entities if response else []
