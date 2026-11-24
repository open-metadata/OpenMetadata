"""
Unit tests for RuleLibrarySqlExpressionValidator.compile_sql_expression method
"""

from datetime import date, datetime, time, timezone
from decimal import Decimal
from unittest.mock import MagicMock, Mock

import pytest
from jinja2.exceptions import SecurityError

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
from metadata.data_quality.validations.table.base.tableRuleLibrarySqlExpressionValidator import (
    TableRuleLibrarySqlExpressionValidator as TableBaseValidator,
)
from metadata.data_quality.validations.table.sqlalchemy.tableRuleLibrarySqlExpressionValidator import (
    TableRuleLibrarySqlExpressionValidator as TableSQAValidator,
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


class TestBaseValidatorGetTableName:
    @pytest.mark.parametrize(
        "validator_class,entity_link,database_type,expected",
        [
            pytest.param(
                BaseValidator,
                "<#E::table::athena.default.sales.orders::columns::id>",
                "Athena",
                "sales.orders",
                id="column-athena-skips-default-database",
            ),
            pytest.param(
                TableBaseValidator,
                "<#E::table::athena.default.sales.orders>",
                "Athena",
                "sales.orders",
                id="table-athena-skips-default-database",
            ),
            pytest.param(
                BaseValidator,
                "<#E::table::postgres.warehouse.sales.orders::columns::id>",
                "Postgres",
                "warehouse.sales.orders",
                id="column-postgres-keeps-database",
            ),
            pytest.param(
                TableBaseValidator,
                "<#E::table::postgres.warehouse.sales.orders>",
                "Postgres",
                "warehouse.sales.orders",
                id="table-postgres-keeps-database",
            ),
        ],
    )
    def test_get_table_name(self, validator_class, entity_link, database_type, expected):
        validator = validator_class.__new__(validator_class)
        validator.test_case = Mock(entityLink=Mock(root=entity_link))
        validator.runtime_params = Mock(conn_config=Mock(config=Mock(type=Mock(value=database_type))))

        assert validator.get_table_name() == expected


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

    def test_compile_raises_error_when_no_sql_expression(self, base_validator_with_runtime_params):
        base_validator_with_runtime_params.runtime_params.test_definition.sqlExpression = None

        with pytest.raises(ValueError, match="Test definition does not have sqlExpression defined"):
            base_validator_with_runtime_params.compile_sql_expression(column_name="col", table_name="table")

    def test_compile_with_multiple_params(self, base_validator_with_runtime_params):
        base_validator_with_runtime_params.runtime_params.test_definition.sqlExpression = _mock_sql_query(
            "SELECT {{ column_name }} FROM {{ table_name }} WHERE value >= {{ minValue }} AND value <= {{ maxValue }}"
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

        assert result == "SELECT revenue FROM sales.orders WHERE value >= 10 AND value <= 100"

    def test_compile_raises_error_on_invalid_jinja_syntax(self, base_validator_with_runtime_params):
        base_validator_with_runtime_params.runtime_params.test_definition.sqlExpression = _mock_sql_query(
            "SELECT {{ column_name } FROM {{ table_name }}"
        )

        with pytest.raises(ValueError, match="Invalid Jinja2 syntax"):
            base_validator_with_runtime_params.compile_sql_expression(column_name="col", table_name="table")

    def test_compile_raises_error_on_undefined_variable(self, base_validator_with_runtime_params):
        base_validator_with_runtime_params.runtime_params.test_definition.sqlExpression = _mock_sql_query(
            "SELECT {{ column_name }} FROM {{ table_name }} WHERE val > {{ undefined_param }}"
        )
        base_validator_with_runtime_params.test_case.parameterValues = []

        with pytest.raises(ValueError, match="Undefined variable in SQL expression"):
            base_validator_with_runtime_params.compile_sql_expression(column_name="col", table_name="table")


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

        result = sqa_validator.compile_sql_expression(column_name="my_column", table_name="db.schema.my_table")

        assert isinstance(result, tuple)
        assert len(result) == 2

        compiled_sql, bind_params = result
        assert compiled_sql == "SELECT my_column FROM db.schema.my_table WHERE value >= :threshold"
        assert bind_params == {"threshold": "100"}

    def test_compile_with_multiple_user_params(self, sqa_validator):
        sqa_validator.runtime_params.test_definition.sqlExpression = _mock_sql_query(
            "SELECT {{ column_name }} FROM {{ table_name }} WHERE value >= {{ minVal }} AND value <= {{ maxVal }}"
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

        compiled_sql, bind_params = sqa_validator.compile_sql_expression(column_name="id", table_name="users")

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

        # The expression is syntactically safe so it passes is_safe_pandas_query and
        # reaches DataFrame.query, whose error must propagate
        with pytest.raises(Exception, match="Query error"):
            pandas_validator._run_results("age >= 18")


class TestCompileSqlExpressionSandbox:
    """The SQL expression is user-authored, so rendering must not reach Python internals."""

    SSTI_PAYLOADS = (
        "SELECT * FROM {{ table_name }} WHERE {{ cycler.__init__.__globals__.os.popen('echo pwned').read() }}",
        "SELECT * FROM {{ table_name }} WHERE {{ ''.__class__.__mro__[1].__subclasses__() }}",
    )

    @staticmethod
    def _validator(validator_class, sql_expression: str):
        validator = validator_class.__new__(validator_class)
        validator.test_case = Mock()
        validator.test_case.parameterValues = []
        validator.runtime_params = Mock()
        validator.runtime_params.test_definition.sqlExpression = _mock_sql_query(sql_expression)
        return validator

    @staticmethod
    def _compile(validator):
        if isinstance(validator, (TableBaseValidator, TableSQAValidator)):
            return validator.compile_sql_expression(table_name="db.schema.tbl")
        return validator.compile_sql_expression(column_name="col", table_name="db.schema.tbl")

    @pytest.mark.parametrize("payload", SSTI_PAYLOADS)
    @pytest.mark.parametrize("validator_class", [BaseValidator, TableBaseValidator])
    def test_base_validator_rejects_unsafe_template(self, validator_class, payload):
        validator = self._validator(validator_class, payload)

        with pytest.raises(ValueError, match="Unsafe operation in SQL expression"):
            self._compile(validator)

    @pytest.mark.parametrize("payload", SSTI_PAYLOADS)
    @pytest.mark.parametrize("validator_class", [SQAValidator, TableSQAValidator])
    def test_sqa_validator_rejects_unsafe_template(self, validator_class, payload):
        validator = self._validator(validator_class, payload)

        with pytest.raises(SecurityError):
            self._compile(validator)

    @pytest.mark.parametrize("validator_class", [BaseValidator, TableBaseValidator, SQAValidator, TableSQAValidator])
    def test_safe_template_still_renders(self, validator_class):
        validator = self._validator(validator_class, "SELECT * FROM {{ table_name }} {% if 1 %}WHERE 1=1{% endif %}")

        result = self._compile(validator)

        compiled_sql = result[0] if isinstance(result, tuple) else result
        assert compiled_sql == "SELECT * FROM db.schema.tbl WHERE 1=1"


@pytest.mark.parametrize("validator_class", [SQAValidator, TableSQAValidator])
@pytest.mark.parametrize("metadata_label", ["default", "reporting"])
@pytest.mark.parametrize("dialect_name", ["postgresql", "mysql", "oracle", "clickhouse"])
def test_sql_table_reference_ignores_metadata_identity(validator_class, metadata_label, dialect_name):
    from clickhouse_sqlalchemy.drivers.http.base import ClickHouseDialect_http
    from sqlalchemy import MetaData, Table
    from sqlalchemy.dialects import mysql, oracle, postgresql

    from metadata.profiler.processor.runner import QueryRunner

    dialect = {
        "postgresql": postgresql.dialect(),
        "mysql": mysql.dialect(),
        "oracle": oracle.dialect(),
        "clickhouse": ClickHouseDialect_http(),
    }[dialect_name]
    physical = Table("Order.Items", MetaData(), schema="Sales")
    session = Mock()
    session.connection.return_value.dialect = dialect
    session.connection.return_value.get_execution_options.return_value = {}
    validator = validator_class.__new__(validator_class)
    validator.runner = QueryRunner(session, None, physical)
    validator.test_case = Mock(entityLink=Mock(root=f'<#E::table::"dotted.service".{metadata_label}.wrong.wrong>'))
    validator.runtime_params = Mock()
    expected = str(physical.compile(dialect=dialect, compile_kwargs={"asfrom": True}))
    assert validator.get_table_name() == expected


@pytest.mark.parametrize("validator_class", [SQAValidator, TableSQAValidator])
@pytest.mark.parametrize(
    "table_name", ["normal", "select", "MixedCase", "order.items", "rate%", "colon:name", r"slash\:name"]
)
def test_identifier_boundary_executes_without_changing_user_binds(validator_class, table_name):
    from sqlalchemy import Column, Integer, MetaData, Table, create_engine, text
    from sqlalchemy.orm import Session

    from metadata.profiler.processor.runner import QueryRunner

    engine = create_engine("sqlite://")
    physical = Table(table_name, MetaData(), Column("amount", Integer))
    physical.metadata.create_all(engine)
    with Session(engine) as session:
        session.execute(physical.insert(), [{"amount": -1}, {"amount": 10}])
        validator = validator_class.__new__(validator_class)
        validator.runner = QueryRunner(session, None, physical)
        validator.test_case = Mock(parameterValues=[Mock(name="unused")])
        parameter = Mock()
        parameter.name, parameter.value = "limit", "0"
        validator.test_case.parameterValues = [parameter]
        validator.runtime_params = Mock()
        validator.runtime_params.test_definition.sqlExpression = _mock_sql_query(
            "SELECT * FROM {{ table_name }} WHERE amount < {{ limit }}"
        )
        logical_name = validator.get_table_name()
        kwargs = {"table_name": logical_name}
        if validator_class is SQAValidator:
            kwargs["column_name"] = "amount"
        sql, params = validator.compile_sql_expression(**kwargs)
        assert set(text(sql).compile().params) == {"limit"}
        assert params == {"limit": "0"}
        assert validator._run_results((sql, params)) == 1
        assert table_name in logical_name


@pytest.mark.parametrize("validator_class", [SQAValidator, TableSQAValidator])
@pytest.mark.parametrize("dialect_name", ["postgresql", "mysql"])
@pytest.mark.parametrize("paramstyle", ["named", "pyformat", "format"])
def test_percent_identifier_is_escaped_once_at_final_compilation(validator_class, dialect_name, paramstyle):
    from sqlalchemy import MetaData, Table, text
    from sqlalchemy.dialects import mysql, postgresql

    from metadata.profiler.processor.runner import QueryRunner

    dialect = {"postgresql": postgresql.dialect(paramstyle=paramstyle), "mysql": mysql.dialect(paramstyle=paramstyle)}[
        dialect_name
    ]
    physical = Table("rate%:value", MetaData(), schema="sales%")
    session = Mock()
    session.connection.return_value.dialect = dialect
    session.connection.return_value.get_execution_options.return_value = {}
    validator = TestCompileSqlExpressionSandbox._validator(
        validator_class, "SELECT * FROM {{ table_name }} WHERE amount < :limit"
    )
    validator.runner = QueryRunner(session, None, physical)
    kwargs = {"table_name": validator.get_table_name()}
    if validator_class is SQAValidator:
        kwargs["column_name"] = "amount"
    sql, _ = validator.compile_sql_expression(**kwargs)
    compiled = text(sql).compile(dialect=dialect)
    expected = str(physical.compile(dialect=dialect, compile_kwargs={"asfrom": True}))
    assert str(compiled).startswith(f"SELECT * FROM {expected} WHERE")
    assert set(compiled.params) == {"limit"}


@pytest.mark.parametrize("validator_class", [SQAValidator, TableSQAValidator])
def test_sql_error_rolls_back_and_allows_a_following_rule(validator_class):
    from sqlalchemy import Column, Integer, MetaData, Table, create_engine, func, select
    from sqlalchemy.exc import OperationalError
    from sqlalchemy.orm import Session

    from metadata.profiler.processor.runner import QueryRunner

    physical = Table("orders", MetaData(), Column("amount", Integer))
    engine = create_engine("sqlite://")
    physical.metadata.create_all(engine)
    with Session(engine) as session:
        validator = validator_class.__new__(validator_class)
        validator.runner = QueryRunner(session, None, physical)
        session.execute(physical.insert(), {"amount": -1})
        with pytest.raises(OperationalError):
            validator._run_results(("SELECT invalid_column FROM orders", {}))
        assert session.execute(select(func.count()).select_from(physical)).scalar() == 0
        session.execute(physical.insert(), {"amount": -1})
        assert validator._run_results(("SELECT * FROM orders WHERE amount < :limit", {"limit": "0"})) == 1
        with pytest.raises(RuntimeError, match="not safe"):
            validator._run_results(("DELETE FROM orders", {}))
        assert validator._run_row_count() == 1


@pytest.mark.parametrize("validator_class", [SQAValidator, TableSQAValidator])
def test_row_count_error_rolls_back_and_recovers(validator_class):
    from sqlalchemy import Column, Integer, MetaData, Table, create_engine
    from sqlalchemy.exc import OperationalError
    from sqlalchemy.orm import Session

    from metadata.profiler.processor.runner import QueryRunner

    physical = Table("orders", MetaData(), Column("amount", Integer))
    engine = create_engine("sqlite://")
    with Session(engine) as session:
        validator = validator_class.__new__(validator_class)
        validator.runner = QueryRunner(session, None, physical)
        with pytest.raises(OperationalError):
            validator._run_row_count()
        physical.metadata.create_all(engine)
        session.execute(physical.insert(), {"amount": 1})
        assert validator._run_row_count() == 1


class TestRuleLibraryParamTypeCoercion:
    """Test parameter type coercion and explicit SQLAlchemy bind types (#38627)."""

    @pytest.mark.parametrize(
        ("raw_value", "data_type", "expected"),
        [
            ("42", "INT", 42),
            ("3.14", "FLOAT", 3.14),
            ("2.718", "DOUBLE", 2.718),
            ("10", "NUMBER", 10),
            ("10.5", "NUMBER", 10.5),
            ("99.95", "DECIMAL", Decimal("99.95")),
            ("true", "BOOLEAN", True),
            ("FALSE", "BOOLEAN", False),
            ("2026-11-24", "DATE", date(2026, 11, 24)),
            ("14:30:00", "TIME", time(14, 30, 0)),
            (
                "2026-11-24T14:30:00Z",
                "TIMESTAMP",
                datetime(2026, 11, 24, 14, 30, 0, tzinfo=timezone.utc),
            ),
            ("hello", "STRING", "hello"),
            ("not-a-float", "FLOAT", "not-a-float"),
        ],
    )
    def test_coerce_rule_library_param_value(self, raw_value, data_type, expected):
        from metadata.data_quality.validations.utils import (
            coerce_rule_library_param_value,
        )

        result = coerce_rule_library_param_value(raw_value, data_type)
        assert result == expected
        assert type(result) is type(expected)

    @pytest.mark.parametrize("validator_class", [SQAValidator, TableSQAValidator])
    def test_sqa_validator_coerces_and_attaches_typed_bindparams(self, validator_class):
        from sqlalchemy import Boolean, Float, Integer

        from metadata.generated.schema.tests.testDefinition import TestDataType

        validator = validator_class.__new__(validator_class)
        session = MagicMock()
        session.execute.return_value.fetchall.return_value = [(1,)]
        validator.runner = Mock(_session=session)

        p_float = Mock(name="p_float")
        p_float.name, p_float.value = "threshold", "3.14"
        p_int = Mock(name="p_int")
        p_int.name, p_int.value = "min_rows", "5"
        p_bool = Mock(name="p_bool")
        p_bool.name, p_bool.value = "is_active", "true"
        p_unused = Mock(name="p_unused")
        p_unused.name, p_unused.value = "unused_threshold", "10"
        validator.test_case = Mock(parameterValues=[p_float, p_int, p_bool, p_unused])

        d_float = Mock()
        d_float.name, d_float.dataType = "threshold", TestDataType.FLOAT
        d_int = Mock()
        d_int.name, d_int.dataType = "min_rows", TestDataType.INT
        d_bool = Mock()
        d_bool.name, d_bool.dataType = "is_active", TestDataType.BOOLEAN
        d_unused = Mock()
        d_unused.name, d_unused.dataType = "unused_threshold", TestDataType.NUMBER

        validator.runtime_params = Mock()
        validator.runtime_params.test_definition.parameterDefinition = [
            d_float,
            d_int,
            d_bool,
            d_unused,
        ]
        validator.runtime_params.test_definition.sqlExpression = Mock(
            root=(
                "SELECT * FROM {{ table_name }} "
                "WHERE score > {{ threshold }} AND qty >= {{ min_rows }} AND active = {{ is_active }}"
            )
        )

        kwargs = {"table_name": "orders"}
        if validator_class is SQAValidator:
            kwargs["column_name"] = "score"

        compiled_sql, bind_params = validator.compile_sql_expression(**kwargs)
        assert bind_params == {
            "threshold": 3.14,
            "min_rows": 5,
            "is_active": True,
            "unused_threshold": 10,
        }
        assert isinstance(bind_params["threshold"], float)
        assert isinstance(bind_params["min_rows"], int)
        assert isinstance(bind_params["is_active"], bool)

        count = validator._run_results((compiled_sql, bind_params))
        assert count == 1

        stmt, passed_params = session.execute.call_args.args
        assert passed_params == {
            "threshold": 3.14,
            "min_rows": 5,
            "is_active": True,
            "unused_threshold": 10,
        }
        assert isinstance(stmt._bindparams["threshold"].type, Float)
        assert isinstance(stmt._bindparams["min_rows"].type, Integer)
        assert isinstance(stmt._bindparams["is_active"].type, Boolean)
        assert "unused_threshold" not in stmt._bindparams
