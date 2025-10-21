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

"""Unit tests for validation result models."""

import uuid
from typing import List, Set

import pandas as pd
import pytest

from metadata.data_quality.api.models import TestCaseResultResponse
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.data_quality.models.validation_result import (
    ChunkedTestResults,
    FullTableTestResult,
    ValidationResult,
)


@pytest.fixture
def sample_dataframe():
    """Create a sample DataFrame for testing."""
    return pd.DataFrame(
        {
            "id": [1, 2, 3, 4, 5],
            "name": ["Alice", "Bob", None, "David", "Eve"],
            "age": [25, 30, 35, 40, 45],
        }
    )


@pytest.fixture
def test_case_fixture():
    """Create a sample TestCase for testing."""
    test_definition_ref = EntityReference(
        id=uuid.uuid4(),
        type="testDefinition",
        name="columnValuesToBeNotNull",
        fullyQualifiedName="test.columnValuesToBeNotNull",
    )

    test_suite_ref = EntityReference(
        id=uuid.uuid4(),
        type="testSuite",
        name="test_suite",
        fullyQualifiedName="test.test_suite",
    )

    return TestCase(
        id=uuid.uuid4(),
        name="name_not_null",
        fullyQualifiedName=FullyQualifiedEntityName("test.table.name.name_not_null"),
        testDefinition=test_definition_ref,
        entityLink="<#E::table::test.table::columns::name>",
        testSuite=test_suite_ref,
    )


@pytest.fixture
def successful_test_result(test_case_fixture):
    """Create a successful test result."""
    result = TestCaseResult(
        timestamp=1234567890,
        testCaseStatus=TestCaseStatus.Success,
        result="All values are not null",
        testResultValue=[
            TestResultValue(name="nullCount", value="0"),
        ],
    )

    return TestCaseResultResponse(
        testCaseResult=result,
        testCase=test_case_fixture,
    )


@pytest.fixture
def failed_test_result(test_case_fixture):
    """Create a failed test result."""
    result = TestCaseResult(
        timestamp=1234567890,
        testCaseStatus=TestCaseStatus.Failed,
        result="Found 1 null value",
        testResultValue=[
            TestResultValue(name="nullCount", value="1"),
        ],
    )

    return TestCaseResultResponse(
        testCaseResult=result,
        testCase=test_case_fixture,
    )


class TestValidationResult:
    """Test ValidationResult dataclass."""

    def test_validation_result_creation(self, sample_dataframe, successful_test_result):
        """Test creating ValidationResult directly."""
        result = ValidationResult(
            chunk_number=0,
            success=True,
            df=sample_dataframe,
            errors=None,
            error_summary=None,
            test_results=[successful_test_result],
        )

        assert result.chunk_number == 0
        assert result.success is True
        assert result.df.equals(sample_dataframe)
        assert result.errors is None
        assert result.error_summary is None
        assert len(result.test_results) == 1

    def test_validation_result_is_frozen(
        self, sample_dataframe, successful_test_result
    ):
        """Test that ValidationResult is immutable."""
        result = ValidationResult(
            chunk_number=0,
            success=True,
            df=sample_dataframe,
            errors=None,
            error_summary=None,
            test_results=[successful_test_result],
        )

        with pytest.raises((AttributeError, TypeError)):
            result.success = False

    def test_from_chunk_results_all_pass(
        self, sample_dataframe, successful_test_result
    ):
        """Test from_chunk_results with all tests passing."""
        result = ValidationResult.from_chunk_results(
            chunk_number=0,
            chunk_df=sample_dataframe,
            test_results=[successful_test_result],
            failed_indices=set(),
            mode="short-circuit",
        )

        assert result.success is True
        assert result.df.equals(sample_dataframe)
        assert result.errors is None
        assert result.error_summary is None

    def test_from_chunk_results_short_circuit_failure(
        self, sample_dataframe, failed_test_result
    ):
        """Test from_chunk_results in short-circuit mode with failure."""
        failed_indices = {2}

        result = ValidationResult.from_chunk_results(
            chunk_number=0,
            chunk_df=sample_dataframe,
            test_results=[failed_test_result],
            failed_indices=failed_indices,
            mode="short-circuit",
        )

        assert result.success is False
        assert len(result.df) == 0
        assert result.errors is not None
        assert len(result.errors) == len(sample_dataframe)
        assert "name_not_null" in result.error_summary

    def test_from_chunk_results_report_errors_with_failures(
        self, sample_dataframe, failed_test_result
    ):
        """Test from_chunk_results in report-errors mode with failures."""
        failed_indices = {2}

        result = ValidationResult.from_chunk_results(
            chunk_number=0,
            chunk_df=sample_dataframe,
            test_results=[failed_test_result],
            failed_indices=failed_indices,
            mode="report-errors",
        )

        assert result.success is False
        assert len(result.df) == 4
        assert result.errors is not None
        assert len(result.errors) == 1
        assert "_validation_error" in result.errors.columns
        assert 2 in result.errors.index

    def test_from_chunk_results_report_errors_no_failures(
        self, sample_dataframe, successful_test_result
    ):
        """Test from_chunk_results in report-errors mode with no failures."""
        result = ValidationResult.from_chunk_results(
            chunk_number=0,
            chunk_df=sample_dataframe,
            test_results=[successful_test_result],
            failed_indices=set(),
            mode="report-errors",
        )

        assert result.success is True
        assert result.df.equals(sample_dataframe)
        assert result.errors is None
        assert result.error_summary is None

    def test_from_chunk_results_multiple_failures(
        self, sample_dataframe, test_case_fixture
    ):
        """Test from_chunk_results with multiple test failures."""
        failed_result_1 = TestCaseResultResponse(
            testCaseResult=TestCaseResult(
                timestamp=1234567890,
                testCaseStatus=TestCaseStatus.Failed,
                result="Found 1 null value",
            ),
            testCase=TestCase(
                id=uuid.uuid4(),
                name="name_not_null",
                fullyQualifiedName=FullyQualifiedEntityName(
                    "test.table.name.name_not_null"
                ),
                testDefinition=test_case_fixture.testDefinition,
                entityLink="<#E::table::test.table::columns::name>",
                testSuite=test_case_fixture.testSuite,
            ),
        )

        failed_result_2 = TestCaseResultResponse(
            testCaseResult=TestCaseResult(
                timestamp=1234567890,
                testCaseStatus=TestCaseStatus.Failed,
                result="Age out of range",
            ),
            testCase=TestCase(
                id=uuid.uuid4(),
                name="age_in_range",
                fullyQualifiedName=FullyQualifiedEntityName(
                    "test.table.age.age_in_range"
                ),
                testDefinition=test_case_fixture.testDefinition,
                entityLink="<#E::table::test.table::columns::age>",
                testSuite=test_case_fixture.testSuite,
            ),
        )

        failed_indices = {2, 4}

        result = ValidationResult.from_chunk_results(
            chunk_number=1,
            chunk_df=sample_dataframe,
            test_results=[failed_result_1, failed_result_2],
            failed_indices=failed_indices,
            mode="report-errors",
        )

        assert result.success is False
        assert len(result.df) == 3
        assert len(result.errors) == 2
        assert "_validation_error" in result.errors.columns

    def test_from_chunk_results_empty_dataframe(self, successful_test_result):
        """Test from_chunk_results with empty DataFrame."""
        empty_df = pd.DataFrame(columns=["id", "name", "age"])

        result = ValidationResult.from_chunk_results(
            chunk_number=0,
            chunk_df=empty_df,
            test_results=[successful_test_result],
            failed_indices=set(),
            mode="short-circuit",
        )

        assert result.success is True
        assert len(result.df) == 0
        assert result.errors is None


class TestChunkedTestResults:
    """Test ChunkedTestResults dataclass."""

    def test_chunked_test_results_creation(self, test_case_fixture):
        """Test creating ChunkedTestResults."""
        aggregated_result = TestCaseResult(
            timestamp=1234567890,
            testCaseStatus=TestCaseStatus.Success,
            result="All chunks passed",
        )

        chunk_results = [
            TestCaseResult(
                timestamp=1234567890,
                testCaseStatus=TestCaseStatus.Success,
                result="Chunk 0 passed",
            ),
            TestCaseResult(
                timestamp=1234567891,
                testCaseStatus=TestCaseStatus.Success,
                result="Chunk 1 passed",
            ),
        ]

        failed_indices: List[Set[int]] = [set(), set()]

        result = ChunkedTestResults(
            test_case=test_case_fixture,
            aggregated_result=aggregated_result,
            failed_indices_per_chunk=failed_indices,
            chunk_results=chunk_results,
        )

        assert result.test_case == test_case_fixture
        assert result.aggregated_result.testCaseStatus == TestCaseStatus.Success
        assert len(result.chunk_results) == 2
        assert len(result.failed_indices_per_chunk) == 2

    def test_chunked_test_results_with_failures(self, test_case_fixture):
        """Test ChunkedTestResults with failures in some chunks."""
        aggregated_result = TestCaseResult(
            timestamp=1234567890,
            testCaseStatus=TestCaseStatus.Failed,
            result="Some chunks failed",
        )

        chunk_results = [
            TestCaseResult(
                timestamp=1234567890,
                testCaseStatus=TestCaseStatus.Success,
                result="Chunk 0 passed",
            ),
            TestCaseResult(
                timestamp=1234567891,
                testCaseStatus=TestCaseStatus.Failed,
                result="Chunk 1 failed",
            ),
        ]

        failed_indices: List[Set[int]] = [set(), {2, 5, 7}]

        result = ChunkedTestResults(
            test_case=test_case_fixture,
            aggregated_result=aggregated_result,
            failed_indices_per_chunk=failed_indices,
            chunk_results=chunk_results,
        )

        assert result.aggregated_result.testCaseStatus == TestCaseStatus.Failed
        assert len(result.failed_indices_per_chunk[1]) == 3

    def test_chunked_test_results_is_frozen(self, test_case_fixture):
        """Test that ChunkedTestResults is immutable."""
        result = ChunkedTestResults(
            test_case=test_case_fixture,
            aggregated_result=TestCaseResult(
                timestamp=1234567890,
                testCaseStatus=TestCaseStatus.Success,
                result="All chunks passed",
            ),
            failed_indices_per_chunk=[],
            chunk_results=[],
        )

        with pytest.raises((AttributeError, TypeError)):
            result.test_case = None


class TestFullTableTestResult:
    """Test FullTableTestResult dataclass."""

    def test_full_table_result_creation(self, test_case_fixture):
        """Test creating FullTableTestResult."""
        test_result = TestCaseResult(
            timestamp=1234567890,
            testCaseStatus=TestCaseStatus.Success,
            result="Full table test passed",
        )

        result = FullTableTestResult(
            test_case=test_case_fixture,
            result=test_result,
            failed_indices=set(),
        )

        assert result.test_case == test_case_fixture
        assert result.result.testCaseStatus == TestCaseStatus.Success
        assert len(result.failed_indices) == 0

    def test_full_table_result_with_failures(self, test_case_fixture):
        """Test FullTableTestResult with failures."""
        test_result = TestCaseResult(
            timestamp=1234567890,
            testCaseStatus=TestCaseStatus.Failed,
            result="Full table test failed",
        )

        failed_indices = {10, 25, 37}

        result = FullTableTestResult(
            test_case=test_case_fixture,
            result=test_result,
            failed_indices=failed_indices,
        )

        assert result.result.testCaseStatus == TestCaseStatus.Failed
        assert len(result.failed_indices) == 3
        assert 10 in result.failed_indices

    def test_full_table_result_is_frozen(self, test_case_fixture):
        """Test that FullTableTestResult is immutable."""
        result = FullTableTestResult(
            test_case=test_case_fixture,
            result=TestCaseResult(
                timestamp=1234567890,
                testCaseStatus=TestCaseStatus.Success,
                result="Full table test passed",
            ),
            failed_indices=set(),
        )

        with pytest.raises((AttributeError, TypeError)):
            result.test_case = None


@pytest.mark.parametrize(
    "mode,failed_count,expected_clean_count,expected_error_count",
    [
        ("short-circuit", 0, 5, 0),
        ("short-circuit", 2, 0, 5),
        ("report-errors", 0, 5, 0),
        ("report-errors", 2, 3, 2),
    ],
)
def test_from_chunk_results_parametrized(
    mode,
    failed_count,
    expected_clean_count,
    expected_error_count,
    sample_dataframe,
    test_case_fixture,
):
    """Parametrized test for different mode and failure combinations."""
    status = TestCaseStatus.Success if failed_count == 0 else TestCaseStatus.Failed
    failed_indices = set(range(failed_count))

    test_result = TestCaseResultResponse(
        testCaseResult=TestCaseResult(
            timestamp=1234567890,
            testCaseStatus=status,
            result=f"Test with {failed_count} failures",
        ),
        testCase=test_case_fixture,
    )

    result = ValidationResult.from_chunk_results(
        chunk_number=0,
        chunk_df=sample_dataframe,
        test_results=[test_result],
        failed_indices=failed_indices,
        mode=mode,
    )

    assert len(result.df) == expected_clean_count

    if expected_error_count > 0:
        assert result.errors is not None
        assert len(result.errors) == expected_error_count
    else:
        assert result.errors is None
