"""
TestCases entity SDK with fluent API
"""

from collections.abc import Sequence

from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.type.bulkCreateResult import BulkCreateResult, ConflictPolicy
from metadata.sdk.entities.base import BaseEntity


class TestCases(BaseEntity[TestCase, CreateTestCaseRequest]):
    """TestCases SDK class - plural to avoid conflict with generated TestCase entity"""

    @classmethod
    def entity_type(cls) -> type[TestCase]:
        """Return the TestCase entity type"""
        return TestCase

    @classmethod
    def create_many(
        cls, requests: Sequence[CreateTestCaseRequest], *, on_conflict: ConflictPolicy = ConflictPolicy.skip
    ) -> BulkCreateResult:
        """Create test cases with per-input outcomes; fail marks conflicts failed while other inputs continue."""
        return cls._create_many(requests, on_conflict)
