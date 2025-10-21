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

"""Unit tests for ChunkedTestExecutor."""

import uuid
from unittest.mock import Mock

import pandas as pd
import pytest

from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.data_quality.executor.chunked_executor import ChunkedTestExecutor


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

    # Use fixed UUIDs that match our test case fixtures
    not_null_def_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    between_def_id = uuid.UUID("00000000-0000-0000-0000-000000000002")

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
def chunked_executor(mock_ometa):
    """Create a ChunkedTestExecutor instance."""
    return ChunkedTestExecutor(mock_ometa)


@pytest.fixture
def sample_dataframe():
    """Create a sample DataFrame for testing."""
    return pd.DataFrame(
        {
            "id": list(range(1, 101)),
            "name": [f"Person_{i}" if i % 10 != 0 else None for i in range(1, 101)],
            "age": [20 + (i % 50) for i in range(1, 101)],
        }
    )


@pytest.fixture
def test_case_not_null():
    """Create a columnValuesToBeNotNull test case."""
    # Use fixed UUID that matches mock_ometa fixture
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
    # Use fixed UUID that matches mock_ometa fixture
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


class TestChunkDataFrame:
    """Test _chunk_dataframe method."""

    def test_chunk_exact_division(self, chunked_executor):
        """Test chunking with exact division."""
        df = pd.DataFrame({"col": range(100)})
        chunks = chunked_executor._chunk_dataframe(df, chunksize=10)

        assert len(chunks) == 10
        for chunk in chunks:
            assert len(chunk) == 10

    def test_chunk_non_exact_division(self, chunked_executor):
        """Test chunking with non-exact division."""
        df = pd.DataFrame({"col": range(105)})
        chunks = chunked_executor._chunk_dataframe(df, chunksize=10)

        assert len(chunks) == 11
        assert len(chunks[-1]) == 5  # Last chunk has remaining rows

    def test_chunk_single_chunk(self, chunked_executor):
        """Test chunking where entire DataFrame fits in one chunk."""
        df = pd.DataFrame({"col": range(50)})
        chunks = chunked_executor._chunk_dataframe(df, chunksize=100)

        assert len(chunks) == 1
        assert len(chunks[0]) == 50

    def test_chunk_empty_dataframe(self, chunked_executor):
        """Test chunking empty DataFrame."""
        df = pd.DataFrame({"col": []})
        chunks = chunked_executor._chunk_dataframe(df, chunksize=10)

        assert len(chunks) == 0

    def test_chunk_preserves_indices(self, chunked_executor):
        """Test that chunking preserves DataFrame indices."""
        df = pd.DataFrame({"col": range(25)}, index=range(100, 125))
        chunks = chunked_executor._chunk_dataframe(df, chunksize=10)

        assert chunks[0].index.tolist() == list(range(100, 110))
        assert chunks[1].index.tolist() == list(range(110, 120))
        assert chunks[2].index.tolist() == list(range(120, 125))


class TestCreateInterface:
    """Test _create_interface method."""

    def test_create_interface_returns_pandas_interface(
        self, chunked_executor, sample_dataframe
    ):
        """Test that _create_interface returns PandasTestSuiteInterface."""
        interface = chunked_executor._create_interface([sample_dataframe])

        assert interface is not None
        assert hasattr(interface, "run_test_case")
        assert interface.dataset is not None

    def test_create_interface_with_multiple_dataframes(self, chunked_executor):
        """Test creating interface with multiple DataFrames."""
        df1 = pd.DataFrame({"col": [1, 2, 3]})
        df2 = pd.DataFrame({"col": [4, 5, 6]})

        interface = chunked_executor._create_interface([df1, df2])

        assert len(interface.dataset) == 2


class TestExecute:
    """Test execute method."""

    def test_execute_all_chunks_pass(self, chunked_executor, test_case_not_null):
        """Test execution where all chunks pass validation."""
        # Create DataFrame with no nulls - all rows should pass
        df = pd.DataFrame(
            {
                "id": range(1, 101),
                "name": [f"Person_{i}" for i in range(1, 101)],
                "age": [25 + (i % 20) for i in range(1, 101)],  # Ages 25-44
            }
        )

        result = chunked_executor.execute(
            test_case=test_case_not_null,
            df=df,
            chunksize=25,
            mode="short-circuit",
        )

        assert result.test_case == test_case_not_null
        assert result.aggregated_result.testCaseStatus.value == "Success"
        assert len(result.chunk_results) == 4  # 100 rows / 25 = 4 chunks
        assert len(result.failed_indices_per_chunk) == 4

    def test_execute_with_failures(
        self, chunked_executor, test_case_not_null, sample_dataframe
    ):
        """Test execution where some chunks have failures."""
        # Every 10th name is None, so should have failures
        result = chunked_executor.execute(
            test_case=test_case_not_null,
            df=sample_dataframe,
            chunksize=25,
            mode="report-errors",
        )

        assert result.aggregated_result.testCaseStatus.value == "Failed"
        assert len(result.chunk_results) == 4
        # Each chunk should have failures (every 10th row)
        for failed_indices in result.failed_indices_per_chunk:
            assert len(failed_indices) > 0

    def test_execute_short_circuit_stops_on_failure(
        self, chunked_executor, test_case_not_null, sample_dataframe
    ):
        """Test that short-circuit mode stops on first failure."""
        result = chunked_executor.execute(
            test_case=test_case_not_null,
            df=sample_dataframe,
            chunksize=25,
            mode="short-circuit",
        )

        # Should stop after first chunk with failure
        assert len(result.chunk_results) == 1
        assert result.chunk_results[0].testCaseStatus.value == "Failed"

    def test_execute_report_errors_continues(
        self, chunked_executor, test_case_not_null, sample_dataframe
    ):
        """Test that report-errors mode continues through all chunks."""
        result = chunked_executor.execute(
            test_case=test_case_not_null,
            df=sample_dataframe,
            chunksize=25,
            mode="report-errors",
        )

        # Should process all chunks
        assert len(result.chunk_results) == 4
        assert all(
            len(indices) > 0 for indices in result.failed_indices_per_chunk
        )  # All chunks have failures

    def test_execute_single_chunk(self, chunked_executor, test_case_not_null):
        """Test execution with single chunk (entire DataFrame)."""
        # DataFrame with no nulls
        df = pd.DataFrame(
            {
                "id": range(1, 51),
                "name": [f"Person_{i}" for i in range(1, 51)],
                "age": range(20, 70),
            }
        )

        result = chunked_executor.execute(
            test_case=test_case_not_null,
            df=df,
            chunksize=1000,  # Larger than DataFrame
            mode="short-circuit",
        )

        assert len(result.chunk_results) == 1
        assert result.aggregated_result.testCaseStatus.value == "Success"

    def test_execute_tracks_failed_indices(self, chunked_executor, test_case_not_null):
        """Test that execution correctly tracks failed row indices."""
        # Create DataFrame with specific null pattern
        df = pd.DataFrame(
            {
                "id": [1, 2, 3, 4, 5],
                "name": ["A", None, "C", None, "E"],
                "age": [20, 21, 22, 23, 24],
            }
        )

        result = chunked_executor.execute(
            test_case=test_case_not_null,
            df=df,
            chunksize=5,
            mode="report-errors",
        )

        # Should identify rows 1 and 3 (0-indexed) as failed
        assert len(result.failed_indices_per_chunk[0]) == 2
        assert 1 in result.failed_indices_per_chunk[0]
        assert 3 in result.failed_indices_per_chunk[0]

    def test_execute_aggregates_results_correctly(
        self, chunked_executor, test_case_not_null, sample_dataframe
    ):
        """Test that results are aggregated correctly across chunks."""
        result = chunked_executor.execute(
            test_case=test_case_not_null,
            df=sample_dataframe,
            chunksize=25,
            mode="report-errors",
        )

        # Each chunk has 10% nulls (every 10th row)
        # Total: 100 rows, 10 nulls = 90 passed, 10 failed
        assert result.aggregated_result.passedRows == 90
        assert result.aggregated_result.failedRows == 10
        assert result.aggregated_result.passedRowsPercentage == pytest.approx(90.0)
        assert result.aggregated_result.failedRowsPercentage == pytest.approx(10.0)

    def test_execute_empty_dataframe(self, chunked_executor, test_case_not_null):
        """Test execution on empty DataFrame."""
        df = pd.DataFrame({"id": [], "name": [], "age": []})

        result = chunked_executor.execute(
            test_case=test_case_not_null,
            df=df,
            chunksize=10,
            mode="short-circuit",
        )

        assert len(result.chunk_results) == 0
        assert result.aggregated_result.testCaseStatus.value == "Aborted"


class TestIntegration:
    """Integration tests with real validators."""

    def test_integration_with_not_null_validator(
        self, chunked_executor, test_case_not_null
    ):
        """Integration test with NotNull validator."""
        df = pd.DataFrame(
            {
                "id": range(50),
                "name": ["Person" if i % 5 != 0 else None for i in range(50)],
                "age": range(20, 70),
            }
        )

        result = chunked_executor.execute(
            test_case=test_case_not_null,
            df=df,
            chunksize=10,
            mode="report-errors",
        )

        # 10 nulls out of 50 rows
        assert result.aggregated_result.failedRows == 10
        assert result.aggregated_result.passedRows == 40

    def test_integration_with_between_validator(
        self, chunked_executor, test_case_between
    ):
        """Integration test with Between validator."""
        df = pd.DataFrame(
            {
                "id": range(30),
                "name": [f"Person_{i}" for i in range(30)],
                "age": [
                    15,
                    20,
                    30,
                    40,
                    50,
                    60,
                    65,
                    70,
                    75,
                    25,
                ]
                * 3,  # Some out of range
            }
        )

        result = chunked_executor.execute(
            test_case=test_case_between,
            df=df,
            chunksize=10,
            mode="report-errors",
        )

        # Values 15, 70, 75 are out of range [18-65]
        # That's 3 values * 3 repetitions = 9 out of range
        assert result.aggregated_result.failedRows == 9
        assert result.aggregated_result.passedRows == 21


@pytest.mark.parametrize(
    "total_rows,chunksize,expected_chunks",
    [
        (100, 10, 10),
        (100, 25, 4),
        (100, 33, 4),  # 33, 33, 33, 1
        (100, 100, 1),
        (100, 200, 1),
        (50, 10, 5),
    ],
)
def test_chunking_parametrized(
    chunked_executor, total_rows, chunksize, expected_chunks
):
    """Parametrized test for different chunking scenarios."""
    df = pd.DataFrame({"col": range(total_rows)})
    chunks = chunked_executor._chunk_dataframe(df, chunksize)

    assert len(chunks) == expected_chunks
    assert sum(len(chunk) for chunk in chunks) == total_rows
