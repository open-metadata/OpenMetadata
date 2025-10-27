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
        self.mock_test_case.dimensionColumns = None
        self.mock_execution_date = int(datetime.now().timestamp())

        self.validator = TableCustomSQLQueryValidator(
            runner=self.mock_runner,
            test_case=self.mock_test_case,
            execution_date=self.mock_execution_date,
        )

    def _create_mock_param_values(
        self, operator, threshold, sql_expression="SELECT * FROM test"
    ):
        """Helper to create mock parameter values"""
        import json

        # Create runtime parameters JSON
        runtime_params = {
            "conn_config": {
                "config": {
                    "type": "Mysql",
                    "scheme": "mysql+pymysql",
                    "username": "test",
                    "password": "test",
                    "hostPort": "localhost:3306",
                    "database": "test_db",
                }
            },
            "entity": {
                "id": "test-table-id",
                "name": "test_table",
                "fullyQualifiedName": "test.db.test_table",
            },
        }

        # Create parameter mocks with explicit name attributes
        sql_param = Mock()
        sql_param.name = "sqlExpression"
        sql_param.value = sql_expression

        operator_param = Mock()
        operator_param.name = "operator"
        operator_param.value = operator

        threshold_param = Mock()
        threshold_param.name = "threshold"
        threshold_param.value = threshold

        strategy_param = Mock()
        strategy_param.name = "strategy"
        strategy_param.value = "COUNT"

        runtime_param = Mock()
        runtime_param.name = "TableCustomSQLQueryRuntimeParameters"
        runtime_param.value = json.dumps(runtime_params)

        return [
            sql_param,
            operator_param,
            threshold_param,
            strategy_param,
            runtime_param,
        ]

    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.get_runtime_parameters"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator._run_results"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.compute_row_count"
    )
    def test_greater_than_operator_success(
        self, mock_compute_row_count, mock_run_results, mock_get_runtime_params
    ):
        """Test > operator when test passes"""
        self.mock_test_case.parameterValues = self._create_mock_param_values(">", 5)
        mock_run_results.return_value = 10
        mock_compute_row_count.return_value = 1000
        mock_get_runtime_params.return_value = Mock()

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Success)
        self.assertEqual(result.passedRows, 10)
        self.assertEqual(result.failedRows, 990)

    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.get_runtime_parameters"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator._run_results"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.compute_row_count"
    )
    def test_greater_than_operator_failure(
        self, mock_compute_row_count, mock_run_results, mock_get_runtime_params
    ):
        """Test > operator when test fails (got fewer rows than expected)"""
        self.mock_test_case.parameterValues = self._create_mock_param_values(">", 10)
        mock_run_results.return_value = 5
        mock_compute_row_count.return_value = 1000
        mock_get_runtime_params.return_value = Mock()

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Failed)
        self.assertEqual(result.passedRows, 5)
        self.assertEqual(result.failedRows, 995)

    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.get_runtime_parameters"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator._run_results"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.compute_row_count"
    )
    def test_greater_than_equal_operator_success(
        self, mock_compute_row_count, mock_run_results, mock_get_runtime_params
    ):
        """Test >= operator when test passes"""
        self.mock_test_case.parameterValues = self._create_mock_param_values(">=", 10)
        mock_run_results.return_value = 10
        mock_compute_row_count.return_value = 1000
        mock_get_runtime_params.return_value = Mock()

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Success)
        self.assertEqual(result.passedRows, 10)
        self.assertEqual(result.failedRows, 990)

    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.get_runtime_parameters"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator._run_results"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.compute_row_count"
    )
    def test_greater_than_equal_operator_failure(
        self, mock_compute_row_count, mock_run_results, mock_get_runtime_params
    ):
        """Test >= operator when test fails"""
        self.mock_test_case.parameterValues = self._create_mock_param_values(">=", 15)
        mock_run_results.return_value = 8
        mock_compute_row_count.return_value = 1000
        mock_get_runtime_params.return_value = Mock()

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Failed)
        self.assertEqual(result.passedRows, 8)
        self.assertEqual(result.failedRows, 992)

    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.get_runtime_parameters"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator._run_results"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.compute_row_count"
    )
    def test_less_than_operator_success(
        self, mock_compute_row_count, mock_run_results, mock_get_runtime_params
    ):
        """Test < operator when test passes"""
        self.mock_test_case.parameterValues = self._create_mock_param_values("<", 10)
        mock_run_results.return_value = 5
        mock_compute_row_count.return_value = 1000
        mock_get_runtime_params.return_value = Mock()

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Success)
        self.assertEqual(result.passedRows, 995)
        self.assertEqual(result.failedRows, 5)

    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.get_runtime_parameters"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator._run_results"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.compute_row_count"
    )
    def test_less_than_operator_failure(
        self, mock_compute_row_count, mock_run_results, mock_get_runtime_params
    ):
        """Test < operator when test fails (got more rows than expected)"""
        self.mock_test_case.parameterValues = self._create_mock_param_values("<", 5)
        mock_run_results.return_value = 12
        mock_compute_row_count.return_value = 1000
        mock_get_runtime_params.return_value = Mock()

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Failed)
        self.assertEqual(result.passedRows, 988)
        self.assertEqual(result.failedRows, 12)

    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.get_runtime_parameters"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator._run_results"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.compute_row_count"
    )
    def test_less_than_equal_operator_success(
        self, mock_compute_row_count, mock_run_results, mock_get_runtime_params
    ):
        """Test <= operator when test passes"""
        self.mock_test_case.parameterValues = self._create_mock_param_values("<=", 10)
        mock_run_results.return_value = 10
        mock_compute_row_count.return_value = 1000
        mock_get_runtime_params.return_value = Mock()

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Success)
        self.assertEqual(result.passedRows, 990)
        self.assertEqual(result.failedRows, 10)

    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.get_runtime_parameters"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator._run_results"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.compute_row_count"
    )
    def test_less_than_equal_operator_failure(
        self, mock_compute_row_count, mock_run_results, mock_get_runtime_params
    ):
        """Test <= operator when test fails"""
        self.mock_test_case.parameterValues = self._create_mock_param_values("<=", 8)
        mock_run_results.return_value = 15
        mock_compute_row_count.return_value = 1000
        mock_get_runtime_params.return_value = Mock()

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Failed)
        self.assertEqual(result.passedRows, 985)
        self.assertEqual(result.failedRows, 15)

    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.get_runtime_parameters"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator._run_results"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.compute_row_count"
    )
    def test_equal_operator_success(
        self, mock_compute_row_count, mock_run_results, mock_get_runtime_params
    ):
        """Test == operator when test passes"""
        self.mock_test_case.parameterValues = self._create_mock_param_values("==", 10)
        mock_run_results.return_value = 10
        mock_compute_row_count.return_value = 1000
        mock_get_runtime_params.return_value = Mock()

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Success)
        self.assertEqual(result.passedRows, 10)
        self.assertEqual(result.failedRows, 990)

    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.get_runtime_parameters"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator._run_results"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.compute_row_count"
    )
    def test_equal_operator_failure_more_rows(
        self, mock_compute_row_count, mock_run_results, mock_get_runtime_params
    ):
        """Test == operator when test fails with more rows than expected"""
        self.mock_test_case.parameterValues = self._create_mock_param_values("==", 10)
        mock_run_results.return_value = 15
        mock_compute_row_count.return_value = 1000
        mock_get_runtime_params.return_value = Mock()

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Failed)
        self.assertEqual(result.passedRows, 995)
        self.assertEqual(result.failedRows, 5)

    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.get_runtime_parameters"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator._run_results"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.compute_row_count"
    )
    def test_equal_operator_failure_fewer_rows(
        self, mock_compute_row_count, mock_run_results, mock_get_runtime_params
    ):
        """Test == operator when test fails with fewer rows than expected"""
        self.mock_test_case.parameterValues = self._create_mock_param_values("==", 10)
        mock_run_results.return_value = 3
        mock_compute_row_count.return_value = 1000
        mock_get_runtime_params.return_value = Mock()

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Failed)
        self.assertEqual(result.passedRows, 3)
        self.assertEqual(result.failedRows, 997)

    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.get_runtime_parameters"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator._run_results"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.compute_row_count"
    )
    def test_edge_case_zero_threshold_greater_than(
        self, mock_compute_row_count, mock_run_results, mock_get_runtime_params
    ):
        """Test edge case with zero threshold and > operator"""
        self.mock_test_case.parameterValues = self._create_mock_param_values(">", 0)
        mock_run_results.return_value = 5
        mock_compute_row_count.return_value = 1000
        mock_get_runtime_params.return_value = Mock()

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Success)
        self.assertEqual(result.passedRows, 5)
        self.assertEqual(result.failedRows, 995)

    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.get_runtime_parameters"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator._run_results"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.compute_row_count"
    )
    def test_edge_case_zero_actual_rows_less_than(
        self, mock_compute_row_count, mock_run_results, mock_get_runtime_params
    ):
        """Test edge case with zero actual rows and < operator"""
        self.mock_test_case.parameterValues = self._create_mock_param_values("<", 5)
        mock_run_results.return_value = 0
        mock_compute_row_count.return_value = 1000
        mock_get_runtime_params.return_value = Mock()

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Success)
        self.assertEqual(result.passedRows, 1000)
        self.assertEqual(result.failedRows, 0)

    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.get_runtime_parameters"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator._run_results"
    )
    @patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableCustomSQLQueryValidator.compute_row_count"
    )
    def test_edge_case_negative_failed_rows_protection(
        self, mock_compute_row_count, mock_run_results, mock_get_runtime_params
    ):
        """Test protection against negative failed rows for >= operator"""
        self.mock_test_case.parameterValues = self._create_mock_param_values(">=", 5)
        mock_run_results.return_value = 10
        mock_compute_row_count.return_value = 1000
        mock_get_runtime_params.return_value = Mock()

        result = self.validator.run_validation()

        self.assertEqual(result.testCaseStatus, TestCaseStatus.Success)
        self.assertEqual(result.passedRows, 10)
        self.assertEqual(result.failedRows, 990)


if __name__ == "__main__":
    unittest.main()
