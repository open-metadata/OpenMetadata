"""
Test Suite entity implementation for OpenMetadata Python SDK.
"""
from typing import List, Optional

from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.entity.tests.testSuite import (
    TestSuite as TestSuiteEntity,
)
from metadata.sdk.entities.base import BaseEntity


class TestSuite(BaseEntity):
    """Test Suite entity operations for OpenMetadata SDK"""

    @classmethod
    def entity_type(cls):
        """Return the entity type"""
        return TestSuiteEntity

    @classmethod
    def create(cls, request: CreateTestSuiteRequest) -> TestSuiteEntity:
        """
        Create a new test suite.

        Args:
            request: CreateTestSuiteRequest with test suite details

        Returns:
            Created TestSuite entity
        """
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(
        cls, entity_id: str, fields: Optional[List[str]] = None
    ) -> TestSuiteEntity:
        """
        Retrieve a test suite by ID.

        Args:
            entity_id: TestSuite UUID
            fields: Optional list of fields to include

        Returns:
            TestSuite entity
        """
        client = cls._get_client()
        return client.get_by_id(
            entity=TestSuiteEntity, entity_id=entity_id, fields=fields
        )

    @classmethod
    def retrieve_by_name(
        cls, fqn: str, fields: Optional[List[str]] = None
    ) -> TestSuiteEntity:
        """
        Retrieve a test suite by fully qualified name.

        Args:
            fqn: Fully qualified name
            fields: Optional list of fields to include

        Returns:
            TestSuite entity
        """
        client = cls._get_client()
        return client.get_by_name(entity=TestSuiteEntity, fqn=fqn, fields=fields)

    @classmethod
    def update(cls, entity_id: str, entity: TestSuiteEntity) -> TestSuiteEntity:
        """
        Update a test suite (PUT operation).

        Args:
            entity_id: TestSuite UUID
            entity: Updated TestSuite entity

        Returns:
            Updated TestSuite entity
        """
        entity.id = entity_id
        client = cls._get_client()
        return client.create_or_update(entity)

    @classmethod
    def patch(cls, entity_id: str, json_patch: List[dict]) -> TestSuiteEntity:
        """
        Patch a test suite (PATCH operation).

        Args:
            entity_id: TestSuite UUID
            json_patch: JSON patch operations

        Returns:
            Patched TestSuite entity
        """
        client = cls._get_client()
        return client.patch(
            entity=TestSuiteEntity, entity_id=entity_id, json_patch=json_patch
        )

    @classmethod
    def delete(
        cls, entity_id: str, recursive: bool = False, hard_delete: bool = False
    ) -> None:
        """
        Delete a test suite.

        Args:
            entity_id: TestSuite UUID
            recursive: Delete recursively
            hard_delete: Hard delete (permanent)
        """
        client = cls._get_client()
        client.delete(
            entity=TestSuiteEntity,
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
    ) -> List[TestSuiteEntity]:
        """
        List test suites.

        Args:
            fields: Fields to include
            after: Pagination cursor
            before: Pagination cursor
            limit: Number of results

        Returns:
            List of TestSuite entities
        """
        client = cls._get_client()
        response = client.list_entities(
            entity=TestSuiteEntity,
            fields=fields,
            after=after,
            before=before,
            limit=limit,
        )
        return response.entities if response else []
