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

from uuid import uuid4

import pandas as pd
import pytest

from metadata.data_quality.api.models import TestCaseResultResponse
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.data_quality.models.validation_result import (
    ChunkedTestResults,
    FullTableTestResult,
    ValidationResult,
)


def create_test_case_result_response(
    test_name: str, status: TestCaseStatus, result_message: str = "Test passed"
) -> TestCaseResultResponse:
    """Helper to create test case result response."""
    test_case = TestCase(
        id=uuid4(),
        name=test_name,
        fullyQualifiedName=f"test.{test_name}",
        entityLink="<#E::table::test.table::columns::col1>",
        testSuite=EntityReference(id=uuid4(), type="TestSuite"),
        testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
    )

    test_result = TestCaseResult(
        timestamp=1234567890,
        testCaseStatus=status,
        result=result_message,
        testResultValue=[TestResultValue(name="value", value="100")],
    )

    return TestCaseResultResponse(testCase=test_case, testCaseResult=test_result)


class TestValidationResult:
    """Test ValidationResult model."""

    def test_from_chunk_results_all_pass(self):
        """Test creating ValidationResult when all tests pass."""
        chunk_df = pd.DataFrame({"col1": [1, 2, 3], "col2": ["a", "b", "c"]})

        test_results = [
            create_test_case_result_response("test1", TestCaseStatus.Success),
            create_test_case_result_response("test2", TestCaseStatus.Success),
        ]

        result = ValidationResult.from_chunk_results(
            chunk_number=0,
            chunk_df=chunk_df,
            test_results=test_results,
            failed_indices=set(),
            mode="short-circuit",
        )

        assert result.chunk_number == 0
        assert result.success is True
        assert len(result.df) == 3
        assert result.errors is None
        assert result.error_summary is None
        assert len(result.test_results) == 2

    def test_from_chunk_results_with_failures_short_circuit(self):
        """Test creating ValidationResult with failures in short-circuit mode."""
        chunk_df = pd.DataFrame({"col1": [1, 2, 3], "col2": ["a", "b", "c"]})

        test_results = [
            create_test_case_result_response("test1", TestCaseStatus.Failed, "Failed"),
            create_test_case_result_response("test2", TestCaseStatus.Success),
        ]

        result = ValidationResult.from_chunk_results(
            chunk_number=0,
            chunk_df=chunk_df,
            test_results=test_results,
            failed_indices={0, 1},
            mode="short-circuit",
        )

        assert result.success is False
        assert len(result.df) == 0
        assert result.errors is not None
        assert len(result.errors) == 3
        assert result.error_summary is not None
        assert "test1" in result.error_summary

    def test_from_chunk_results_with_failures_report_errors(self):
        """Test creating ValidationResult with failures in report-errors mode."""
        chunk_df = pd.DataFrame({"col1": [1, 2, 3], "col2": ["a", "b", "c"]})

        test_results = [
            create_test_case_result_response(
                "test1", TestCaseStatus.Failed, "Null values found"
            ),
        ]

        result = ValidationResult.from_chunk_results(
            chunk_number=0,
            chunk_df=chunk_df,
            test_results=test_results,
            failed_indices={0, 2},
            mode="report-errors",
        )

        assert result.success is False
        assert len(result.df) == 1
        assert result.df.iloc[0]["col1"] == 2
        assert result.errors is not None
        assert len(result.errors) == 2
        assert "_validation_error" in result.errors.columns
        assert "test1" in result.errors["_validation_error"].iloc[0]

    def test_from_chunk_results_empty_chunk(self):
        """Test creating ValidationResult with empty chunk."""
        chunk_df = pd.DataFrame({"col1": [], "col2": []})

        test_results = [
            create_test_case_result_response("test1", TestCaseStatus.Success),
        ]

        result = ValidationResult.from_chunk_results(
            chunk_number=0,
            chunk_df=chunk_df,
            test_results=test_results,
            failed_indices=set(),
            mode="short-circuit",
        )

        assert result.success is True
        assert len(result.df) == 0
        assert result.errors is None

    def test_validation_result_immutability(self):
        """Test that ValidationResult is immutable."""
        chunk_df = pd.DataFrame({"col1": [1, 2, 3]})
        test_results = [
            create_test_case_result_response("test1", TestCaseStatus.Success)
        ]

        result = ValidationResult.from_chunk_results(
            chunk_number=0,
            chunk_df=chunk_df,
            test_results=test_results,
            failed_indices=set(),
            mode="short-circuit",
        )

        with pytest.raises(Exception):
            result.chunk_number = 1


class TestChunkedTestResults:
    """Test ChunkedTestResults model."""

    def test_chunked_test_results_creation(self):
        """Test creating ChunkedTestResults."""
        test_case = TestCase(
            id=uuid4(),
            name="test1",
            fullyQualifiedName="test.test1",
            entityLink="<#E::table::test.table::columns::col1>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
        )

        aggregated_result = TestCaseResult(
            timestamp=1234567890,
            testCaseStatus=TestCaseStatus.Success,
            result="All passed",
        )

        chunk_results = [
            TestCaseResult(
                timestamp=1234567890,
                testCaseStatus=TestCaseStatus.Success,
                result="Chunk 1 passed",
            ),
            TestCaseResult(
                timestamp=1234567890,
                testCaseStatus=TestCaseStatus.Success,
                result="Chunk 2 passed",
            ),
        ]

        failed_indices_per_chunk = [set(), set()]

        results = ChunkedTestResults(
            test_case=test_case,
            aggregated_result=aggregated_result,
            failed_indices_per_chunk=failed_indices_per_chunk,
            chunk_results=chunk_results,
        )

        assert results.test_case.name == "test1"
        assert results.aggregated_result.testCaseStatus == TestCaseStatus.Success
        assert len(results.chunk_results) == 2
        assert len(results.failed_indices_per_chunk) == 2

    def test_chunked_test_results_immutability(self):
        """Test that ChunkedTestResults is immutable."""
        test_case = TestCase(
            id=uuid4(),
            name="test1",
            fullyQualifiedName="test.test1",
            entityLink="<#E::table::test.table::columns::col1>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
        )

        aggregated_result = TestCaseResult(
            timestamp=1234567890,
            testCaseStatus=TestCaseStatus.Success,
            result="All passed",
        )

        results = ChunkedTestResults(
            test_case=test_case,
            aggregated_result=aggregated_result,
            failed_indices_per_chunk=[],
            chunk_results=[],
        )

        with pytest.raises(Exception):
            results.test_case = test_case


class TestFullTableTestResult:
    """Test FullTableTestResult model."""

    def test_full_table_test_result_creation(self):
        """Test creating FullTableTestResult."""
        test_case = TestCase(
            id=uuid4(),
            name="test1",
            fullyQualifiedName="test.test1",
            entityLink="<#E::table::test.table::columns::col1>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
        )

        test_result = TestCaseResult(
            timestamp=1234567890,
            testCaseStatus=TestCaseStatus.Success,
            result="Uniqueness test passed",
        )

        result = FullTableTestResult(
            test_case=test_case, result=test_result, failed_indices={1, 3, 5}
        )

        assert result.test_case.name == "test1"
        assert result.result.testCaseStatus == TestCaseStatus.Success
        assert len(result.failed_indices) == 3

    def test_full_table_test_result_immutability(self):
        """Test that FullTableTestResult is immutable."""
        test_case = TestCase(
            id=uuid4(),
            name="test1",
            fullyQualifiedName="test.test1",
            entityLink="<#E::table::test.table::columns::col1>",
            testSuite=EntityReference(id=uuid4(), type="TestSuite"),
            testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
        )

        test_result = TestCaseResult(
            timestamp=1234567890,
            testCaseStatus=TestCaseStatus.Success,
            result="Uniqueness test passed",
        )

        result = FullTableTestResult(
            test_case=test_case, result=test_result, failed_indices=set()
        )

        with pytest.raises(Exception):
            result.test_case = test_case
