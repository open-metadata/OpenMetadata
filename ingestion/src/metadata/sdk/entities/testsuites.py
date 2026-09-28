"""
TestSuites entity SDK with fluent API
"""

from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.sdk.entities.base import BaseEntity


class TestSuites(BaseEntity[TestSuite, CreateTestSuiteRequest]):
    """TestSuites SDK class - plural to avoid conflict with generated TestSuite entity"""

    @classmethod
    def entity_type(cls) -> type[TestSuite]:
        """Return the TestSuite entity type"""
        return TestSuite
