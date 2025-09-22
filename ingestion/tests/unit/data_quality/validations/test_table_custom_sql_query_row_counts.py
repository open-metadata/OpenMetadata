"""
Unit tests for BaseTableCustomSQLQueryValidator passed/failed row count logic
"""

import unittest
from datetime import datetime
from unittest.mock import Mock, patch

from metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery import (
    TableCustomSQLQueryValidator,
)
from metadata.generated.schema.tests.basic import TestCaseStatus


class TestTableCustomSQLQueryRowCounts(unittest.TestCase):
    """Test cases for passed/failed row count calculation logic"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_runner = Mock()
        self.mock_test_case = Mock()
        self.mock_test_case.computePassedFailedRowCount = True
        self.mock_test_case.parameterValues = []
        self.mock_test_case.fullyQualifiedName = "test.case"
        self.mock_execution_date = datetime.now()

        self.validator = TableCustomSQLQueryValidator(
            runner=self.mock_runner,
            test_case=self.mock_test_case,
            execution_date=self.mock_execution_date,
        )

    def _create_mock_param_values(
        self, operator, threshold, sql_expression="SELECT * FROM test"
    ):
        """Helper to create mock parameter values"""
        return [
            Mock(name="sqlExpression", value=sql_expression),
            Mock(name="operator", value=operator),
            Mock(name="threshold", value=threshold),
            Mock(name="strategy", value="COUNT"),
        ]

    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator._run_results"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.compute_row_count"
    )
    def test_greater_than_operator_success(
        self, mock_compute_row_count, mock_run_results
    ):
        """Test > operator when test passes"""
        self.mock_test_case.parameterValues = self._create_mock_param_values(">", 5)
        mock_run_results.return_value = 10
        mock_compute_row_count.return_value = 1000

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Success)
        self.assertEqual(result.passedRows, 10)
        self.assertEqual(result.failedRows, 0)

    def test_greater_than_operator_failure(self):
        """Test > operator when test fails (got fewer rows than expected)"""
        self.test_operator = ">"
        self.test_threshold = 10
        self.validator.mock_row_count = 5

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Failed)
        self.assertEqual(result.passedRows, 5)
        self.assertEqual(result.failedRows, 5)

    def test_greater_than_equal_operator_success(self):
        """Test >= operator when test passes"""
        self.test_operator = ">="
        self.test_threshold = 10
        self.validator.mock_row_count = 10

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Success)
        self.assertEqual(result.passedRows, 10)
        self.assertEqual(result.failedRows, 0)

    def test_greater_than_equal_operator_failure(self):
        """Test >= operator when test fails"""
        self.test_operator = ">="
        self.test_threshold = 15
        self.validator.mock_row_count = 8

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Failed)
        self.assertEqual(result.passedRows, 8)
        self.assertEqual(result.failedRows, 7)

    def test_less_than_operator_success(self):
        """Test < operator when test passes"""
        self.test_operator = "<"
        self.test_threshold = 10
        self.validator.mock_row_count = 5

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Success)
        self.assertEqual(result.passedRows, 5)
        self.assertEqual(result.failedRows, 0)

    def test_less_than_operator_failure(self):
        """Test < operator when test fails (got more rows than expected)"""
        self.test_operator = "<"
        self.test_threshold = 5
        self.validator.mock_row_count = 12

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Failed)
        self.assertEqual(result.passedRows, 5)
        self.assertEqual(result.failedRows, 7)

    def test_less_than_equal_operator_success(self):
        """Test <= operator when test passes"""
        self.test_operator = "<="
        self.test_threshold = 10
        self.validator.mock_row_count = 10

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Success)
        self.assertEqual(result.passedRows, 10)
        self.assertEqual(result.failedRows, 0)

    def test_less_than_equal_operator_failure(self):
        """Test <= operator when test fails"""
        self.test_operator = "<="
        self.test_threshold = 8
        self.validator.mock_row_count = 15

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Failed)
        self.assertEqual(result.passedRows, 8)
        self.assertEqual(result.failedRows, 7)

    def test_equal_operator_success(self):
        """Test == operator when test passes"""
        self.test_operator = "=="
        self.test_threshold = 10
        self.validator.mock_row_count = 10

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Success)
        self.assertEqual(result.passedRows, 10)
        self.assertEqual(result.failedRows, 0)

    def test_equal_operator_failure_more_rows(self):
        """Test == operator when test fails with more rows than expected"""
        self.test_operator = "=="
        self.test_threshold = 10
        self.validator.mock_row_count = 15

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Failed)
        self.assertEqual(result.passedRows, 0)
        self.assertEqual(result.failedRows, 5)

    def test_equal_operator_failure_fewer_rows(self):
        """Test == operator when test fails with fewer rows than expected"""
        self.test_operator = "=="
        self.test_threshold = 10
        self.validator.mock_row_count = 3

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Failed)
        self.assertEqual(result.passedRows, 0)
        self.assertEqual(result.failedRows, 7)

    def test_edge_case_zero_threshold_greater_than(self):
        """Test edge case with zero threshold and > operator"""
        self.test_operator = ">"
        self.test_threshold = 0
        self.validator.mock_row_count = 5

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Success)
        self.assertEqual(result.passedRows, 5)
        self.assertEqual(result.failedRows, 0)

    def test_edge_case_zero_actual_rows_less_than(self):
        """Test edge case with zero actual rows and < operator"""
        self.test_operator = "<"
        self.test_threshold = 5
        self.validator.mock_row_count = 0

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Success)
        self.assertEqual(result.passedRows, 0)
        self.assertEqual(result.failedRows, 0)

    def test_edge_case_negative_failed_rows_protection(self):
        """Test protection against negative failed rows for >= operator"""
        self.test_operator = ">="
        self.test_threshold = 5
        self.validator.mock_row_count = 10

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Success)
        self.assertEqual(result.passedRows, 10)
        self.assertEqual(result.failedRows, 0)


if __name__ == "__main__":
    unittest.main()
