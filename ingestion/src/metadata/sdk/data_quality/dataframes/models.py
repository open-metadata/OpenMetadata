from uuid import uuid4

from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.data_quality import BaseTest, ColumnTest


class MockTestCase(TestCase):
    """Mock test case."""


def create_mock_test_case(test_definition: BaseTest) -> MockTestCase:
    """Convert TestCaseDefinition to TestCase object.

    Returns:
        Synthetic TestCase for DataFrame validation
    """
    entity_link = "<#E::table::dataframe_validation>"
    if isinstance(test_definition, ColumnTest):
        entity_link = (
            f"<#E::table::dataframe_validation::columns::{test_definition.column_name}>"
        )

    return MockTestCase(  # pyright: ignore[reportCallIssue]
        id=uuid4(),
        name=test_definition.name,
        fullyQualifiedName=test_definition.name,
        displayName=test_definition.display_name,
        description=test_definition.description,
        testDefinition=EntityReference(  # pyright: ignore[reportCallIssue]
            id=uuid4(),
            name=test_definition.test_definition_name,
            fullyQualifiedName=test_definition.test_definition_name,
            type="testDefinition",
        ),
        entityLink=entity_link,
        parameterValues=test_definition.parameters,
        testSuite=EntityReference(  # pyright: ignore[reportCallIssue]
            id=uuid4(),
            name="dataframe_validation",
            type="testSuite",
        ),
        computePassedFailedRowCount=True,
    )
