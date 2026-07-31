"""
TestCases entity SDK with fluent API
"""

from typing import Type  # noqa: UP035

from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.tests.testCase import TestCase
from metadata.sdk.entities.base import BaseEntity


class TestCases(BaseEntity[TestCase, CreateTestCaseRequest]):
    """TestCases SDK class - plural to avoid conflict with generated TestCase entity"""

    @classmethod
    def entity_type(cls) -> Type[TestCase]:  # noqa: UP006
        """Return the TestCase entity type"""
        return TestCase
