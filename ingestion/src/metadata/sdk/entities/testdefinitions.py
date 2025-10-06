"""
TestDefinitions entity SDK with fluent API
"""
from typing import Type

from metadata.generated.schema.api.tests.createTestDefinition import (
    CreateTestDefinitionRequest,
)
from metadata.generated.schema.tests.testDefinition import TestDefinition
from metadata.sdk.entities.base import BaseEntity


class TestDefinitions(BaseEntity[TestDefinition, CreateTestDefinitionRequest]):
    """TestDefinitions SDK class - plural to avoid conflict with generated TestDefinition entity"""

    @classmethod
    def entity_type(cls) -> Type[TestDefinition]:
        """Return the TestDefinition entity type"""
        return TestDefinition
