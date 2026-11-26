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
"""
Unit tests for Rule Library SQL expression parameter type coercion and database-specific binding.
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import uuid4

import pandas as pd
import psycopg2.extensions
import pymysql.converters
import pytest
from clickhouse_sqlalchemy.drivers.http.base import ClickHouseDialect_http
from databricks.sql.parameters.native import (
    BooleanParameter,
    DateParameter,
    DecimalParameter,
    DoubleParameter,
    IntegerParameter,
    StringParameter,
    TimestampParameter,
    dbsql_parameter_from_primitive,
)
from databricks.sqlalchemy import DatabricksDialect
from google.cloud.bigquery.dbapi import _helpers as bigquery_helpers
from pyathena.formatter import DefaultParameterFormatter
from pyathena.sqlalchemy.base import AthenaDialect
from sqlalchemy import Boolean, Column, Date, DateTime, Float, Integer, MetaData, Numeric, String, Table, create_engine
from sqlalchemy.dialects import sqlite
from sqlalchemy.dialects.mysql.pymysql import MySQLDialect_pymysql
from sqlalchemy.dialects.oracle.oracledb import OracleDialect_oracledb
from sqlalchemy.dialects.postgresql.psycopg2 import PGDialect_psycopg2
from sqlalchemy.orm import Session
from sqlalchemy_bigquery import BigQueryDialect
from trino.dbapi import Cursor as TrinoCursor
from trino.sqlalchemy.dialect import TrinoDialect

from metadata.data_quality.validations.column.pandas.columnRuleLibrarySqlExpressionValidator import (
    ColumnRuleLibrarySqlExpressionValidator as PandasColumnValidator,
)
from metadata.data_quality.validations.column.sqlalchemy.columnRuleLibrarySqlExpressionValidator import (
    ColumnRuleLibrarySqlExpressionValidator as SQAColumnValidator,
)
from metadata.data_quality.validations.models import (
    RuleLibrarySqlExpressionRuntimeParameters,
)
from metadata.data_quality.validations.table.pandas.tableRuleLibrarySqlExpressionValidator import (
    TableRuleLibrarySqlExpressionValidator as PandasTableValidator,
)
from metadata.data_quality.validations.table.sqlalchemy.tableRuleLibrarySqlExpressionValidator import (
    TableRuleLibrarySqlExpressionValidator as SQATableValidator,
)
from metadata.data_quality.validations.utils import (
    build_typed_text_clause,
    coerce_test_case_param_value,
)
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
    SQLiteScheme,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.tests.testDefinition import (
    EntityType,
    TestCaseParameterDefinition,
    TestDataType,
    TestDefinition,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.profiler.processor.runner import PandasRunner, QueryRunner

EXECUTION_DATE = int(datetime(2025, 1, 15).timestamp() * 1000)
COLUMN_LINK = "<#E::table::service.db.main.metrics::columns::price>"
TABLE_LINK = "<#E::table::service.db.main.metrics>"


def _build_test_case(
    entity_type: EntityType,
    sql_expression: str,
    param_defs: list[TestCaseParameterDefinition],
    param_values: list[TestCaseParameterValue],
) -> TestCase:
    entity_link = COLUMN_LINK if entity_type is EntityType.COLUMN else TABLE_LINK
    test_definition = TestDefinition(
        id=uuid4(),
        name="typedParamRule",
        description="Rule with typed parameters",
        entityType=entity_type,
        testPlatforms=["OpenMetadata"],
        parameterDefinition=param_defs,
        sqlExpression=sql_expression,
    )  # type: ignore
    runtime_params = RuleLibrarySqlExpressionRuntimeParameters(
        conn_config=DatabaseConnection(
            config=SQLiteConnection(scheme=SQLiteScheme.sqlite_pysqlite, databaseMode=":memory:")  # type: ignore
        ),
        test_definition=test_definition,
    )
    all_values = [
        *param_values,
        TestCaseParameterValue(
            name=RuleLibrarySqlExpressionRuntimeParameters.__name__,
            value=runtime_params.model_dump_json(),
        ),
    ]
    return TestCase(
        name="typed_param_case",
        entityLink=entity_link,
        testSuite=EntityReference(id=uuid4(), type="TestSuite"),  # type: ignore
        testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),  # type: ignore
        parameterValues=all_values,
    )  # type: ignore


def _compile_and_process_for_dialect(
    validator_class: type[SQAColumnValidator] | type[SQATableValidator],
    entity_type: EntityType,
    data_type: TestDataType,
    raw_value: str,
    dialect: Any,
) -> tuple[str, Any]:
    """Compile a rule-library query through the validator and apply the SQLAlchemy dialect's bind processor."""
    sql_template = (
        "SELECT {{ column_name }} FROM {{ table_name }} WHERE {{ column_name }} > {{ threshold_val }}"
        if entity_type is EntityType.COLUMN
        else "SELECT * FROM {{ table_name }} WHERE price > {{ threshold_val }}"
    )
    test_case = _build_test_case(
        entity_type=entity_type,
        sql_expression=sql_template,
        param_defs=[TestCaseParameterDefinition(name="threshold_val", dataType=data_type)],
        param_values=[TestCaseParameterValue(name="threshold_val", value=raw_value)],
    )
    validator = validator_class.__new__(validator_class)
    validator.test_case = test_case
    validator.runtime_params = validator.get_runtime_parameters(RuleLibrarySqlExpressionRuntimeParameters)

    if validator_class is SQAColumnValidator:
        compiled_sql, bind_params = validator.compile_sql_expression(column_name="price", table_name="sales.metrics")
    else:
        compiled_sql, bind_params = validator.compile_sql_expression(table_name="sales.metrics")

    stmt = build_typed_text_clause(compiled_sql, bind_params, validator._get_parameter_types())
    compiled = stmt.compile(dialect=dialect)
    bind = stmt._bindparams["threshold_val"]
    processor = bind.type.dialect_impl(dialect).bind_processor(dialect)
    processed_value = processor(bind_params["threshold_val"]) if processor else bind_params["threshold_val"]
    return str(compiled), processed_value


class TestCoerceTestCaseParamValue:
    """Generic coercion tests for all TestDataType values."""

    @pytest.mark.parametrize(
        ("raw_value", "data_type", "expected", "expected_type"),
        [
            pytest.param("42", TestDataType.INT, 42, int, id="int-positive"),
            pytest.param("0", TestDataType.INT, 0, int, id="int-zero"),
            pytest.param(" -7 ", TestDataType.INT, -7, int, id="int-negative-whitespace"),
            pytest.param("3.14", TestDataType.FLOAT, 3.14, float, id="float-decimal"),
            pytest.param("10", TestDataType.FLOAT, 10.0, float, id="float-from-whole-number"),
            pytest.param("0.0", TestDataType.FLOAT, 0.0, float, id="float-zero"),
            pytest.param("1e-3", TestDataType.FLOAT, 0.001, float, id="float-scientific"),
            pytest.param("3.14159265", TestDataType.DOUBLE, 3.14159265, float, id="double-decimal"),
            pytest.param("0", TestDataType.DOUBLE, 0.0, float, id="double-from-zero"),
            pytest.param(" -2.5 ", TestDataType.DOUBLE, -2.5, float, id="double-negative"),
            pytest.param("99.95", TestDataType.DECIMAL, Decimal("99.95"), Decimal, id="decimal-fraction"),
            pytest.param("0", TestDataType.DECIMAL, Decimal("0"), Decimal, id="decimal-zero"),
            pytest.param("42", TestDataType.NUMBER, 42, int, id="number-integer"),
            pytest.param("0", TestDataType.NUMBER, 0, int, id="number-zero"),
            pytest.param("3.14", TestDataType.NUMBER, 3.14, float, id="number-float"),
            pytest.param("true", TestDataType.BOOLEAN, True, bool, id="boolean-true-lower"),
            pytest.param(" TRUE ", TestDataType.BOOLEAN, True, bool, id="boolean-true-upper"),
            pytest.param("false", TestDataType.BOOLEAN, False, bool, id="boolean-false-lower"),
            pytest.param("False", TestDataType.BOOLEAN, False, bool, id="boolean-false-title"),
            pytest.param("2025-01-15", TestDataType.DATE, date(2025, 1, 15), date, id="date-iso"),
            pytest.param(
                "2025-01-15T10:30:00",
                TestDataType.DATETIME,
                datetime(2025, 1, 15, 10, 30, 0),
                datetime,
                id="datetime-iso-t",
            ),
            pytest.param(
                "2025-01-15 10:30:00",
                TestDataType.DATETIME,
                datetime(2025, 1, 15, 10, 30, 0),
                datetime,
                id="datetime-iso-space",
            ),
            pytest.param(
                "2025-01-15T10:30:00Z",
                TestDataType.TIMESTAMP,
                datetime(2025, 1, 15, 10, 30, 0, tzinfo=timezone.utc),
                datetime,
                id="timestamp-iso-utc-z",
            ),
            pytest.param(
                "2025-01-15T10:30:00+02:00",
                TestDataType.TIMESTAMP,
                datetime.fromisoformat("2025-01-15T10:30:00+02:00"),
                datetime,
                id="timestamp-iso-offset",
            ),
            pytest.param("3.14", TestDataType.STRING, "3.14", str, id="string-numeric-stays-str"),
            pytest.param("10:30:00", TestDataType.TIME, "10:30:00", str, id="time-stays-str"),
            pytest.param("[1, 2, 3]", TestDataType.ARRAY, "[1, 2, 3]", str, id="array-stays-str"),
            pytest.param("['a', 'b']", TestDataType.SET, "['a', 'b']", str, id="set-stays-str"),
            pytest.param('{"k": "v"}', TestDataType.MAP, '{"k": "v"}', str, id="map-stays-str"),
            pytest.param("3.14", None, "3.14", str, id="none-type-stays-str"),
            pytest.param("3.14", "DOUBLE", 3.14, float, id="string-enum-name-double"),
        ],
    )
    def test_coerce_valid_values(self, raw_value, data_type, expected, expected_type):
        result = coerce_test_case_param_value(raw_value, data_type, param_name="p")
        assert type(result) is expected_type
        assert result == expected

    @pytest.mark.parametrize(
        ("raw_value", "data_type"),
        [
            pytest.param("abc", TestDataType.INT, id="int-non-numeric"),
            pytest.param("10.0", TestDataType.INT, id="int-float-string"),
            pytest.param("abc", TestDataType.FLOAT, id="float-non-numeric"),
            pytest.param("nan", TestDataType.FLOAT, id="float-nan"),
            pytest.param("inf", TestDataType.FLOAT, id="float-inf"),
            pytest.param("-inf", TestDataType.DOUBLE, id="double-neg-inf"),
            pytest.param("NaN", TestDataType.DOUBLE, id="double-nan"),
            pytest.param("not-a-decimal", TestDataType.DECIMAL, id="decimal-invalid"),
            pytest.param("NaN", TestDataType.DECIMAL, id="decimal-nan"),
            pytest.param("Infinity", TestDataType.DECIMAL, id="decimal-inf"),
            pytest.param("abc", TestDataType.NUMBER, id="number-invalid"),
            pytest.param("inf", TestDataType.NUMBER, id="number-inf"),
            pytest.param("yes", TestDataType.BOOLEAN, id="boolean-yes"),
            pytest.param("1", TestDataType.BOOLEAN, id="boolean-one"),
        ],
    )
    def test_coerce_unparseable_values_fall_back_to_string_with_warning(self, raw_value, data_type, caplog):
        with caplog.at_level("WARNING"):
            result = coerce_test_case_param_value(raw_value, data_type, param_name="threshold")
        assert type(result) is str
        assert result == raw_value
        assert any("threshold" in rec.message and "keeping as string" in rec.message for rec in caplog.records)

    @pytest.mark.parametrize(
        ("raw_value", "data_type"),
        [
            pytest.param("2025/01/15", TestDataType.DATE, id="non-iso-date"),
            pytest.param("20250115", TestDataType.DATE, id="compact-date"),
            pytest.param("1736937000", TestDataType.TIMESTAMP, id="epoch-timestamp"),
            pytest.param("2025-01-15", TestDataType.DATETIME, id="date-only-for-datetime"),
            pytest.param("2025-01-15 10:30:00 UTC", TestDataType.TIMESTAMP, id="named-tz-timestamp"),
        ],
    )
    def test_non_iso_temporal_falls_back_to_string(self, raw_value, data_type):
        result = coerce_test_case_param_value(raw_value, data_type, param_name="ts")
        assert type(result) is str
        assert result == raw_value


class TestGenericRuleLibraryTypedExecution:
    """End-to-end execution tests for typed parameters on SQLite and Pandas (column + table)."""

    @pytest.mark.parametrize(
        ("validator_class", "entity_type"),
        [
            pytest.param(SQAColumnValidator, EntityType.COLUMN, id="sqa-column"),
            pytest.param(SQATableValidator, EntityType.TABLE, id="sqa-table"),
        ],
    )
    @pytest.mark.parametrize(
        ("data_type", "raw_value", "expected_sqlite_typeof"),
        [
            pytest.param(TestDataType.FLOAT, "10.2", "real", id="float-binds-as-real"),
            pytest.param(TestDataType.DOUBLE, "10.2", "real", id="double-binds-as-real"),
            pytest.param(TestDataType.DOUBLE, "10", "real", id="double-whole-number-binds-as-real"),
            pytest.param(TestDataType.DECIMAL, "10.2", "real", id="decimal-binds-via-numeric-processor"),
            pytest.param(TestDataType.INT, "10", "integer", id="int-binds-as-integer"),
            pytest.param(TestDataType.NUMBER, "10", "integer", id="number-whole-binds-as-integer"),
            pytest.param(TestDataType.NUMBER, "10.2", "real", id="number-float-binds-as-real"),
            pytest.param(TestDataType.STRING, "10.2", "text", id="string-binds-as-text"),
        ],
    )
    def test_sqlite_receives_native_bound_type_not_text(
        self, validator_class, entity_type, data_type, raw_value, expected_sqlite_typeof
    ):
        engine = create_engine("sqlite://")
        metrics = Table("metrics", MetaData(), Column("price", Float))
        metrics.metadata.create_all(engine)

        # If the parameter were bound as 'text', typeof(:minVal) would be 'text' and this query would return rows.
        sql = "SELECT * FROM {{ table_name }} WHERE typeof({{ minVal }}) != '" + expected_sqlite_typeof + "'"
        test_case = _build_test_case(
            entity_type=entity_type,
            sql_expression=sql,
            param_defs=[TestCaseParameterDefinition(name="minVal", dataType=data_type)],
            param_values=[TestCaseParameterValue(name="minVal", value=raw_value)],
        )
        with Session(engine) as session:
            session.execute(metrics.insert(), [{"price": 9.5}, {"price": 15.0}])
            runner = QueryRunner(session=session, dataset=metrics, raw_dataset=metrics)
            result = validator_class(runner, test_case, EXECUTION_DATE).run_validation()

        assert result.testCaseStatus == TestCaseStatus.Success
        assert result.testResultValue[0].value == "0"

    @pytest.mark.parametrize(
        ("validator_class", "entity_type"),
        [
            pytest.param(SQAColumnValidator, EntityType.COLUMN, id="sqa-column"),
            pytest.param(SQATableValidator, EntityType.TABLE, id="sqa-table"),
        ],
    )
    @pytest.mark.parametrize(
        ("data_type", "min_price", "expected_violations"),
        [
            pytest.param(TestDataType.FLOAT, "10.2", 1, id="float-numeric-comparison"),
            pytest.param(TestDataType.DOUBLE, "10.2", 1, id="double-numeric-comparison"),
            pytest.param(TestDataType.DECIMAL, "10.2", 1, id="decimal-numeric-comparison"),
            pytest.param(TestDataType.FLOAT, "0.0", 2, id="float-falsy-zero-is-preserved"),
            pytest.param(TestDataType.DOUBLE, "0", 2, id="double-falsy-zero-is-preserved"),
            pytest.param(TestDataType.DOUBLE, "20.0", 0, id="double-zero-violations-passes"),
        ],
    )
    def test_numeric_comparison_matches_numerically_and_handles_unused_threshold_params(
        self, validator_class, entity_type, data_type, min_price, expected_violations
    ):
        engine = create_engine("sqlite://")
        metrics = Table(
            "metrics",
            MetaData(),
            Column("id", Integer, primary_key=True),
            Column("price", Numeric(10, 2)),
            Column("active", Boolean),
            Column("created_date", Date),
            Column("updated_at", DateTime),
            Column("label", String(16)),
        )
        metrics.metadata.create_all(engine)

        sql = (
            "SELECT {{ column_name }} FROM {{ table_name }} WHERE {{ column_name }} > {{ minPrice }}"
            if entity_type is EntityType.COLUMN
            else "SELECT * FROM {{ table_name }} WHERE price > {{ minPrice }}"
        )
        # Include threshold/thresholdUnit definitions not referenced in sqlExpression to verify
        # build_typed_text_clause only attaches bindparams present in the SQL statement.
        test_case = _build_test_case(
            entity_type=entity_type,
            sql_expression=sql,
            param_defs=[
                TestCaseParameterDefinition(name="minPrice", dataType=data_type),
                TestCaseParameterDefinition(name="threshold", dataType=TestDataType.NUMBER),
                TestCaseParameterDefinition(name="thresholdUnit", dataType=TestDataType.STRING),
            ],
            param_values=[
                TestCaseParameterValue(name="minPrice", value=min_price),
                TestCaseParameterValue(name="threshold", value="0"),
                TestCaseParameterValue(name="thresholdUnit", value="ABSOLUTE"),
            ],
        )
        with Session(engine) as session:
            # 9.5 vs 10.2 distinguishes numeric from lexicographic comparison ('9.5' > '10.2' is True as text).
            session.execute(
                metrics.insert(),
                [
                    {
                        "id": 1,
                        "price": Decimal("9.50"),
                        "active": True,
                        "created_date": date(2025, 1, 10),
                        "updated_at": datetime(2025, 1, 10, 8, 0, 0),
                        "label": "a",
                    },
                    {
                        "id": 2,
                        "price": Decimal("15.25"),
                        "active": False,
                        "created_date": date(2025, 1, 20),
                        "updated_at": datetime(2025, 1, 20, 12, 0, 0),
                        "label": "b",
                    },
                ],
            )
            runner = QueryRunner(session=session, dataset=metrics, raw_dataset=metrics)
            result = validator_class(runner, test_case, EXECUTION_DATE).run_validation()

        assert result.testResultValue[0].value == str(expected_violations)
        assert result.testCaseStatus == (TestCaseStatus.Success if expected_violations == 0 else TestCaseStatus.Failed)

    @pytest.mark.parametrize(
        ("data_type", "raw_value"),
        [
            pytest.param(TestDataType.DATE, "2025/01/15", id="non-iso-date"),
            pytest.param(TestDataType.DATETIME, "2025/01/15 10:30:00", id="non-iso-datetime"),
            pytest.param(TestDataType.TIMESTAMP, "1736937000", id="epoch-timestamp"),
        ],
    )
    def test_non_iso_temporal_executes_on_sqlite_without_type_error(self, data_type, raw_value):
        """A non-ISO temporal string must not receive a SQLAlchemy Date/DateTime bind type (which crashes SQLite)."""
        engine = create_engine("sqlite://")
        metrics = Table("metrics", MetaData(), Column("label", String(32)))
        metrics.metadata.create_all(engine)

        test_case = _build_test_case(
            entity_type=EntityType.TABLE,
            sql_expression="SELECT * FROM {{ table_name }} WHERE label = {{ tsVal }}",
            param_defs=[TestCaseParameterDefinition(name="tsVal", dataType=data_type)],
            param_values=[TestCaseParameterValue(name="tsVal", value=raw_value)],
        )
        with Session(engine) as session:
            session.execute(metrics.insert(), [{"label": raw_value}, {"label": "other"}])
            runner = QueryRunner(session=session, dataset=metrics, raw_dataset=metrics)
            result = SQATableValidator(runner, test_case, EXECUTION_DATE).run_validation()

        assert result.testCaseStatus == TestCaseStatus.Failed
        assert result.testResultValue[0].value == "1"

    @pytest.mark.parametrize(
        ("validator_class", "entity_type"),
        [
            pytest.param(SQAColumnValidator, EntityType.COLUMN, id="sqa-column"),
            pytest.param(SQATableValidator, EntityType.TABLE, id="sqa-table"),
        ],
    )
    def test_boolean_and_date_params_execute_on_sqlite(self, validator_class, entity_type):
        engine = create_engine("sqlite://")
        metrics = Table(
            "metrics",
            MetaData(),
            Column("price", Float),
            Column("active", Boolean),
            Column("created_date", Date),
        )
        metrics.metadata.create_all(engine)

        test_case = _build_test_case(
            entity_type=entity_type,
            sql_expression=(
                "SELECT * FROM {{ table_name }} WHERE active = {{ expectedActive }} AND created_date >= {{ sinceDate }}"
            ),
            param_defs=[
                TestCaseParameterDefinition(name="expectedActive", dataType=TestDataType.BOOLEAN),
                TestCaseParameterDefinition(name="sinceDate", dataType=TestDataType.DATE),
            ],
            param_values=[
                TestCaseParameterValue(name="expectedActive", value="false"),
                TestCaseParameterValue(name="sinceDate", value="2025-01-15"),
            ],
        )
        with Session(engine) as session:
            session.execute(
                metrics.insert(),
                [
                    {"price": 5.0, "active": True, "created_date": date(2025, 1, 20)},
                    {"price": 12.5, "active": False, "created_date": date(2025, 1, 20)},
                    {"price": 15.0, "active": False, "created_date": date(2025, 1, 10)},
                ],
            )
            runner = QueryRunner(session=session, dataset=metrics, raw_dataset=metrics)
            result = validator_class(runner, test_case, EXECUTION_DATE).run_validation()

        assert result.testCaseStatus == TestCaseStatus.Failed
        assert result.testResultValue[0].value == "1"

    @pytest.mark.parametrize(
        ("validator_class", "entity_type", "expression"),
        [
            pytest.param(
                PandasColumnValidator,
                EntityType.COLUMN,
                "{{ column_name }} > {{ minPrice }} and active == {{ isActive }}",
                id="pandas-column",
            ),
            pytest.param(
                PandasTableValidator,
                EntityType.TABLE,
                "price > {{ minPrice }} and active == {{ isActive }}",
                id="pandas-table",
            ),
        ],
    )
    def test_pandas_validators_work_with_coerced_float_double_and_boolean(
        self, validator_class, entity_type, expression
    ):
        frame = pd.DataFrame(
            [
                {"price": 9.5, "active": True},
                {"price": 15.25, "active": True},
                {"price": 20.0, "active": False},
            ]
        )
        runner = PandasRunner(dataset=lambda: iter([frame]), raw_dataset=lambda: iter([frame]))
        test_case = _build_test_case(
            entity_type=entity_type,
            sql_expression=expression,
            param_defs=[
                TestCaseParameterDefinition(name="minPrice", dataType=TestDataType.DOUBLE),
                TestCaseParameterDefinition(name="isActive", dataType=TestDataType.BOOLEAN),
            ],
            param_values=[
                TestCaseParameterValue(name="minPrice", value="10.2"),
                TestCaseParameterValue(name="isActive", value="true"),
            ],
        )

        result = validator_class(runner, test_case, EXECUTION_DATE).run_validation()

        assert result.testCaseStatus == TestCaseStatus.Failed
        assert result.testResultValue[0].value == "1"

    @pytest.mark.parametrize(
        ("validator_class", "entity_type"),
        [
            pytest.param(SQAColumnValidator, EntityType.COLUMN, id="sqa-column"),
            pytest.param(SQATableValidator, EntityType.TABLE, id="sqa-table"),
        ],
    )
    @pytest.mark.parametrize("bad_threshold", ["nan", "inf", "not-a-number"])
    def test_unreferenced_unreadable_threshold_does_not_abort_sqa_rule(
        self, validator_class, entity_type, bad_threshold, caplog
    ):
        """Unreferenced failure-threshold params must not be coerced or abort before _read_failure_threshold runs."""
        engine = create_engine("sqlite://")
        metrics = Table("metrics", MetaData(), Column("price", Float))
        metrics.metadata.create_all(engine)

        sql = (
            "SELECT {{ column_name }} FROM {{ table_name }} WHERE {{ column_name }} > {{ minPrice }}"
            if entity_type is EntityType.COLUMN
            else "SELECT * FROM {{ table_name }} WHERE price > {{ minPrice }}"
        )
        test_case = _build_test_case(
            entity_type=entity_type,
            sql_expression=sql,
            param_defs=[
                TestCaseParameterDefinition(name="minPrice", dataType=TestDataType.DOUBLE),
                TestCaseParameterDefinition(name="threshold", dataType=TestDataType.NUMBER),
                TestCaseParameterDefinition(name="thresholdUnit", dataType=TestDataType.STRING),
            ],
            param_values=[
                TestCaseParameterValue(name="minPrice", value="10.2"),
                TestCaseParameterValue(name="threshold", value=bad_threshold),
                TestCaseParameterValue(name="thresholdUnit", value="ABSOLUTE"),
            ],
        )
        with Session(engine) as session:
            session.execute(metrics.insert(), [{"price": 9.5}, {"price": 15.0}])
            runner = QueryRunner(session=session, dataset=metrics, raw_dataset=metrics)
            validator = validator_class(runner, test_case, EXECUTION_DATE)
            validator.runtime_params = validator.get_runtime_parameters(RuleLibrarySqlExpressionRuntimeParameters)
            compile_kwargs = {"table_name": "metrics"}
            if validator_class is SQAColumnValidator:
                compile_kwargs["column_name"] = "price"
            with caplog.at_level("WARNING"):
                _, bind_params = validator.compile_sql_expression(**compile_kwargs)
                result = validator.run_validation()

        assert bind_params == {"minPrice": 10.2}
        assert "threshold" not in bind_params
        assert result.testCaseStatus == TestCaseStatus.Failed
        assert result.testResultValue[0].value == "1"
        assert not any("keeping as string" in rec.message for rec in caplog.records)

    @pytest.mark.parametrize(
        ("validator_class", "entity_type", "expression"),
        [
            pytest.param(PandasColumnValidator, EntityType.COLUMN, "{{ column_name }} > {{ minPrice }}", id="column"),
            pytest.param(PandasTableValidator, EntityType.TABLE, "price > {{ minPrice }}", id="table"),
        ],
    )
    def test_unreferenced_unreadable_threshold_does_not_abort_pandas_rule(
        self, validator_class, entity_type, expression, caplog
    ):
        frame = pd.DataFrame([{"price": 9.5}, {"price": 15.0}])
        runner = PandasRunner(dataset=lambda: iter([frame]), raw_dataset=lambda: iter([frame]))
        test_case = _build_test_case(
            entity_type=entity_type,
            sql_expression=expression,
            param_defs=[
                TestCaseParameterDefinition(name="minPrice", dataType=TestDataType.DOUBLE),
                TestCaseParameterDefinition(name="threshold", dataType=TestDataType.NUMBER),
                TestCaseParameterDefinition(name="thresholdUnit", dataType=TestDataType.STRING),
            ],
            param_values=[
                TestCaseParameterValue(name="minPrice", value="10.2"),
                TestCaseParameterValue(name="threshold", value="nan"),
                TestCaseParameterValue(name="thresholdUnit", value="ABSOLUTE"),
            ],
        )

        with caplog.at_level("WARNING"):
            result = validator_class(runner, test_case, EXECUTION_DATE).run_validation()

        assert result.testCaseStatus == TestCaseStatus.Failed
        assert result.testResultValue[0].value == "1"
        assert not any("keeping as string" in rec.message for rec in caplog.records)

    @pytest.mark.parametrize(
        ("data_type", "raw_value", "col_name", "sql_op", "expected_count"),
        [
            pytest.param(TestDataType.INT, "10.0", "price", ">", 1, id="legacy-int-decimal-string"),
            pytest.param(TestDataType.BOOLEAN, "1", "active", "=", 1, id="legacy-boolean-digit"),
            pytest.param(TestDataType.DECIMAL, "not-a-decimal", "label", "=", 1, id="unparseable-decimal-string"),
        ],
    )
    def test_legacy_unparseable_referenced_params_fall_back_without_crashing_sqla(
        self, data_type, raw_value, col_name, sql_op, expected_count
    ):
        """Legacy values that fail coercion must stay untyped strings so SQLAlchemy bind processors do not raise."""
        engine = create_engine("sqlite://")
        metrics = Table(
            "metrics",
            MetaData(),
            Column("price", Float),
            Column("active", Integer),
            Column("label", String(32)),
        )
        metrics.metadata.create_all(engine)

        test_case = _build_test_case(
            entity_type=EntityType.TABLE,
            sql_expression=f"SELECT * FROM {{{{ table_name }}}} WHERE {col_name} {sql_op} {{{{ legacyVal }}}}",
            param_defs=[TestCaseParameterDefinition(name="legacyVal", dataType=data_type)],
            param_values=[TestCaseParameterValue(name="legacyVal", value=raw_value)],
        )
        with Session(engine) as session:
            session.execute(
                metrics.insert(),
                [
                    {"price": 5.0, "active": 0, "label": "other"},
                    {"price": 15.0, "active": 1, "label": "not-a-decimal"},
                ],
            )
            runner = QueryRunner(session=session, dataset=metrics, raw_dataset=metrics)
            result = SQATableValidator(runner, test_case, EXECUTION_DATE).run_validation()

        assert result.testCaseStatus == TestCaseStatus.Failed
        assert result.testResultValue[0].value == str(expected_count)


class TestDatabaseSpecificParameterBinding:
    """Database-specific dialect compilation and DBAPI parameter formatting tests."""

    @pytest.mark.parametrize(
        ("validator_class", "entity_type"),
        [
            pytest.param(SQAColumnValidator, EntityType.COLUMN, id="column"),
            pytest.param(SQATableValidator, EntityType.TABLE, id="table"),
        ],
    )
    @pytest.mark.parametrize(
        ("data_type", "raw_value", "expected_literal"),
        [
            pytest.param(TestDataType.FLOAT, "3.14", "3.14", id="athena-float"),
            pytest.param(TestDataType.DOUBLE, "3.14", "3.14", id="athena-double"),
            pytest.param(TestDataType.DOUBLE, "10", "10.0", id="athena-double-from-int-str"),
            pytest.param(TestDataType.INT, "42", "42", id="athena-int"),
            pytest.param(TestDataType.NUMBER, "42", "42", id="athena-number-int"),
            pytest.param(TestDataType.NUMBER, "42.5", "42.5", id="athena-number-float"),
            pytest.param(TestDataType.DECIMAL, "99.95", "DECIMAL '99.95'", id="athena-decimal"),
            pytest.param(TestDataType.BOOLEAN, "true", "True", id="athena-boolean"),
            pytest.param(TestDataType.DATE, "2025-01-15", "DATE '2025-01-15'", id="athena-date"),
            pytest.param(
                TestDataType.DATETIME,
                "2025-01-15T10:30:00",
                "TIMESTAMP '2025-01-15 10:30:00.000'",
                id="athena-datetime",
            ),
            pytest.param(
                TestDataType.TIMESTAMP,
                "2025-01-15T10:30:00Z",
                "TIMESTAMP '2025-01-15 10:30:00.000'",
                id="athena-timestamp",
            ),
            pytest.param(TestDataType.STRING, "3.14", "'3.14'", id="athena-string-stays-quoted"),
            pytest.param(TestDataType.TIME, "10:30:00", "'10:30:00'", id="athena-time-stays-quoted-no-typeerror"),
        ],
    )
    def test_athena_pyathena_formatter_renders_unquoted_numeric_and_typed_literals(
        self, validator_class, entity_type, data_type, raw_value, expected_literal
    ):
        dialect = AthenaDialect()
        formatter = DefaultParameterFormatter()

        compiled_sql, processed = _compile_and_process_for_dialect(
            validator_class, entity_type, data_type, raw_value, dialect
        )
        rendered_sql = formatter.format(compiled_sql, {"threshold_val": processed})

        assert rendered_sql.endswith(f"> {expected_literal}")

    @pytest.mark.parametrize(
        ("validator_class", "entity_type"),
        [
            pytest.param(SQAColumnValidator, EntityType.COLUMN, id="column"),
            pytest.param(SQATableValidator, EntityType.TABLE, id="table"),
        ],
    )
    @pytest.mark.parametrize(
        ("data_type", "raw_value", "expected_trino_literal"),
        [
            pytest.param(TestDataType.FLOAT, "3.14", "DOUBLE '3.14'", id="trino-float"),
            pytest.param(TestDataType.DOUBLE, "10", "DOUBLE '10.0'", id="trino-double"),
            pytest.param(TestDataType.INT, "42", "42", id="trino-int"),
            pytest.param(TestDataType.DECIMAL, "99.95", "DECIMAL '99.95'", id="trino-decimal"),
            pytest.param(TestDataType.BOOLEAN, "false", "false", id="trino-boolean"),
            pytest.param(TestDataType.DATE, "2025-01-15", "DATE '2025-01-15'", id="trino-date"),
            pytest.param(
                TestDataType.TIMESTAMP,
                "2025-01-15T10:30:00Z",
                "TIMESTAMP '2025-01-15 10:30:00.000000 UTC'",
                id="trino-timestamp",
            ),
            pytest.param(TestDataType.STRING, "3.14", "'3.14'", id="trino-string"),
        ],
    )
    def test_trino_prepared_param_formatting(
        self, validator_class, entity_type, data_type, raw_value, expected_trino_literal
    ):
        dialect = TrinoDialect()
        cursor = TrinoCursor.__new__(TrinoCursor)

        _, processed = _compile_and_process_for_dialect(validator_class, entity_type, data_type, raw_value, dialect)
        assert cursor._format_prepared_param(processed) == expected_trino_literal

    @pytest.mark.parametrize(
        ("validator_class", "entity_type"),
        [
            pytest.param(SQAColumnValidator, EntityType.COLUMN, id="column"),
            pytest.param(SQATableValidator, EntityType.TABLE, id="table"),
        ],
    )
    @pytest.mark.parametrize(
        ("data_type", "raw_value", "expected_bq_type"),
        [
            pytest.param(TestDataType.FLOAT, "3.14", "FLOAT64", id="bq-float"),
            pytest.param(TestDataType.DOUBLE, "10", "FLOAT64", id="bq-double"),
            pytest.param(TestDataType.INT, "42", "INT64", id="bq-int"),
            pytest.param(TestDataType.NUMBER, "42", "INT64", id="bq-number-int"),
            pytest.param(TestDataType.NUMBER, "42.5", "FLOAT64", id="bq-number-float"),
            pytest.param(TestDataType.DECIMAL, "99.95", "NUMERIC", id="bq-decimal"),
            pytest.param(TestDataType.BOOLEAN, "true", "BOOL", id="bq-boolean"),
            pytest.param(TestDataType.DATE, "2025-01-15", "DATE", id="bq-date"),
            pytest.param(TestDataType.DATETIME, "2025-01-15T10:30:00", "DATETIME", id="bq-datetime"),
            pytest.param(TestDataType.TIMESTAMP, "2025-01-15T10:30:00Z", "TIMESTAMP", id="bq-timestamp"),
            pytest.param(TestDataType.STRING, "3.14", "STRING", id="bq-string"),
        ],
    )
    def test_bigquery_scalar_query_parameter_types(
        self, validator_class, entity_type, data_type, raw_value, expected_bq_type
    ):
        dialect = BigQueryDialect()
        _, processed = _compile_and_process_for_dialect(validator_class, entity_type, data_type, raw_value, dialect)
        param = bigquery_helpers.scalar_to_query_parameter(processed, name="threshold_val")

        assert param.type_ == expected_bq_type

    @pytest.mark.parametrize(
        ("validator_class", "entity_type"),
        [
            pytest.param(SQAColumnValidator, EntityType.COLUMN, id="column"),
            pytest.param(SQATableValidator, EntityType.TABLE, id="table"),
        ],
    )
    @pytest.mark.parametrize(
        ("data_type", "raw_value", "expected_param_cls"),
        [
            pytest.param(TestDataType.FLOAT, "3.14", DoubleParameter, id="databricks-float"),
            pytest.param(TestDataType.DOUBLE, "10", DoubleParameter, id="databricks-double"),
            pytest.param(TestDataType.INT, "42", IntegerParameter, id="databricks-int"),
            pytest.param(TestDataType.DECIMAL, "99.95", DecimalParameter, id="databricks-decimal"),
            pytest.param(TestDataType.BOOLEAN, "true", BooleanParameter, id="databricks-boolean"),
            pytest.param(TestDataType.DATE, "2025-01-15", DateParameter, id="databricks-date"),
            pytest.param(TestDataType.TIMESTAMP, "2025-01-15T10:30:00Z", TimestampParameter, id="databricks-timestamp"),
            pytest.param(TestDataType.TIME, "10:30:00", StringParameter, id="databricks-time-stays-string"),
            pytest.param(TestDataType.STRING, "3.14", StringParameter, id="databricks-string"),
        ],
    )
    def test_databricks_native_parameter_types(
        self, validator_class, entity_type, data_type, raw_value, expected_param_cls
    ):
        dialect = DatabricksDialect()
        _, processed = _compile_and_process_for_dialect(validator_class, entity_type, data_type, raw_value, dialect)
        param = dbsql_parameter_from_primitive(processed, name="threshold_val")

        assert isinstance(param, expected_param_cls)

    @pytest.mark.parametrize(
        ("data_type", "raw_value", "expected_pg_quoted"),
        [
            pytest.param(TestDataType.FLOAT, "3.14", b"3.14", id="postgres-float"),
            pytest.param(TestDataType.DOUBLE, "10", b"10.0", id="postgres-double"),
            pytest.param(TestDataType.INT, "42", b"42", id="postgres-int"),
            pytest.param(TestDataType.BOOLEAN, "true", b"true", id="postgres-boolean"),
            pytest.param(TestDataType.STRING, "3.14", b"'3.14'", id="postgres-string"),
        ],
    )
    def test_postgres_psycopg2_adaptation(self, data_type, raw_value, expected_pg_quoted):
        dialect = PGDialect_psycopg2()
        _, processed = _compile_and_process_for_dialect(
            SQAColumnValidator, EntityType.COLUMN, data_type, raw_value, dialect
        )
        assert psycopg2.extensions.adapt(processed).getquoted() == expected_pg_quoted

    @pytest.mark.parametrize(
        ("data_type", "raw_value", "expected_mysql_literal"),
        [
            pytest.param(TestDataType.FLOAT, "3.14", "3.14e0", id="mysql-float"),
            pytest.param(TestDataType.DOUBLE, "10", "10.0e0", id="mysql-double"),
            pytest.param(TestDataType.INT, "42", "42", id="mysql-int"),
            pytest.param(TestDataType.DECIMAL, "99.95", "99.95", id="mysql-decimal"),
            pytest.param(TestDataType.STRING, "3.14", "'3.14'", id="mysql-string"),
        ],
    )
    def test_mysql_pymysql_escaping(self, data_type, raw_value, expected_mysql_literal):
        dialect = MySQLDialect_pymysql()
        _, processed = _compile_and_process_for_dialect(
            SQAColumnValidator, EntityType.COLUMN, data_type, raw_value, dialect
        )
        assert pymysql.converters.escape_item(processed, "utf8mb4") == expected_mysql_literal

    @pytest.mark.parametrize(
        ("dialect_name", "dialect"),
        [
            pytest.param("sqlite", sqlite.dialect(), id="sqlite"),
            pytest.param("postgres", PGDialect_psycopg2(), id="postgres"),
            pytest.param("mysql", MySQLDialect_pymysql(), id="mysql"),
            pytest.param("oracle", OracleDialect_oracledb(), id="oracle"),
            pytest.param("clickhouse", ClickHouseDialect_http(), id="clickhouse"),
            pytest.param("athena", AthenaDialect(), id="athena"),
            pytest.param("trino", TrinoDialect(), id="trino"),
            pytest.param("bigquery", BigQueryDialect(), id="bigquery"),
            pytest.param("databricks", DatabricksDialect(), id="databricks"),
        ],
    )
    @pytest.mark.parametrize(
        ("data_type", "raw_value"),
        [
            pytest.param(TestDataType.FLOAT, "3.14", id="float"),
            pytest.param(TestDataType.DOUBLE, "10", id="double"),
            pytest.param(TestDataType.INT, "42", id="int"),
            pytest.param(TestDataType.DECIMAL, "99.95", id="decimal"),
        ],
    )
    def test_numeric_params_never_bind_as_str_across_all_dialects(self, dialect_name, dialect, data_type, raw_value):
        _, processed = _compile_and_process_for_dialect(
            SQAColumnValidator, EntityType.COLUMN, data_type, raw_value, dialect
        )
        assert not isinstance(processed, str), f"{dialect_name} bound {data_type.value} as str: {processed!r}"
        assert isinstance(processed, (int, float, Decimal))
