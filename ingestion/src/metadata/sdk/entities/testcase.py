"""
Test Case entity implementation for OpenMetadata Python SDK.
"""
from typing import List, Optional

from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.entity.tests.testCase import TestCase as TestCaseEntity
from metadata.sdk.entities.base import BaseEntity


class TestCase(BaseEntity):
    """Test Case entity operations for OpenMetadata SDK"""

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return TestCaseEntity

    @classmethod
    def create(cls, request: CreateTestCaseRequest) -> TestCaseEntity:
        """
        Create a new test case.

        Args:
            request: CreateTestCaseRequest with test case details

        Returns:
            Created TestCase entity
        """
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(
        cls, entity_id: str, fields: Optional[List[str]] = None
    ) -> TestCaseEntity:
        """
        Retrieve a test case by ID.

        Args:
            entity_id: TestCase UUID
            fields: Optional list of fields to include

        Returns:
            TestCase entity
        """
        client = cls._get_client()
        return client.get_by_id(
            entity=TestCaseEntity, entity_id=entity_id, fields=fields
        )

    @classmethod
    def retrieve_by_name(
        cls, fqn: str, fields: Optional[List[str]] = None
    ) -> TestCaseEntity:
        """
        Retrieve a test case by fully qualified name.

        Args:
            fqn: Fully qualified name
            fields: Optional list of fields to include

        Returns:
            TestCase entity
        """
        client = cls._get_client()
        return client.get_by_name(entity=TestCaseEntity, fqn=fqn, fields=fields)

    @classmethod
    def update(cls, entity_id: str, entity: TestCaseEntity) -> TestCaseEntity:
        """
        Update a test case (PUT operation).

        Args:
            entity_id: TestCase UUID
            entity: Updated TestCase entity

        Returns:
            Updated TestCase entity
        """
        entity.id = entity_id
        client = cls._get_client()
        return client.create_or_update(entity)

    @classmethod
    def patch(cls, entity_id: str, json_patch: List[dict]) -> TestCaseEntity:
        """
        Patch a test case (PATCH operation).

        Args:
            entity_id: TestCase UUID
            json_patch: JSON patch operations

        Returns:
            Patched TestCase entity
        """
        client = cls._get_client()
        return client.patch(
            entity=TestCaseEntity, entity_id=entity_id, json_patch=json_patch
        )

    @classmethod
    def delete(
        cls, entity_id: str, recursive: bool = False, hard_delete: bool = False
    ) -> None:
        """
        Delete a test case.

        Args:
            entity_id: TestCase UUID
            recursive: Delete recursively
            hard_delete: Hard delete (permanent)
        """
        client = cls._get_client()
        client.delete(
            entity=TestCaseEntity,
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
    ) -> List[TestCaseEntity]:
        """
        List test cases.

        Args:
            fields: Fields to include
            after: Pagination cursor
            before: Pagination cursor
            limit: Number of results

        Returns:
            List of TestCase entities
        """
        client = cls._get_client()
        response = client.list_entities(
            entity=TestCaseEntity,
            fields=fields,
            after=after,
            before=before,
            limit=limit,
        )
        return response.entities if response else []
