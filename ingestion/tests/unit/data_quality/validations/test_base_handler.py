from ast import literal_eval
from datetime import datetime
from typing import List
from unittest.mock import MagicMock

import pytest

from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.generated.schema.tests.basic import (
    DimensionResult,
    TestCaseResult,
    TestCaseStatus,
)
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


@pytest.mark.parametrize(
    "param_values, name, type_, default, expected",
    [
        ([TestCaseParameterValue(name="str", value="test")], "str", str, None, "test"),
        (
            [TestCaseParameterValue(name="param", value="[1, 2, 3]")],
            "param",
            literal_eval,
            None,
            [1, 2, 3],
        ),
        ([TestCaseParameterValue(name="param", value="123")], "param", int, None, 123),
        (
            [TestCaseParameterValue(name="param", value=None)],
            "param",
            str,
            "default",
            "default",
        ),
    ],
)
def test_get_test_case_param_value(param_values, name, type_, default, expected):
    result = BaseTestValidator.get_test_case_param_value(
        param_values, name, type_, default
    )
    assert result == expected


class MockTestValidator(BaseTestValidator):
    """Mock validator for testing the new functionality"""

    def _run_validation(self) -> TestCaseResult:
        """Mock implementation of _run_validation"""
        # Create a mock TestCaseResult to avoid complex schema validation issues
        mock_result = MagicMock(spec=TestCaseResult)
        mock_result.testCaseStatus = TestCaseStatus.Success
        mock_result.dimensionResults = []
        return mock_result

    def _run_dimensional_validation(self) -> List["DimensionResult"]:
        """Execute dimensional validation for this test

        This method should implement the dimensional logic specific to each test type.
        It will be called automatically by the template method when dimensionColumns
        are configured in the test case.

        Returns:
            List[DimensionResult]: List of dimension-specific test results
        """
        # Default implementation returns empty list
        return []

    def _get_column_name(self):
        """Mock implementation of _get_column_name"""
        return None


class TestBaseTestValidator:
    """Test class for BaseTestValidator"""

    @pytest.fixture
    def mock_test_case(self):
        """Create a mock test case"""
        test_case = MagicMock(spec=TestCase)
        test_case.name = "test_case"
        test_case.fullyQualifiedName = "test.test_case"
        return test_case

    @pytest.fixture
    def mock_execution_date(self):
        """Create a mock execution date"""
        return datetime.now()

    @pytest.fixture
    def validator(self, mock_test_case, mock_execution_date):
        """Create a validator instance for testing"""
        runner = MagicMock()
        return MockTestValidator(runner, mock_test_case, mock_execution_date)

    @pytest.mark.parametrize(
        "dimension_columns,expected",
        [
            (None, False),
            ([], False),
            (["col1"], True),
            (["col1", "col2"], True),
            (["dimension_col"], True),
        ],
    )
    def test_is_dimensional_test(
        self, validator, mock_test_case, dimension_columns, expected
    ):
        """Test is_dimensional_test method with various dimension column configurations"""
        # Set up the test case with dimension columns
        mock_test_case.dimensionColumns = dimension_columns

        result = validator.is_dimensional_test()
        assert result == expected

    @pytest.mark.parametrize(
        "has_dimensions,expected_dimension_results",
        [
            (False, []),
            (True, []),
        ],
    )
    def test_run_validation_flow(
        self, validator, mock_test_case, has_dimensions, expected_dimension_results
    ):
        """Test the run_validation template method flow"""
        # Set up dimension columns
        mock_test_case.dimensionColumns = ["col1", "col2"] if has_dimensions else None

        # Mock the dimensional validation to return expected results
        if has_dimensions:
            validator._run_dimensional_validation = MagicMock(
                return_value=expected_dimension_results
            )

        # Execute the template method
        result = validator.run_validation()

        # Verify the result structure
        assert isinstance(result, TestCaseResult)
        assert result.testCaseStatus == TestCaseStatus.Success

        # Verify dimensional results are set correctly
        if has_dimensions:
            assert result.dimensionResults == expected_dimension_results
            # Verify that _run_dimensional_validation was called
            validator._run_dimensional_validation.assert_called_once()
        else:
            assert result.dimensionResults is None or result.dimensionResults == []

    @pytest.mark.parametrize(
        "dimension_values,passed_rows,failed_rows,total_rows,expected_percentages",
        [
            ({"region": "US", "category": "A"}, 80, 20, 100, (80.0, 20.0)),
            ({"region": "EU", "category": "B"}, 50, 50, 100, (50.0, 50.0)),
            ({"region": "ASIA"}, 0, 100, 100, (0.0, 100.0)),
            ({"region": "US"}, 100, 0, 100, (100.0, 0.0)),
            ({"region": "EU"}, 25, 75, 100, (25.0, 75.0)),
        ],
    )
    def test_get_dimension_result_object(
        self,
        validator,
        dimension_values,
        passed_rows,
        failed_rows,
        total_rows,
        expected_percentages,
    ):
        """Test get_dimension_result_object helper method with various scenarios"""
        # Call the helper method
        result = validator.get_dimension_result_object(
            dimension_values=dimension_values,
            test_case_status=TestCaseStatus.Success,
            result=f"Passed: {passed_rows}, Failed: {failed_rows}",
            test_result_value=[],
            total_rows=total_rows,
            passed_rows=passed_rows,
            failed_rows=failed_rows,
        )

        # Verify the result structure
        assert isinstance(result, DimensionResult)
        assert result.dimensionValues == dimension_values
        assert result.passedRows == passed_rows
        assert result.failedRows == failed_rows

        # Verify percentage calculations
        expected_passed_pct, expected_failed_pct = expected_percentages
        assert result.passedRowsPercentage == expected_passed_pct
        assert result.failedRowsPercentage == expected_failed_pct

        # Verify that percentages add up to 100% (or close to it due to floating point)
        passed_pct = result.passedRowsPercentage or 0.0
        failed_pct = result.failedRowsPercentage or 0.0
        assert abs(passed_pct + failed_pct - 100.0) < 0.01

    @pytest.mark.parametrize(
        "total_rows,expected_percentages",
        [
            (0, (0.0, 0.0)),  # Edge case: no rows
            (1, (0.0, 100.0)),  # Edge case: single row (0 passed, 1 failed)
            (1000, (75.0, 25.0)),  # Normal case
        ],
    )
    def test_get_dimension_result_object_edge_cases(
        self, validator, total_rows, expected_percentages
    ):
        """Test get_dimension_result_object with edge cases"""
        dimension_values = {"test": "value"}
        passed_rows = int(total_rows * 0.75) if total_rows > 0 else 0
        failed_rows = total_rows - passed_rows

        result = validator.get_dimension_result_object(
            dimension_values=dimension_values,
            test_case_status=TestCaseStatus.Success,
            result=f"Passed: {passed_rows}, Failed: {failed_rows}",
            test_result_value=[],
            total_rows=total_rows,
            passed_rows=passed_rows,
            failed_rows=failed_rows,
        )

        expected_passed_pct, expected_failed_pct = expected_percentages
        assert result.passedRowsPercentage == expected_passed_pct
        assert result.failedRowsPercentage == expected_failed_pct

    def test_run_validation_calls_abstract_methods(self, validator, mock_test_case):
        """Test that run_validation properly calls the abstract methods"""
        # Mock the abstract methods
        validator._run_validation = MagicMock(
            return_value=MagicMock(spec=TestCaseResult)
        )
        validator._run_dimensional_validation = MagicMock(return_value=[])

        # Set up test case with dimensions
        mock_test_case.dimensionColumns = ["col1"]

        # Execute
        validator.run_validation()

        # Verify abstract methods were called
        validator._run_validation.assert_called_once()
        validator._run_dimensional_validation.assert_called_once()

    def test_run_validation_no_dimensions_skips_dimensional_validation(
        self, validator, mock_test_case
    ):
        """Test that run_validation skips dimensional validation when no dimensions are set"""
        # Mock the abstract methods
        validator._run_validation = MagicMock(
            return_value=MagicMock(spec=TestCaseResult)
        )
        validator._run_dimensional_validation = MagicMock(return_value=[])

        # Set up test case without dimensions
        mock_test_case.dimensionColumns = None

        # Execute
        validator.run_validation()

        # Verify only _run_validation was called
        validator._run_validation.assert_called_once()
        validator._run_dimensional_validation.assert_not_called()
