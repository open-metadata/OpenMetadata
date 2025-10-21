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

"""Unit tests for ParallelTestExecutor."""

import uuid
from unittest.mock import Mock

import pandas as pd
import pytest

from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.data_quality.executor.parallel_executor import ParallelTestExecutor


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

    # Use fixed UUIDs for test definitions
    not_null_def_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    between_def_id = uuid.UUID("00000000-0000-0000-0000-000000000002")
    unique_def_id = uuid.UUID("00000000-0000-0000-0000-000000000003")

    # Pre-populate test definitions
    test_definitions = {
        not_null_def_id: TestDefinition(
            id=not_null_def_id,
            name="columnValuesToBeNotNull",
            description="Test that column values are not null",
            fullyQualifiedName="columnValuesToBeNotNull",
            entityType=EntityType.COLUMN,
            testPlatforms=[TestPlatform.OpenMetadata],
            supportedDataTypes=[DataType.STRING, DataType.INT, DataType.FLOAT],
        ),
        between_def_id: TestDefinition(
            id=between_def_id,
            name="columnValuesToBeBetween",
            description="Test that column values are between min and max",
            fullyQualifiedName="columnValuesToBeBetween",
            entityType=EntityType.COLUMN,
            testPlatforms=[TestPlatform.OpenMetadata],
            supportedDataTypes=[DataType.INT, DataType.FLOAT],
        ),
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
            name="columnValuesToBeNotNull",
            description="Test definition",
            fullyQualifiedName="columnValuesToBeNotNull",
            entityType=EntityType.COLUMN,
            testPlatforms=[TestPlatform.OpenMetadata],
            supportedDataTypes=[DataType.STRING],
        )

    mock_client.get_by_id.side_effect = get_by_id_side_effect

    return mock_client


@pytest.fixture
def parallel_executor(mock_ometa):
    """Create a ParallelTestExecutor instance."""
    return ParallelTestExecutor(mock_ometa)


@pytest.fixture
def test_case_not_null():
    """Create a columnValuesToBeNotNull test case."""
    test_def_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    return TestCase(
        id=uuid.uuid4(),
        name="name_not_null",
        fullyQualifiedName=FullyQualifiedEntityName("test.table.name.name_not_null"),
        testDefinition=EntityReference(
            id=test_def_id,
            type="testDefinition",
            name="columnValuesToBeNotNull",
            fullyQualifiedName="columnValuesToBeNotNull",
        ),
        entityLink="<#E::table::test.table::columns::name>",
        testSuite=EntityReference(
            id=uuid.uuid4(),
            type="testSuite",
            name="test_suite",
            fullyQualifiedName="test.test_suite",
        ),
        parameterValues=[
            TestCaseParameterValue(name="columnName", value="name"),
        ],
    )


@pytest.fixture
def test_case_between():
    """Create a columnValuesToBeBetween test case."""
    test_def_id = uuid.UUID("00000000-0000-0000-0000-000000000002")
    return TestCase(
        id=uuid.uuid4(),
        name="age_between",
        fullyQualifiedName=FullyQualifiedEntityName("test.table.age.age_between"),
        testDefinition=EntityReference(
            id=test_def_id,
            type="testDefinition",
            name="columnValuesToBeBetween",
            fullyQualifiedName="columnValuesToBeBetween",
        ),
        entityLink="<#E::table::test.table::columns::age>",
        testSuite=EntityReference(
            id=uuid.uuid4(),
            type="testSuite",
            name="test_suite",
            fullyQualifiedName="test.test_suite",
        ),
        parameterValues=[
            TestCaseParameterValue(name="columnName", value="age"),
            TestCaseParameterValue(name="minValue", value="18"),
            TestCaseParameterValue(name="maxValue", value="65"),
        ],
    )


@pytest.fixture
def test_case_unique():
    """Create a columnValuesToBeUnique test case."""
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


@pytest.fixture
def sample_dataframe():
    """Create a sample DataFrame for testing."""
    return pd.DataFrame(
        {
            "id": list(range(1, 101)),
            "name": [f"Person_{i}" if i % 10 != 0 else None for i in range(1, 101)],
            "age": [20 + (i % 40) for i in range(1, 101)],  # Ages 20-59
        }
    )


class TestExecute:
    """Test execute method."""

    def test_execute_single_test(
        self, parallel_executor, test_case_not_null, sample_dataframe
    ):
        """Test execution with single test case."""
        results = parallel_executor.execute(
            test_cases=[test_case_not_null],
            df=sample_dataframe,
            chunksize=25,
            mode="report-errors",
        )

        assert len(results) == 1
        assert "name_not_null" in results
        result = results["name_not_null"]
        assert result.test_case == test_case_not_null
        # Test should fail due to nulls
        assert result.aggregated_result.testCaseStatus.value == "Failed"

    def test_execute_multiple_tests(
        self,
        parallel_executor,
        test_case_not_null,
        test_case_between,
        test_case_unique,
        sample_dataframe,
    ):
        """Test execution with multiple test cases."""
        test_cases = [test_case_not_null, test_case_between, test_case_unique]

        results = parallel_executor.execute(
            test_cases=test_cases,
            df=sample_dataframe,
            chunksize=25,
            max_workers=3,
            mode="report-errors",
        )

        assert len(results) == 3
        assert "name_not_null" in results
        assert "age_between" in results
        assert "id_unique" in results

    def test_execute_with_passing_tests(self, parallel_executor, test_case_unique):
        """Test execution where all tests pass."""
        # DataFrame with all unique IDs
        df = pd.DataFrame(
            {
                "id": range(1, 51),
                "name": [f"Person_{i}" for i in range(1, 51)],
                "age": [25 + (i % 20) for i in range(1, 51)],
            }
        )

        results = parallel_executor.execute(
            test_cases=[test_case_unique],
            df=df,
            chunksize=10,
        )

        assert len(results) == 1
        result = results["id_unique"]
        assert result.result.testCaseStatus.value == "Success"
        assert len(result.failed_indices) == 0

    def test_execute_with_failing_tests(
        self, parallel_executor, test_case_not_null, sample_dataframe
    ):
        """Test execution where tests fail."""
        results = parallel_executor.execute(
            test_cases=[test_case_not_null],
            df=sample_dataframe,
            chunksize=25,
        )

        result = results["name_not_null"]
        assert result.aggregated_result.testCaseStatus.value == "Failed"
        # Check failed indices from chunks
        total_failed = sum(len(indices) for indices in result.failed_indices_per_chunk)
        assert total_failed > 0

    def test_execute_empty_test_list(self, parallel_executor, sample_dataframe):
        """Test execution with empty test case list."""
        results = parallel_executor.execute(
            test_cases=[],
            df=sample_dataframe,
            chunksize=25,
        )

        assert len(results) == 0

    def test_execute_with_different_max_workers(
        self,
        parallel_executor,
        test_case_not_null,
        test_case_between,
        test_case_unique,
        sample_dataframe,
    ):
        """Test execution with different thread pool sizes."""
        test_cases = [test_case_not_null, test_case_between, test_case_unique]

        # Test with 1 worker (sequential)
        results_1 = parallel_executor.execute(
            test_cases=test_cases,
            df=sample_dataframe,
            max_workers=1,
        )

        # Test with 4 workers (parallel)
        results_4 = parallel_executor.execute(
            test_cases=test_cases,
            df=sample_dataframe,
            max_workers=4,
        )

        # Results should be the same regardless of worker count
        assert len(results_1) == len(results_4) == 3


class TestClassification:
    """Test _classify_test method."""

    def test_classify_chunked_test(self, parallel_executor, test_case_not_null):
        """Test classification of chunked test."""
        from metadata.sdk.data_quality.executor.validator_classification import (
            ValidatorExecutionMode,
        )

        mode = parallel_executor._classify_test(test_case_not_null)
        assert mode == ValidatorExecutionMode.CHUNKED

    def test_classify_full_table_test(self, parallel_executor, test_case_unique):
        """Test classification of full-table test."""
        from metadata.sdk.data_quality.executor.validator_classification import (
            ValidatorExecutionMode,
        )

        mode = parallel_executor._classify_test(test_case_unique)
        assert mode == ValidatorExecutionMode.FULL_TABLE


class TestResultTypes:
    """Test that results are of correct types."""

    def test_chunked_result_type(
        self, parallel_executor, test_case_not_null, sample_dataframe
    ):
        """Test that chunked tests return ChunkedTestResults."""
        from metadata.sdk.data_quality.models.validation_result import (
            ChunkedTestResults,
        )

        results = parallel_executor.execute(
            test_cases=[test_case_not_null],
            df=sample_dataframe,
            chunksize=25,
        )

        result = results["name_not_null"]
        assert isinstance(result, ChunkedTestResults)
        assert result.test_case == test_case_not_null
        assert result.aggregated_result is not None

    def test_full_table_result_type(
        self, parallel_executor, test_case_unique, sample_dataframe
    ):
        """Test that full-table tests return FullTableTestResult."""
        from metadata.sdk.data_quality.models.validation_result import (
            FullTableTestResult,
        )

        results = parallel_executor.execute(
            test_cases=[test_case_unique],
            df=sample_dataframe,
        )

        result = results["id_unique"]
        assert isinstance(result, FullTableTestResult)
        assert result.test_case == test_case_unique
        assert result.result is not None


class TestIntegration:
    """Integration tests with real validators."""

    def test_integration_mixed_validators(
        self,
        parallel_executor,
        test_case_not_null,
        test_case_between,
        test_case_unique,
    ):
        """Integration test with mix of chunked and full-table validators."""
        # Create DataFrame with known validation results
        df = pd.DataFrame(
            {
                "id": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                "name": ["A", "B", None, "D", "E", "F", "G", "H", "I", "J"],
                "age": [25, 30, 35, 40, 45, 50, 55, 60, 22, 28],
            }
        )

        results = parallel_executor.execute(
            test_cases=[test_case_not_null, test_case_between, test_case_unique],
            df=df,
            chunksize=5,
        )

        assert len(results) == 3

        # NotNull should fail (1 null in 'name')
        assert (
            results["name_not_null"].aggregated_result.testCaseStatus.value == "Failed"
        )

        # Between should pass (all ages 18-65)
        assert (
            results["age_between"].aggregated_result.testCaseStatus.value == "Success"
        )

        # Unique should pass (all IDs unique)
        assert results["id_unique"].result.testCaseStatus.value == "Success"

    def test_integration_concurrent_execution(
        self,
        parallel_executor,
        test_case_not_null,
        test_case_between,
        test_case_unique,
    ):
        """Integration test ensuring thread safety during concurrent execution."""
        # Create large DataFrame to ensure parallelism
        df = pd.DataFrame(
            {
                "id": range(1, 1001),
                "name": [f"Person_{i}" for i in range(1, 1001)],
                "age": [20 + (i % 40) for i in range(1, 1001)],
            }
        )

        # Run with multiple workers
        results = parallel_executor.execute(
            test_cases=[test_case_not_null, test_case_between, test_case_unique],
            df=df,
            chunksize=100,
            max_workers=3,
        )

        # All tests should complete successfully
        assert len(results) == 3
        for result in results.values():
            # Each result should have test case and test case result
            assert result.test_case is not None
            # Check appropriate result field based on type
            if hasattr(result, "aggregated_result"):
                assert result.aggregated_result is not None
            else:
                assert result.result is not None
