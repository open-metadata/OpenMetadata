#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Unit tests for FullTableTestExecutor."""

import uuid
from unittest.mock import Mock

import pandas as pd
import pytest

from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.data_quality.executor.full_table_executor import FullTableTestExecutor


@pytest.fixture
def mock_ometa():
    """Create a mock OpenMetadata client with test definition support."""
    from metadata.generated.schema.entity.data.table import DataType
    from metadata.generated.schema.tests.testDefinition import (
        EntityType,
        TestDefinition,
        TestPlatform,
    )

    mock_client = Mock()

    # Use fixed UUID for uniqueness validator
    unique_def_id = uuid.UUID("00000000-0000-0000-0000-000000000003")

    # Pre-populate test definitions
    test_definitions = {
        unique_def_id: TestDefinition(
            id=unique_def_id,
            name="columnValuesToBeUnique",
            description="Test that column values are unique",
            fullyQualifiedName="columnValuesToBeUnique",
            entityType=EntityType.COLUMN,
            testPlatforms=[TestPlatform.OpenMetadata],
            supportedDataTypes=[DataType.STRING, DataType.INT],
        ),
    }

    # Mock get_by_id to return appropriate TestDefinition
    def get_by_id_side_effect(entity_type, entity_id, fields=None):
        # entity_id is a Uuid RootModel, extract the actual UUID
        actual_id = entity_id.root if hasattr(entity_id, "root") else entity_id

        if actual_id in test_definitions:
            return test_definitions[actual_id]

        # Fallback for unknown IDs
        return TestDefinition(
            id=actual_id,
            name="columnValuesToBeUnique",
            description="Test definition",
            fullyQualifiedName="columnValuesToBeUnique",
            entityType=EntityType.COLUMN,
            testPlatforms=[TestPlatform.OpenMetadata],
            supportedDataTypes=[DataType.STRING],
        )

    mock_client.get_by_id.side_effect = get_by_id_side_effect

    return mock_client


@pytest.fixture
def full_table_executor(mock_ometa):
    """Create a FullTableTestExecutor instance."""
    return FullTableTestExecutor(mock_ometa)


@pytest.fixture
def test_case_unique():
    """Create a columnValuesToBeUnique test case."""
    # Use fixed UUID that matches mock_ometa fixture
    test_def_id = uuid.UUID("00000000-0000-0000-0000-000000000003")
    return TestCase(
        id=uuid.uuid4(),
        name="id_unique",
        fullyQualifiedName=FullyQualifiedEntityName("test.table.id.id_unique"),
        testDefinition=EntityReference(
            id=test_def_id,
            type="testDefinition",
            name="columnValuesToBeUnique",
            fullyQualifiedName="columnValuesToBeUnique",
        ),
        entityLink="<#E::table::test.table::columns::id>",
        testSuite=EntityReference(
            id=uuid.uuid4(),
            type="testSuite",
            name="test_suite",
            fullyQualifiedName="test.test_suite",
        ),
        parameterValues=[
            TestCaseParameterValue(name="columnName", value="id"),
        ],
    )


class TestExecute:
    """Test execute method."""

    def test_execute_with_unique_values(self, full_table_executor, test_case_unique):
        """Test execution with all unique values."""
        df = pd.DataFrame(
            {
                "id": range(1, 101),
                "name": [f"Person_{i}" for i in range(1, 101)],
                "age": [20 + (i % 50) for i in range(1, 101)],
            }
        )

        result = full_table_executor.execute(
            test_case=test_case_unique,
            df=df,
        )

        assert result.test_case == test_case_unique
        assert result.result.testCaseStatus.value == "Success"
        assert len(result.failed_indices) == 0  # No failures for unique values

    def test_execute_with_duplicate_values(self, full_table_executor, test_case_unique):
        """Test execution with duplicate values."""
        df = pd.DataFrame(
            {
                "id": [1, 2, 3, 2, 5],  # Duplicate ID=2
                "name": ["A", "B", "C", "D", "E"],
                "age": [20, 21, 22, 23, 24],
            }
        )

        result = full_table_executor.execute(
            test_case=test_case_unique,
            df=df,
        )

        assert result.result.testCaseStatus.value == "Failed"
        # For uniqueness tests, failed_indices might be empty or contain duplicate rows
        # depending on validator implementation

    def test_execute_with_empty_dataframe(self, full_table_executor, test_case_unique):
        """Test execution on empty DataFrame."""
        df = pd.DataFrame({"id": [], "name": [], "age": []})

        result = full_table_executor.execute(
            test_case=test_case_unique,
            df=df,
        )

        assert len(result.failed_indices) == 0
        # Empty DataFrame should either pass or be aborted
        assert result.result.testCaseStatus.value in ["Success", "Aborted"]

    def test_execute_with_single_row(self, full_table_executor, test_case_unique):
        """Test execution with single row DataFrame."""
        df = pd.DataFrame({"id": [1], "name": ["Alice"], "age": [25]})

        result = full_table_executor.execute(
            test_case=test_case_unique,
            df=df,
        )

        assert result.result.testCaseStatus.value == "Success"
        assert len(result.failed_indices) == 0

    def test_execute_with_large_dataframe(self, full_table_executor, test_case_unique):
        """Test execution with large DataFrame."""
        # Create a large DataFrame with all unique IDs
        df = pd.DataFrame(
            {
                "id": range(1, 10001),
                "name": [f"Person_{i}" for i in range(1, 10001)],
                "age": [20 + (i % 50) for i in range(1, 10001)],
            }
        )

        result = full_table_executor.execute(
            test_case=test_case_unique,
            df=df,
        )

        assert result.result.testCaseStatus.value == "Success"
        assert len(result.failed_indices) == 0

    def test_execute_preserves_dataframe(self, full_table_executor, test_case_unique):
        """Test that execution doesn't modify the original DataFrame."""
        original_df = pd.DataFrame(
            {
                "id": [1, 2, 3, 4, 5],
                "name": ["A", "B", "C", "D", "E"],
                "age": [20, 21, 22, 23, 24],
            }
        )

        # Create a copy to compare later
        df_copy = original_df.copy()

        result = full_table_executor.execute(
            test_case=test_case_unique,
            df=original_df,
        )

        # DataFrame should be unchanged
        pd.testing.assert_frame_equal(original_df, df_copy)
        assert len(result.failed_indices) == 0


class TestCreateInterface:
    """Test _create_interface method."""

    def test_create_interface_returns_pandas_interface(self, full_table_executor):
        """Test that _create_interface returns PandasTestSuiteInterface."""
        df = pd.DataFrame(
            {
                "id": [1, 2, 3],
                "name": ["A", "B", "C"],
                "age": [20, 21, 22],
            }
        )

        interface = full_table_executor._create_interface([df])

        assert interface is not None
        assert hasattr(interface, "run_test_case")
        assert interface.dataset is not None

    def test_create_interface_dataset_access(self, full_table_executor):
        """Test that interface can access the dataset."""
        df = pd.DataFrame(
            {
                "id": [1, 2, 3],
                "name": ["A", "B", "C"],
                "age": [20, 21, 22],
            }
        )

        interface = full_table_executor._create_interface([df])
        dataset = interface.dataset

        assert len(dataset) == 1
        assert dataset[0].equals(df)


class TestIntegration:
    """Integration tests with real validators."""

    def test_integration_unique_validator_success(
        self, full_table_executor, test_case_unique
    ):
        """Integration test with unique validator on unique data."""
        df = pd.DataFrame(
            {
                "id": [10, 20, 30, 40, 50],
                "name": ["Alice", "Bob", "Charlie", "David", "Eve"],
                "age": [25, 30, 35, 40, 45],
            }
        )

        result = full_table_executor.execute(
            test_case=test_case_unique,
            df=df,
        )

        assert result.result.testCaseStatus.value == "Success"
        assert len(result.failed_indices) == 0

    def test_integration_unique_validator_failure(
        self, full_table_executor, test_case_unique
    ):
        """Integration test with unique validator on duplicate data."""
        df = pd.DataFrame(
            {
                "id": [1, 2, 2, 3, 3, 3],  # Multiple duplicates
                "name": ["A", "B", "C", "D", "E", "F"],
                "age": [20, 21, 22, 23, 24, 25],
            }
        )

        result = full_table_executor.execute(
            test_case=test_case_unique,
            df=df,
        )

        assert result.result.testCaseStatus.value == "Failed"
        # For uniqueness tests, failed_indices might be empty
        # as the validator checks the whole column, not individual rows
