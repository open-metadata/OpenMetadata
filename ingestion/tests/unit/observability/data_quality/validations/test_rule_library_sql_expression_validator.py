"""
Unit tests for RuleLibrarySqlExpressionValidator.compile_sql_expression method
"""

from datetime import datetime
from unittest.mock import MagicMock, Mock

import pytest

from metadata.data_quality.validations.column.base.columnRuleLibrarySqlExpressionValidator import (
    RESERVED_PARAMS,
)
from metadata.data_quality.validations.column.base.columnRuleLibrarySqlExpressionValidator import (
    ColumnRuleLibrarySqlExpressionValidator as BaseValidator,
)
from metadata.data_quality.validations.column.pandas.columnRuleLibrarySqlExpressionValidator import (
    ColumnRuleLibrarySqlExpressionValidator as PandasValidator,
)
from metadata.data_quality.validations.column.sqlalchemy.columnRuleLibrarySqlExpressionValidator import (
    ColumnRuleLibrarySqlExpressionValidator as SQAValidator,
)


class TestReservedParams:
    """Test RESERVED_PARAMS constant"""

    def test_reserved_params_contains_expected_values(self):
        assert "column_name" in RESERVED_PARAMS
        assert "table_name" in RESERVED_PARAMS

    def test_reserved_params_has_correct_length(self):
        assert len(RESERVED_PARAMS) == 2


class TestBaseValidatorGetUserParams:
    """Test cases for _get_user_params method"""

    @pytest.fixture
    def base_validator(self):
        mock_runner = Mock()
        mock_test_case = Mock()
        mock_test_case.parameterValues = None
        mock_execution_date = datetime.now()

        validator = BaseValidator.__new__(BaseValidator)
        validator.runner = mock_runner
        validator.test_case = mock_test_case
        validator.execution_date = mock_execution_date
        return validator

    def test_get_user_params_empty_when_no_parameter_values(self, base_validator):
        base_validator.test_case.parameterValues = None
        result = base_validator._get_user_params()
        assert result == {}

    def test_get_user_params_empty_list(self, base_validator):
        base_validator.test_case.parameterValues = []
        result = base_validator._get_user_params()
        assert result == {}

    def test_get_user_params_extracts_user_params(self, base_validator):
        param1 = Mock()
        param1.name = "threshold"
        param1.value = "100"

        param2 = Mock()
        param2.name = "maxValue"
        param2.value = "500"

        base_validator.test_case.parameterValues = [param1, param2]
        result = base_validator._get_user_params()

        assert result == {"threshold": "100", "maxValue": "500"}

    def test_get_user_params_skips_reserved_params(self, base_validator):
        param1 = Mock()
        param1.name = "column_name"
        param1.value = "should_be_skipped"

        param2 = Mock()
        param2.name = "table_name"
        param2.value = "also_skipped"

        param3 = Mock()
        param3.name = "myParam"
        param3.value = "included"

        base_validator.test_case.parameterValues = [param1, param2, param3]
        result = base_validator._get_user_params()

        assert result == {"myParam": "included"}
        assert "column_name" not in result
        assert "table_name" not in result

    def test_get_user_params_skips_runtime_parameters(self, base_validator):
        param1 = Mock()
        param1.name = "RuleLibrarySqlExpressionRuntimeParameters"
        param1.value = '{"some": "json"}'

        param2 = Mock()
        param2.name = "myParam"
        param2.value = "included"

        base_validator.test_case.parameterValues = [param1, param2]
        result = base_validator._get_user_params()

        assert result == {"myParam": "included"}
        assert "RuleLibrarySqlExpressionRuntimeParameters" not in result

    def test_get_user_params_skips_null_names_and_values(self, base_validator):
        param1 = Mock()
        param1.name = None
        param1.value = "value1"

        param2 = Mock()
        param2.name = "param2"
        param2.value = None

        param3 = Mock()
        param3.name = "validParam"
        param3.value = "validValue"

        base_validator.test_case.parameterValues = [param1, param2, param3]
        result = base_validator._get_user_params()

        assert result == {"validParam": "validValue"}


def _mock_sql_query(sql_string: str) -> Mock:
    """Create a mock SqlQuery object with .root attribute."""
    mock_sql_query = Mock()
    mock_sql_query.root = sql_string
    return mock_sql_query


class TestBaseValidatorCompileSqlExpression:
    """Test cases for compile_sql_expression method in base validator"""

    @pytest.fixture
    def base_validator_with_runtime_params(self):
        mock_runner = Mock()
        mock_test_case = Mock()
        mock_test_case.parameterValues = []
        mock_execution_date = datetime.now()

        validator = BaseValidator.__new__(BaseValidator)
        validator.runner = mock_runner
        validator.test_case = mock_test_case
        validator.execution_date = mock_execution_date

        mock_runtime_params = Mock()
        mock_test_definition = Mock()
        mock_test_definition.sqlExpression = _mock_sql_query(
            "SELECT {{ column_name }} FROM {{ table_name }} WHERE value >= {{ threshold }}"
        )
        mock_runtime_params.test_definition = mock_test_definition
        validator.runtime_params = mock_runtime_params

        return validator

    def test_compile_basic_template(self, base_validator_with_runtime_params):
        param = Mock()
        param.name = "threshold"
        param.value = "100"
        base_validator_with_runtime_params.test_case.parameterValues = [param]

        result = base_validator_with_runtime_params.compile_sql_expression(
            column_name="my_column", table_name="db.schema.my_table"
        )

        assert result == "SELECT my_column FROM db.schema.my_table WHERE value >= 100"

    def test_compile_raises_error_when_no_sql_expression(
        self, base_validator_with_runtime_params
    ):
        base_validator_with_runtime_params.runtime_params.test_definition.sqlExpression = (
            None
        )

        with pytest.raises(
            ValueError, match="Test definition does not have sqlExpression defined"
        ):
            base_validator_with_runtime_params.compile_sql_expression(
                column_name="col", table_name="table"
            )

    def test_compile_with_multiple_params(self, base_validator_with_runtime_params):
        base_validator_with_runtime_params.runtime_params.test_definition.sqlExpression = _mock_sql_query(
            "SELECT {{ column_name }} FROM {{ table_name }} "
            "WHERE value >= {{ minValue }} AND value <= {{ maxValue }}"
        )

        param1 = Mock()
        param1.name = "minValue"
        param1.value = "10"

        param2 = Mock()
        param2.name = "maxValue"
        param2.value = "100"

        base_validator_with_runtime_params.test_case.parameterValues = [param1, param2]

        result = base_validator_with_runtime_params.compile_sql_expression(
            column_name="revenue", table_name="sales.orders"
        )

        assert (
            result
            == "SELECT revenue FROM sales.orders WHERE value >= 10 AND value <= 100"
        )

    def test_compile_raises_error_on_invalid_jinja_syntax(
        self, base_validator_with_runtime_params
    ):
        base_validator_with_runtime_params.runtime_params.test_definition.sqlExpression = _mock_sql_query(
            "SELECT {{ column_name } FROM {{ table_name }}"
        )

        with pytest.raises(ValueError, match="Invalid Jinja2 syntax"):
            base_validator_with_runtime_params.compile_sql_expression(
                column_name="col", table_name="table"
            )

    def test_compile_raises_error_on_undefined_variable(
        self, base_validator_with_runtime_params
    ):
        base_validator_with_runtime_params.runtime_params.test_definition.sqlExpression = _mock_sql_query(
            "SELECT {{ column_name }} FROM {{ table_name }} WHERE val > {{ undefined_param }}"
        )
        base_validator_with_runtime_params.test_case.parameterValues = []

        with pytest.raises(ValueError, match="Undefined variable in SQL expression"):
            base_validator_with_runtime_params.compile_sql_expression(
                column_name="col", table_name="table"
            )


class TestSQAValidatorCompileSqlExpression:
    """Test cases for compile_sql_expression method in SQLAlchemy validator"""

    @pytest.fixture
    def sqa_validator(self):
        mock_runner = Mock()
        mock_test_case = Mock()
        mock_test_case.parameterValues = []
        mock_execution_date = datetime.now()

        validator = SQAValidator.__new__(SQAValidator)
        validator.runner = mock_runner
        validator.test_case = mock_test_case
        validator.execution_date = mock_execution_date

        mock_runtime_params = Mock()
        mock_test_definition = Mock()
        mock_test_definition.sqlExpression = _mock_sql_query(
            "SELECT {{ column_name }} FROM {{ table_name }} WHERE value >= {{ threshold }}"
        )
        mock_runtime_params.test_definition = mock_test_definition
        validator.runtime_params = mock_runtime_params

        return validator

    def test_compile_returns_tuple_with_bind_params(self, sqa_validator):
        param = Mock()
        param.name = "threshold"
        param.value = "100"
        sqa_validator.test_case.parameterValues = [param]

        result = sqa_validator.compile_sql_expression(
            column_name="my_column", table_name="db.schema.my_table"
        )

        assert isinstance(result, tuple)
        assert len(result) == 2

        compiled_sql, bind_params = result
        assert (
            compiled_sql
            == "SELECT my_column FROM db.schema.my_table WHERE value >= :threshold"
        )
        assert bind_params == {"threshold": "100"}

    def test_compile_with_multiple_user_params(self, sqa_validator):
        sqa_validator.runtime_params.test_definition.sqlExpression = _mock_sql_query(
            "SELECT {{ column_name }} FROM {{ table_name }} "
            "WHERE value >= {{ minVal }} AND value <= {{ maxVal }}"
        )

        param1 = Mock()
        param1.name = "minVal"
        param1.value = "10"

        param2 = Mock()
        param2.name = "maxVal"
        param2.value = "100"

        sqa_validator.test_case.parameterValues = [param1, param2]

        compiled_sql, bind_params = sqa_validator.compile_sql_expression(
            column_name="amount", table_name="finance.transactions"
        )

        assert ":minVal" in compiled_sql
        assert ":maxVal" in compiled_sql
        assert "amount" in compiled_sql
        assert "finance.transactions" in compiled_sql
        assert bind_params == {"minVal": "10", "maxVal": "100"}

    def test_compile_with_no_user_params(self, sqa_validator):
        sqa_validator.runtime_params.test_definition.sqlExpression = _mock_sql_query(
            "SELECT {{ column_name }} FROM {{ table_name }} WHERE 1=1"
        )
        sqa_validator.test_case.parameterValues = []

        compiled_sql, bind_params = sqa_validator.compile_sql_expression(
            column_name="id", table_name="users"
        )

        assert compiled_sql == "SELECT id FROM users WHERE 1=1"
        assert bind_params == {}


class TestPandasValidatorRunResults:
    """Test cases for _run_results method in Pandas validator"""

    @pytest.fixture
    def pandas_validator(self):
        mock_test_case = Mock()
        mock_test_case.parameterValues = []
        mock_execution_date = datetime.now()

        validator = PandasValidator.__new__(PandasValidator)
        validator.test_case = mock_test_case
        validator.execution_date = mock_execution_date

        return validator

    def test_run_results_counts_matching_rows(self, pandas_validator):
        df1 = MagicMock()
        df1.query.return_value = MagicMock(__len__=lambda self: 5)

        df2 = MagicMock()
        df2.query.return_value = MagicMock(__len__=lambda self: 3)

        pandas_validator.runner = [df1, df2]

        result = pandas_validator._run_results("age >= 18")

        assert result == 8
        df1.query.assert_called_once_with("age >= 18")
        df2.query.assert_called_once_with("age >= 18")

    def test_run_results_raises_on_query_error(self, pandas_validator):
        df1 = MagicMock()
        df1.query.side_effect = Exception("Query error")

        pandas_validator.runner = [df1]

        with pytest.raises(Exception, match="Query error"):
            pandas_validator._run_results("invalid query")
