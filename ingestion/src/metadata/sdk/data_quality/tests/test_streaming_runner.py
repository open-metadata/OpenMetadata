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

"""Unit tests for StreamingRunner."""

import uuid
from unittest.mock import Mock

import pandas as pd
import pytest

from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.data_quality.streaming_runner import StreamingRunner


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
def streaming_runner(mock_ometa):
    """Create a StreamingRunner instance."""
    return StreamingRunner(mock_ometa)


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
def sample_dataframe():
    """Create a sample DataFrame for testing."""
    return pd.DataFrame(
        {
            "id": list(range(1, 101)),
            "name": [f"Person_{i}" if i % 10 != 0 else None for i in range(1, 101)],
            "age": [20 + (i % 40) for i in range(1, 101)],
        }
    )


class TestValidate:
    """Test validate method."""

    def test_validate_filter_mode(
        self, streaming_runner, test_case_not_null, sample_dataframe
    ):
        """Test validation in filter mode (removes bad rows)."""
        results = list(
            streaming_runner.validate(
                df=sample_dataframe,
                test_cases=[test_case_not_null],
                chunksize=25,
                mode="filter",
            )
        )

        # Should have 4 chunks
        assert len(results) == 4

        # Each result should have clean data with failed rows removed
        for result in results:
            assert result.df is not None
            # Verify no nulls in returned data
            assert result.df["name"].notna().all()

    def test_validate_report_mode(
        self, streaming_runner, test_case_not_null, sample_dataframe
    ):
        """Test validation in report mode (includes error details)."""
        results = list(
            streaming_runner.validate(
                df=sample_dataframe,
                test_cases=[test_case_not_null],
                chunksize=25,
                mode="report",
            )
        )

        # Should have 4 chunks
        assert len(results) == 4

        # Check that failures are reported
        failed_chunks = [r for r in results if not r.success]
        assert len(failed_chunks) > 0

        # Failed chunks should have error DataFrames
        for result in failed_chunks:
            assert result.errors is not None
            assert len(result.errors) > 0

    def test_validate_no_tests(self, streaming_runner, sample_dataframe):
        """Test validation with empty test case list."""
        results = list(
            streaming_runner.validate(
                df=sample_dataframe,
                test_cases=[],
                chunksize=25,
            )
        )

        # Should yield all chunks unchanged
        assert len(results) == 4
        for result in results:
            assert result.success is True
            assert result.errors is None
            assert len(result.df) == 25

    def test_validate_chunk_numbers(
        self, streaming_runner, test_case_not_null, sample_dataframe
    ):
        """Test that chunk numbers are sequential."""
        results = list(
            streaming_runner.validate(
                df=sample_dataframe,
                test_cases=[test_case_not_null],
                chunksize=25,
            )
        )

        chunk_numbers = [r.chunk_number for r in results]
        assert chunk_numbers == [0, 1, 2, 3]

    def test_validate_single_chunk(
        self, streaming_runner, test_case_not_null, sample_dataframe
    ):
        """Test validation with single chunk (entire DataFrame)."""
        results = list(
            streaming_runner.validate(
                df=sample_dataframe,
                test_cases=[test_case_not_null],
                chunksize=1000,  # Larger than DataFrame
                mode="filter",
            )
        )

        # Should have only 1 chunk
        assert len(results) == 1
        assert results[0].chunk_number == 0

    def test_validate_all_passing(self, streaming_runner, test_case_not_null):
        """Test validation where all rows pass."""
        # DataFrame with no nulls
        df = pd.DataFrame(
            {
                "id": range(1, 51),
                "name": [f"Person_{i}" for i in range(1, 51)],
                "age": [25 + (i % 20) for i in range(1, 51)],
            }
        )

        results = list(
            streaming_runner.validate(
                df=df,
                test_cases=[test_case_not_null],
                chunksize=10,
                mode="filter",
            )
        )

        # All chunks should pass
        assert all(r.success for r in results)
        # No errors
        assert all(r.errors is None for r in results)

    def test_validate_empty_dataframe(self, streaming_runner, test_case_not_null):
        """Test validation on empty DataFrame."""
        df = pd.DataFrame({"id": [], "name": [], "age": []})

        results = list(
            streaming_runner.validate(
                df=df,
                test_cases=[test_case_not_null],
                chunksize=10,
            )
        )

        # Empty DataFrame yields no chunks
        assert len(results) == 0

    def test_validate_preserves_original_dataframe(
        self, streaming_runner, test_case_not_null, sample_dataframe
    ):
        """Test that validation doesn't modify the original DataFrame."""
        original_df = sample_dataframe.copy()

        list(
            streaming_runner.validate(
                df=sample_dataframe,
                test_cases=[test_case_not_null],
                chunksize=25,
                mode="filter",
            )
        )

        # Original DataFrame should be unchanged
        pd.testing.assert_frame_equal(sample_dataframe, original_df)


class TestChunking:
    """Test _chunk_dataframe method."""

    def test_chunk_dataframe_exact_division(self, streaming_runner):
        """Test chunking with exact division."""
        df = pd.DataFrame({"col": range(100)})
        chunks = list(streaming_runner._chunk_dataframe(df, chunksize=10))

        assert len(chunks) == 10
        for chunk in chunks:
            assert len(chunk) == 10

    def test_chunk_dataframe_non_exact_division(self, streaming_runner):
        """Test chunking with non-exact division."""
        df = pd.DataFrame({"col": range(105)})
        chunks = list(streaming_runner._chunk_dataframe(df, chunksize=10))

        assert len(chunks) == 11
        assert len(chunks[-1]) == 5  # Last chunk has remaining rows

    def test_chunk_dataframe_preserves_indices(self, streaming_runner):
        """Test that chunking preserves DataFrame indices."""
        df = pd.DataFrame({"col": range(25)}, index=range(100, 125))
        chunks = list(streaming_runner._chunk_dataframe(df, chunksize=10))

        assert chunks[0].index.tolist() == list(range(100, 110))
        assert chunks[1].index.tolist() == list(range(110, 120))
        assert chunks[2].index.tolist() == list(range(120, 125))


class TestIntegration:
    """Integration tests with real validators."""

    def test_integration_filter_mode_removes_bad_rows(
        self, streaming_runner, test_case_not_null
    ):
        """Integration test: filter mode removes rows with nulls."""
        df = pd.DataFrame(
            {
                "id": range(1, 21),
                "name": [f"Person_{i}" if i % 5 != 0 else None for i in range(1, 21)],
                "age": range(20, 40),
            }
        )

        results = list(
            streaming_runner.validate(
                df=df,
                test_cases=[test_case_not_null],
                chunksize=10,
                mode="filter",
            )
        )

        # Collect all clean rows
        all_clean_rows = pd.concat([r.df for r in results])

        # Should have 16 clean rows (20 total - 4 nulls)
        assert len(all_clean_rows) == 16
        # All names should be non-null
        assert all_clean_rows["name"].notna().all()

    def test_integration_report_mode_identifies_errors(
        self, streaming_runner, test_case_not_null
    ):
        """Integration test: report mode identifies error rows."""
        df = pd.DataFrame(
            {
                "id": range(1, 21),
                "name": [f"Person_{i}" if i % 5 != 0 else None for i in range(1, 21)],
                "age": range(20, 40),
            }
        )

        results = list(
            streaming_runner.validate(
                df=df,
                test_cases=[test_case_not_null],
                chunksize=10,
                mode="report",
            )
        )

        # Collect all error rows
        error_dfs = [r.errors for r in results if r.errors is not None]
        all_errors = pd.concat(error_dfs) if error_dfs else pd.DataFrame()

        # Should identify 4 error rows
        assert len(all_errors) == 4
        # All error rows should have null names
        assert all_errors["name"].isna().all()

    def test_integration_streaming_memory_efficiency(
        self, streaming_runner, test_case_not_null
    ):
        """Integration test: verify streaming processes chunks one at a time."""
        # Create large DataFrame
        df = pd.DataFrame(
            {
                "id": range(1, 1001),
                "name": [f"Person_{i}" for i in range(1, 1001)],
                "age": [20 + (i % 40) for i in range(1, 1001)],
            }
        )

        chunk_count = 0
        for result in streaming_runner.validate(
            df=df,
            test_cases=[test_case_not_null],
            chunksize=100,
            mode="filter",
        ):
            chunk_count += 1
            # Each chunk should be processed independently
            assert len(result.df) <= 100

        # Should have 10 chunks
        assert chunk_count == 10
