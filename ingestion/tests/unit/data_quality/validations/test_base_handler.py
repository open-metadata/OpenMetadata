from ast import literal_eval
from datetime import datetime
from unittest.mock import MagicMock

import pytest

from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.generated.schema.tests.basic import (
    DimensionValue,
    TestCaseDimensionResult,
    TestCaseResult,
    TestCaseStatus,
)
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()

EXECUTION_DATE = datetime.strptime("2021-07-03", "%Y-%m-%d")


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
        # Return a real TestCaseResult object that the base class can modify
        return TestCaseResult(
            timestamp=self.execution_date,
            testCaseStatus=TestCaseStatus.Success,
            result="Test passed",
            testResultValue=[],
        )

    def _run_dimensional_validation(self) -> list:
        """Execute dimensional validation for this test

        This method should implement the dimensional logic specific to each test type.
        It will be called automatically by the template method when dimensionColumns
        are configured in the test case.

        Returns:
            List[DimensionResult]: List of dimension results
        """
        # Default implementation returns empty list
        return []

    def get_column(self, column_name=None):
        """Mock implementation of get_column"""
        # For testing purposes, accept any column name that's provided
        # This simulates that all dimension columns exist
        if column_name:
            # Return a mock column for dimension columns
            from unittest.mock import MagicMock

            mock_column = MagicMock()
            mock_column.name = column_name
            return mock_column
        return None  # Return None for the main column (backward compatibility)


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
        return int(datetime.now().timestamp())

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

        # Verify dimension values were converted to DimensionValue objects
        assert len(result.dimensionValues) == len(dimension_values)
        for dim_val in result.dimensionValues:
            assert isinstance(dim_val, DimensionValue)
            assert dimension_values[dim_val.name] == dim_val.value

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

    @pytest.mark.parametrize(
        "dimension_columns,test_description",
        [
            (None, "no dimensions configured"),
            ([], "empty dimensions list"),
        ],
    )
    def test_run_validation_no_dimensions_skip_dimensional(
        self, validator, mock_test_case, dimension_columns, test_description
    ):
        """Test: When no dimensions are configured, dimensional validation should not run"""
        # Setup: Set dimension columns
        mock_test_case.dimensionColumns = dimension_columns

        # Mock _run_dimensional_validation to track if it's called
        validator._run_dimensional_validation = MagicMock(return_value=[])

        # Execute
        result = validator.run_validation()

        # Verify
        assert isinstance(result, TestCaseResult)
        assert result.testCaseStatus == TestCaseStatus.Success
        assert result.dimensionResults is None

        # Verify dimensional validation was NOT called
        validator._run_dimensional_validation.assert_not_called()

    def test_run_validation_dimensions_configured_no_results(
        self, validator, mock_test_case
    ):
        """Test: When dimensions configured but returns empty results, dimensionResults should be None"""
        # Setup: Configure dimension columns
        mock_test_case.dimensionColumns = ["region", "category"]

        # Mock _run_dimensional_validation to return empty list
        validator._run_dimensional_validation = MagicMock(return_value=[])

        # Execute
        result = validator.run_validation()

        # Verify
        assert isinstance(result, TestCaseResult)
        assert result.testCaseStatus == TestCaseStatus.Success

        # When dimensional validation returns empty list, dimensionResults remains None
        assert result.dimensionResults is None

        # Verify dimensional validation WAS called
        validator._run_dimensional_validation.assert_called_once()

    def test_run_validation_dimensions_configured_with_results(
        self, validator, mock_test_case
    ):
        """Test: When dimensions configured and returns results, dimensionResults should contain them"""
        # Setup: Configure dimension columns
        mock_test_case.dimensionColumns = ["region", "category"]

        # Create mock DimensionResult objects with all required fields
        mock_dimension_result_1 = MagicMock(spec=DimensionResult)
        mock_dimension_result_1.dimensionValues = [
            DimensionValue(name="region", value="US"),
            DimensionValue(name="category", value="A"),
        ]
        mock_dimension_result_1.testCaseStatus = TestCaseStatus.Success
        mock_dimension_result_1.passedRows = 80
        mock_dimension_result_1.failedRows = 20
        mock_dimension_result_1.passedRowsPercentage = 80.0
        mock_dimension_result_1.failedRowsPercentage = 20.0
        mock_dimension_result_1.result = "Passed: 80, Failed: 20"
        mock_dimension_result_1.testResultValue = []
        mock_dimension_result_1.impactScore = None

        mock_dimension_result_2 = MagicMock(spec=DimensionResult)
        mock_dimension_result_2.dimensionValues = [
            DimensionValue(name="region", value="EU"),
            DimensionValue(name="category", value="B"),
        ]
        mock_dimension_result_2.testCaseStatus = TestCaseStatus.Failed
        mock_dimension_result_2.passedRows = 50
        mock_dimension_result_2.failedRows = 50
        mock_dimension_result_2.passedRowsPercentage = 50.0
        mock_dimension_result_2.failedRowsPercentage = 50.0
        mock_dimension_result_2.result = "Passed: 50, Failed: 50"
        mock_dimension_result_2.testResultValue = []
        mock_dimension_result_2.impactScore = None

        # Mock _run_dimensional_validation to return DimensionResult objects
        validator._run_dimensional_validation = MagicMock(
            return_value=[mock_dimension_result_1, mock_dimension_result_2]
        )

        # Execute
        result = validator.run_validation()

        # Verify
        assert isinstance(result, TestCaseResult)
        assert result.testCaseStatus == TestCaseStatus.Success

        # When dimensional validation returns results, they should be converted to TestCaseDimensionResult
        assert result.dimensionResults is not None
        assert len(result.dimensionResults) == 2

        # Verify the dimension results are TestCaseDimensionResult instances
        for dim_result in result.dimensionResults:
            assert isinstance(dim_result, TestCaseDimensionResult)

        # Verify the first dimension result has correct values
        first_result = result.dimensionResults[0]
        assert first_result.dimensionKey == "region=US,category=A"
        assert first_result.testCaseStatus == TestCaseStatus.Success
        assert first_result.passedRows == 80
        assert first_result.failedRows == 20

        # Verify the second dimension result has correct values
        second_result = result.dimensionResults[1]
        assert second_result.dimensionKey == "region=EU,category=B"
        assert second_result.testCaseStatus == TestCaseStatus.Failed
        assert second_result.passedRows == 50
        assert second_result.failedRows == 50

        # Verify dimensional validation WAS called
        validator._run_dimensional_validation.assert_called_once()

    def test_run_validation_dimensional_not_implemented(
        self, validator, mock_test_case
    ):
        """Test: When dimensional validation raises NotImplementedError, main test still succeeds"""
        # Setup: Configure dimension columns
        mock_test_case.dimensionColumns = ["region"]

        # Mock _run_dimensional_validation to raise NotImplementedError
        validator._run_dimensional_validation = MagicMock(
            side_effect=NotImplementedError("Dimensional validation not implemented")
        )

        # Execute
        result = validator.run_validation()

        # Verify: Main test should still succeed despite NotImplementedError
        assert isinstance(result, TestCaseResult)
        assert result.testCaseStatus == TestCaseStatus.Success
        assert (
            result.dimensionResults is None
        )  # No dimension results due to NotImplementedError

        # Verify dimensional validation WAS attempted
        validator._run_dimensional_validation.assert_called_once()

    def test_run_validation_dimensional_raises_exception(
        self, validator, mock_test_case
    ):
        """Test: When dimensional validation raises Exception, main test still succeeds"""
        # Setup: Configure dimension columns
        mock_test_case.dimensionColumns = ["region", "category"]

        # Mock _run_dimensional_validation to raise a general exception
        validator._run_dimensional_validation = MagicMock(
            side_effect=RuntimeError("Something went wrong in dimensional validation")
        )

        # Execute
        result = validator.run_validation()

        # Verify: Main test should still succeed despite the exception
        assert isinstance(result, TestCaseResult)
        assert result.testCaseStatus == TestCaseStatus.Success
        assert result.dimensionResults is None  # No dimension results due to exception

        # Verify dimensional validation WAS attempted
        validator._run_dimensional_validation.assert_called_once()


def test_get_test_parameters_default_returns_empty_dict():
    """Test that default _get_test_parameters implementation returns None"""
    test_case = MagicMock(spec=TestCase)
    test_case.name = "test_default_params"
    test_case.dimensionColumns = None

    validator = MockTestValidator(
        runner=MagicMock(),
        test_case=test_case,
        execution_date=EXECUTION_DATE.timestamp(),
    )

    result = validator._get_test_parameters()

    assert result == {}


def test_evaluate_test_condition_not_implemented_error():
    """Test that _evaluate_test_condition raises NotImplementedError with clear message"""
    test_case = MagicMock(spec=TestCase)
    test_case.name = "test_evaluate_not_implemented"
    test_case.dimensionColumns = None

    validator = MockTestValidator(
        runner=MagicMock(),
        test_case=test_case,
        execution_date=EXECUTION_DATE.timestamp(),
    )

    metric_values = {"COUNT": 100}

    with pytest.raises(NotImplementedError) as exc_info:
        validator._evaluate_test_condition(metric_values)

    assert "MockTestValidator must implement _evaluate_test_condition()" in str(
        exc_info.value
    )


def test_format_result_message_not_implemented_error():
    """Test that _format_result_message raises NotImplementedError with clear message"""
    test_case = MagicMock(spec=TestCase)
    test_case.name = "test_format_not_implemented"
    test_case.dimensionColumns = None

    validator = MockTestValidator(
        runner=MagicMock(),
        test_case=test_case,
        execution_date=EXECUTION_DATE.timestamp(),
    )

    metric_values = {"COUNT": 100}

    with pytest.raises(NotImplementedError) as exc_info:
        validator._format_result_message(metric_values)

    assert "MockTestValidator must implement _format_result_message()" in str(
        exc_info.value
    )
