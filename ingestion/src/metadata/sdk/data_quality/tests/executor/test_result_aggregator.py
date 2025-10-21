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

"""Unit tests for result aggregation logic."""

import uuid

import pandas as pd
import pytest

from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, Timestamp
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.data_quality.executor.result_aggregator import ResultAggregator


@pytest.fixture
def test_case_not_null():
    """Create a columnValuesToBeNotNull test case."""
    return TestCase(
        id=uuid.uuid4(),
        name="name_not_null",
        fullyQualifiedName=FullyQualifiedEntityName("test.table.name.name_not_null"),
        testDefinition=EntityReference(
            id=uuid.uuid4(),
            type="testDefinition",
            name="columnValuesToBeNotNull",
            fullyQualifiedName="test.columnValuesToBeNotNull",
        ),
        entityLink="<#E::table::test.table::columns::name>",
        testSuite=EntityReference(
            id=uuid.uuid4(),
            type="testSuite",
            name="test_suite",
            fullyQualifiedName="test.test_suite",
        ),
    )


@pytest.fixture
def test_case_between():
    """Create a columnValuesToBeBetween test case."""
    return TestCase(
        id=uuid.uuid4(),
        name="age_between",
        fullyQualifiedName=FullyQualifiedEntityName("test.table.age.age_between"),
        testDefinition=EntityReference(
            id=uuid.uuid4(),
            type="testDefinition",
            name="columnValuesToBeBetween",
            fullyQualifiedName="test.columnValuesToBeBetween",
        ),
        entityLink="<#E::table::test.table::columns::age>",
        testSuite=EntityReference(
            id=uuid.uuid4(),
            type="testSuite",
            name="test_suite",
            fullyQualifiedName="test.test_suite",
        ),
        parameterValues=[
            TestCaseParameterValue(name="minValue", value="18"),
            TestCaseParameterValue(name="maxValue", value="65"),
        ],
    )


@pytest.fixture
def sample_dataframe():
    """Create a sample DataFrame for testing."""
    return pd.DataFrame(
        {
            "id": [1, 2, 3, 4, 5],
            "name": ["Alice", "Bob", None, "David", "Eve"],
            "age": [25, 30, 15, 40, 70],
        }
    )


class TestAggregateChunkResults:
    """Test aggregate_chunk_results method."""

    def test_aggregate_all_success(self, test_case_not_null):
        """Test aggregating results where all chunks passed."""
        chunk_results = [
            TestCaseResult(
                timestamp=1234567890,
                testCaseStatus=TestCaseStatus.Success,
                result="Chunk 0 passed",
                passedRows=100,
                failedRows=0,
                testResultValue=[TestResultValue(name="nullCount", value="0")],
            ),
            TestCaseResult(
                timestamp=1234567891,
                testCaseStatus=TestCaseStatus.Success,
                result="Chunk 1 passed",
                passedRows=100,
                failedRows=0,
                testResultValue=[TestResultValue(name="nullCount", value="0")],
            ),
        ]

        aggregated = ResultAggregator.aggregate_chunk_results(
            chunk_results, test_case_not_null
        )

        assert aggregated.testCaseStatus == TestCaseStatus.Success
        assert aggregated.passedRows == 200
        assert aggregated.failedRows == 0
        assert aggregated.passedRowsPercentage == 100.0
        assert aggregated.failedRowsPercentage == 0.0

    def test_aggregate_with_failures(self, test_case_not_null):
        """Test aggregating results where some chunks failed."""
        chunk_results = [
            TestCaseResult(
                timestamp=1234567890,
                testCaseStatus=TestCaseStatus.Success,
                result="Chunk 0 passed",
                passedRows=100,
                failedRows=0,
                testResultValue=[TestResultValue(name="nullCount", value="0")],
            ),
            TestCaseResult(
                timestamp=1234567891,
                testCaseStatus=TestCaseStatus.Failed,
                result="Chunk 1 failed",
                passedRows=90,
                failedRows=10,
                testResultValue=[TestResultValue(name="nullCount", value="10")],
            ),
        ]

        aggregated = ResultAggregator.aggregate_chunk_results(
            chunk_results, test_case_not_null
        )

        assert aggregated.testCaseStatus == TestCaseStatus.Failed
        assert aggregated.passedRows == 190
        assert aggregated.failedRows == 10
        assert aggregated.passedRowsPercentage == 95.0
        assert aggregated.failedRowsPercentage == 5.0

    def test_aggregate_empty_list(self, test_case_not_null):
        """Test aggregating empty result list."""
        aggregated = ResultAggregator.aggregate_chunk_results([], test_case_not_null)

        assert aggregated.testCaseStatus == TestCaseStatus.Aborted
        assert "No chunk results" in aggregated.result

    def test_aggregate_preserves_timestamp(self, test_case_not_null):
        """Test that aggregation uses first chunk's timestamp."""
        chunk_results = [
            TestCaseResult(
                timestamp=Timestamp(1111111111),
                testCaseStatus=TestCaseStatus.Success,
                result="Chunk 0",
                passedRows=100,
                failedRows=0,
            ),
            TestCaseResult(
                timestamp=Timestamp(2222222222),
                testCaseStatus=TestCaseStatus.Success,
                result="Chunk 1",
                passedRows=100,
                failedRows=0,
            ),
        ]

        aggregated = ResultAggregator.aggregate_chunk_results(
            chunk_results, test_case_not_null
        )

        assert aggregated.timestamp.root == 1111111111

    def test_aggregate_preserves_bounds(self, test_case_between):
        """Test that aggregation preserves min/max bounds from first chunk."""
        chunk_results = [
            TestCaseResult(
                timestamp=1234567890,
                testCaseStatus=TestCaseStatus.Success,
                result="Chunk 0",
                passedRows=100,
                failedRows=0,
                minBound=18.0,
                maxBound=65.0,
            ),
            TestCaseResult(
                timestamp=1234567891,
                testCaseStatus=TestCaseStatus.Success,
                result="Chunk 1",
                passedRows=100,
                failedRows=0,
                minBound=18.0,
                maxBound=65.0,
            ),
        ]

        aggregated = ResultAggregator.aggregate_chunk_results(
            chunk_results, test_case_between
        )

        assert aggregated.minBound == 18.0
        assert aggregated.maxBound == 65.0


class TestAggregateTestResultValues:
    """Test _aggregate_test_result_values method."""

    def test_aggregate_count_based_validator(self, test_case_not_null):
        """Test aggregating count-based validator results."""
        chunk_results = [
            TestCaseResult(
                timestamp=1234567890,
                testCaseStatus=TestCaseStatus.Success,
                result="Chunk 0",
                testResultValue=[TestResultValue(name="nullCount", value="5")],
            ),
            TestCaseResult(
                timestamp=1234567891,
                testCaseStatus=TestCaseStatus.Success,
                result="Chunk 1",
                testResultValue=[TestResultValue(name="nullCount", value="3")],
            ),
        ]

        aggregated_values = ResultAggregator._aggregate_test_result_values(
            chunk_results, test_case_not_null
        )

        assert len(aggregated_values) == 1
        assert aggregated_values[0].value == "8"

    def test_aggregate_range_check_all_pass(self, test_case_between):
        """Test aggregating range check where all chunks passed."""
        chunk_results = [
            TestCaseResult(
                timestamp=1234567890,
                testCaseStatus=TestCaseStatus.Success,
                result="Chunk 0",
                testResultValue=[TestResultValue(name="betweenCount", value="100")],
            ),
            TestCaseResult(
                timestamp=1234567891,
                testCaseStatus=TestCaseStatus.Success,
                result="Chunk 1",
                testResultValue=[TestResultValue(name="betweenCount", value="100")],
            ),
        ]

        aggregated_values = ResultAggregator._aggregate_test_result_values(
            chunk_results, test_case_between
        )

        assert len(aggregated_values) == 1
        assert "chunks passed" in aggregated_values[0].value

    def test_aggregate_range_check_with_failure(self, test_case_between):
        """Test aggregating range check where some chunks failed."""
        chunk_results = [
            TestCaseResult(
                timestamp=1234567890,
                testCaseStatus=TestCaseStatus.Success,
                result="Chunk 0",
                testResultValue=[TestResultValue(name="betweenCount", value="100")],
            ),
            TestCaseResult(
                timestamp=1234567891,
                testCaseStatus=TestCaseStatus.Failed,
                result="Chunk 1 failed",
                testResultValue=[
                    TestResultValue(name="betweenCount", value="95"),
                    TestResultValue(name="failedValues", value="5"),
                ],
            ),
        ]

        aggregated_values = ResultAggregator._aggregate_test_result_values(
            chunk_results, test_case_between
        )

        assert len(aggregated_values) == 2
        assert aggregated_values[0].value == "95"


class TestIdentifyFailedRows:
    """Test identify_failed_rows method."""

    def test_identify_null_rows(self, sample_dataframe, test_case_not_null):
        """Test identifying rows with null values."""
        result = TestCaseResult(
            timestamp=1234567890,
            testCaseStatus=TestCaseStatus.Failed,
            result="Found null values",
        )

        failed_indices = ResultAggregator.identify_failed_rows(
            sample_dataframe, test_case_not_null, result
        )

        assert len(failed_indices) == 1
        assert 2 in failed_indices  # Row with None in name column

    def test_identify_out_of_range_rows(self, sample_dataframe, test_case_between):
        """Test identifying rows with out-of-range values."""
        result = TestCaseResult(
            timestamp=1234567890,
            testCaseStatus=TestCaseStatus.Failed,
            result="Values out of range",
        )

        failed_indices = ResultAggregator.identify_failed_rows(
            sample_dataframe, test_case_between, result
        )

        assert len(failed_indices) == 2
        assert 2 in failed_indices  # age = 15
        assert 4 in failed_indices  # age = 70

    def test_identify_rows_success_returns_empty(
        self, sample_dataframe, test_case_not_null
    ):
        """Test that successful results return empty set."""
        result = TestCaseResult(
            timestamp=1234567890,
            testCaseStatus=TestCaseStatus.Success,
            result="All passed",
        )

        failed_indices = ResultAggregator.identify_failed_rows(
            sample_dataframe, test_case_not_null, result
        )

        assert len(failed_indices) == 0

    def test_identify_rows_missing_column(self, sample_dataframe):
        """Test identifying rows when column doesn't exist."""
        test_case = TestCase(
            id=uuid.uuid4(),
            name="missing_col_test",
            fullyQualifiedName=FullyQualifiedEntityName("test.table.missing.test"),
            testDefinition=EntityReference(
                id=uuid.uuid4(),
                type="testDefinition",
                name="columnValuesToBeNotNull",
                fullyQualifiedName="test.columnValuesToBeNotNull",
            ),
            entityLink="<#E::table::test.table::columns::nonexistent>",
            testSuite=EntityReference(
                id=uuid.uuid4(),
                type="testSuite",
                name="test_suite",
                fullyQualifiedName="test.test_suite",
            ),
        )

        result = TestCaseResult(
            timestamp=1234567890,
            testCaseStatus=TestCaseStatus.Failed,
            result="Column not found",
        )

        failed_indices = ResultAggregator.identify_failed_rows(
            sample_dataframe, test_case, result
        )

        assert len(failed_indices) == 0


class TestHelperMethods:
    """Test helper methods for extracting parameters."""

    def test_extract_column_name_from_entity_link(self, test_case_not_null):
        """Test extracting column name from entity link."""
        column_name = ResultAggregator._extract_column_name(test_case_not_null)
        assert column_name == "name"

    def test_extract_column_name_no_columns_in_link(self):
        """Test extracting column name when entity link has no columns."""
        test_case = TestCase(
            id=uuid.uuid4(),
            name="test",
            fullyQualifiedName=FullyQualifiedEntityName("test.test"),
            testDefinition=EntityReference(
                id=uuid.uuid4(),
                type="testDefinition",
                name="test",
                fullyQualifiedName="test.test",
            ),
            entityLink="<#E::table::test.table>",
            testSuite=EntityReference(
                id=uuid.uuid4(),
                type="testSuite",
                name="suite",
                fullyQualifiedName="test.suite",
            ),
        )

        column_name = ResultAggregator._extract_column_name(test_case)
        assert column_name is None

    def test_extract_min_max_bounds(self, test_case_between):
        """Test extracting min/max bounds from parameters."""
        min_val, max_val = ResultAggregator._extract_min_max_bounds(test_case_between)

        assert min_val == 18.0
        assert max_val == 65.0

    def test_extract_min_max_bounds_no_params(self, test_case_not_null):
        """Test extracting bounds when no parameters."""
        min_val, max_val = ResultAggregator._extract_min_max_bounds(test_case_not_null)

        assert min_val is None
        assert max_val is None

    def test_extract_regex_pattern(self):
        """Test extracting regex pattern from parameters."""
        test_case = TestCase(
            id=uuid.uuid4(),
            name="regex_test",
            fullyQualifiedName=FullyQualifiedEntityName("test.table.col.regex"),
            testDefinition=EntityReference(
                id=uuid.uuid4(),
                type="testDefinition",
                name="columnValuesToMatchRegex",
                fullyQualifiedName="test.columnValuesToMatchRegex",
            ),
            entityLink="<#E::table::test.table::columns::email>",
            testSuite=EntityReference(
                id=uuid.uuid4(),
                type="testSuite",
                name="suite",
                fullyQualifiedName="test.suite",
            ),
            parameterValues=[
                TestCaseParameterValue(name="regex", value=r"^\w+@\w+\.\w+$"),
            ],
        )

        pattern = ResultAggregator._extract_regex_pattern(test_case)
        assert pattern == r"^\w+@\w+\.\w+$"

    def test_extract_allowed_values_from_string(self):
        """Test extracting allowed values from comma-separated string."""
        test_case = TestCase(
            id=uuid.uuid4(),
            name="in_set_test",
            fullyQualifiedName=FullyQualifiedEntityName("test.table.col.in_set"),
            testDefinition=EntityReference(
                id=uuid.uuid4(),
                type="testDefinition",
                name="columnValuesToBeInSet",
                fullyQualifiedName="test.columnValuesToBeInSet",
            ),
            entityLink="<#E::table::test.table::columns::status>",
            testSuite=EntityReference(
                id=uuid.uuid4(),
                type="testSuite",
                name="suite",
                fullyQualifiedName="test.suite",
            ),
            parameterValues=[
                TestCaseParameterValue(
                    name="allowedValues", value="active, pending, completed"
                ),
            ],
        )

        allowed_values = ResultAggregator._extract_allowed_values(test_case)
        assert allowed_values == ["active", "pending", "completed"]


@pytest.mark.parametrize(
    "passed_rows_list,failed_rows_list,expected_passed_pct,expected_failed_pct",
    [
        ([100, 100], [0, 0], 100.0, 0.0),
        ([90, 90], [10, 10], 90.0, 10.0),
        ([80, 70], [20, 30], 75.0, 25.0),
        ([50], [50], 50.0, 50.0),
    ],
)
def test_percentage_calculation(
    passed_rows_list,
    failed_rows_list,
    expected_passed_pct,
    expected_failed_pct,
    test_case_not_null,
):
    """Parametrized test for percentage calculations."""
    chunk_results = [
        TestCaseResult(
            timestamp=1234567890 + i,
            testCaseStatus=(
                TestCaseStatus.Success if failed == 0 else TestCaseStatus.Failed
            ),
            result=f"Chunk {i}",
            passedRows=passed,
            failedRows=failed,
        )
        for i, (passed, failed) in enumerate(zip(passed_rows_list, failed_rows_list))
    ]

    aggregated = ResultAggregator.aggregate_chunk_results(
        chunk_results, test_case_not_null
    )

    assert aggregated.passedRowsPercentage == pytest.approx(expected_passed_pct)
    assert aggregated.failedRowsPercentage == pytest.approx(expected_failed_pct)
