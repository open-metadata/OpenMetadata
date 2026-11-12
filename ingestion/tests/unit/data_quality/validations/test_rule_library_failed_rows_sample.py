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
Failed rows sample of rule-library `sqlExpression` tests: the rows the rule already returned are kept
"""

import logging
from datetime import datetime
from uuid import uuid4

import pandas as pd
import pytest
from pandas.errors import UndefinedVariableError
from sqlalchemy import Column, Integer, LargeBinary, String, create_engine
from sqlalchemy.dialects.mysql.pymysql import MySQLDialect_pymysql
from sqlalchemy.dialects.postgresql.psycopg2 import PGDialect_psycopg2
from sqlalchemy.dialects.sqlite.pysqlite import SQLiteDialect_pysqlite
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker

from metadata.data_quality.api.models import TestCaseResultResponse
from metadata.data_quality.validations.column.pandas.columnRuleLibrarySqlExpressionValidator import (
    ColumnRuleLibrarySqlExpressionValidator as PandasColumnValidator,
)
from metadata.data_quality.validations.column.sqlalchemy.columnRuleLibrarySqlExpressionValidator import (
    ColumnRuleLibrarySqlExpressionValidator as SQAColumnValidator,
)
from metadata.data_quality.validations.mixins.failed_row_sampler_mixin import (
    FAILED_ROW_SAMPLE_SIZE,
    render_literal_sql,
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
    TestDefinition,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.profiler.orm.types.custom_hex_byte_string import HexByteString
from metadata.profiler.processor.runner import PandasRunner, QueryRunner
from metadata.utils.logger import Loggers

EXECUTION_DATE = int(datetime(2021, 7, 3).timestamp() * 1000)
COLUMN_LINK = "<#E::table::service.db.main.orders::columns::amount>"
TABLE_LINK = "<#E::table::service.db.main.orders>"
TOTAL_ROWS = 10
NEGATIVE_ROWS = 3

THRESHOLD_PARAMETERS = [
    TestCaseParameterDefinition(name="threshold", dataType="NUMBER"),
    TestCaseParameterDefinition(name="thresholdUnit", dataType="STRING"),
]

Base = declarative_base()


class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True)
    amount = Column(Integer)
    status = Column(String(16))


BinaryBase = declarative_base()
BINARY_VALUE = b"\x89PNG\xff\x00"


class Attachment(BinaryBase):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True)
    amount = Column(Integer)
    payload = Column(LargeBinary)


def order_rows(total: int = TOTAL_ROWS, negative: int = NEGATIVE_ROWS) -> list[dict]:
    return [{"id": i, "amount": -i if i <= negative else i, "status": "ok"} for i in range(1, total + 1)]


def query_runner(rows: list[dict], model=Order) -> QueryRunner:
    engine = create_engine("sqlite://")
    model.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    session.add_all(model(**row) for row in rows)
    session.commit()
    return QueryRunner(session=session, dataset=model, raw_dataset=model)


def pandas_runner(chunks: list[pd.DataFrame]) -> PandasRunner:
    return PandasRunner(dataset=lambda: iter(chunks), raw_dataset=lambda: iter(chunks))


def build_test_case(
    entity_link: str,
    expression: str,
    entity_type: EntityType,
    values: list[TestCaseParameterValue] | None = None,
    compute_row_count: bool | None = True,
) -> TestCase:
    test_definition = TestDefinition(
        id=uuid4(),
        name="noNegativeAmounts",
        description="Amounts must not be negative",
        entityType=entity_type,
        testPlatforms=["OpenMetadata"],
        parameterDefinition=THRESHOLD_PARAMETERS,
        sqlExpression=expression,
    )  # type: ignore
    runtime_params = RuleLibrarySqlExpressionRuntimeParameters(
        conn_config=DatabaseConnection(
            config=SQLiteConnection(scheme=SQLiteScheme.sqlite_pysqlite, databaseMode=":memory:")  # type: ignore
        ),
        test_definition=test_definition,
    )
    return TestCase(
        name="no_negative_amounts",
        entityLink=entity_link,
        testSuite=EntityReference(id=uuid4(), type="TestSuite"),  # type: ignore
        testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),  # type: ignore
        computePassedFailedRowCount=compute_row_count,
        parameterValues=[
            *(values or []),
            TestCaseParameterValue(
                name=RuleLibrarySqlExpressionRuntimeParameters.__name__, value=runtime_params.model_dump_json()
            ),
        ],
    )  # type: ignore


def run_with_samples(validator_class, runner, test_case: TestCase) -> TestCaseResultResponse:
    """What the test suite interface does: run the validation, then collect its failed rows sample"""
    validator = validator_class(runner, test_case, EXECUTION_DATE)
    response = TestCaseResultResponse(testCaseResult=validator.run_validation(), testCase=test_case)
    validator.result_with_failed_samples(response)
    return response


SQA_VARIANTS = [
    pytest.param(
        SQAColumnValidator,
        COLUMN_LINK,
        "SELECT * FROM {{ table_name }} WHERE {{ column_name }} < 0",
        EntityType.COLUMN,
        id="column",
    ),
    pytest.param(
        SQATableValidator, TABLE_LINK, "SELECT * FROM {{ table_name }} WHERE amount < 0", EntityType.TABLE, id="table"
    ),
]
VARIANT_PARAMS = ("validator_class", "entity_link", "expression", "entity_type")
RULE_SQL = "SELECT * FROM main.orders WHERE amount < 0"

PANDAS_VARIANTS = [
    pytest.param(PandasColumnValidator, COLUMN_LINK, "{{ column_name }} < 0", EntityType.COLUMN, id="column"),
    pytest.param(PandasTableValidator, TABLE_LINK, "amount < 0", EntityType.TABLE, id="table"),
]


class TestSQARuleLibraryFailedRowsSample:
    @pytest.mark.parametrize(VARIANT_PARAMS, SQA_VARIANTS)
    def test_failed_run_stores_the_rows_it_counted(self, validator_class, entity_link, expression, entity_type):
        response = run_with_samples(
            validator_class, query_runner(order_rows()), build_test_case(entity_link, expression, entity_type)
        )

        assert response.testCaseResult.testCaseStatus == TestCaseStatus.Failed
        assert response.testCaseResult.failedRows == NEGATIVE_ROWS
        assert response.failedRowsSample is not None
        assert [column.root for column in response.failedRowsSample.columns] == ["id", "amount", "status"]
        assert response.failedRowsSample.rows == [[1, -1, "ok"], [2, -2, "ok"], [3, -3, "ok"]]
        assert response.inspectionQuery == RULE_SQL
        assert response.validateColumns is True

    @pytest.mark.parametrize(VARIANT_PARAMS, SQA_VARIANTS)
    def test_sample_is_capped_while_the_count_is_not(self, validator_class, entity_link, expression, entity_type):
        negative = FAILED_ROW_SAMPLE_SIZE + 10
        response = run_with_samples(
            validator_class,
            query_runner(order_rows(total=negative + 5, negative=negative)),
            build_test_case(entity_link, expression, entity_type),
        )

        assert response.testCaseResult.failedRows == negative
        assert response.failedRowsSample is not None
        assert response.failedRowsSample.rows == [[i, -i, "ok"] for i in range(1, FAILED_ROW_SAMPLE_SIZE + 1)]

    @pytest.mark.parametrize(VARIANT_PARAMS, SQA_VARIANTS)
    def test_success_within_threshold_stores_the_sample(self, validator_class, entity_link, expression, entity_type):
        threshold = [
            TestCaseParameterValue(name="threshold", value=str(NEGATIVE_ROWS)),
            TestCaseParameterValue(name="thresholdUnit", value="ABSOLUTE"),
        ]
        response = run_with_samples(
            validator_class,
            query_runner(order_rows()),
            build_test_case(entity_link, expression, entity_type, threshold),
        )

        assert response.testCaseResult.testCaseStatus == TestCaseStatus.Success
        assert response.failedRowsSample is not None
        assert len(response.failedRowsSample.rows) == NEGATIVE_ROWS
        assert response.inspectionQuery == RULE_SQL

    @pytest.mark.parametrize(VARIANT_PARAMS, SQA_VARIANTS)
    def test_clean_pass_stores_nothing(self, validator_class, entity_link, expression, entity_type):
        response = run_with_samples(
            validator_class, query_runner(order_rows(negative=0)), build_test_case(entity_link, expression, entity_type)
        )

        assert response.testCaseResult.testCaseStatus == TestCaseStatus.Success
        assert response.failedRowsSample is None
        assert response.inspectionQuery is None

    @pytest.mark.parametrize("compute_row_count", [False, None])
    @pytest.mark.parametrize(VARIANT_PARAMS, SQA_VARIANTS)
    def test_no_sample_without_row_count_consent(
        self, validator_class, entity_link, expression, entity_type, compute_row_count
    ):
        response = run_with_samples(
            validator_class,
            query_runner(order_rows()),
            build_test_case(entity_link, expression, entity_type, compute_row_count=compute_row_count),
        )

        assert response.testCaseResult.testCaseStatus == TestCaseStatus.Failed
        assert response.failedRowsSample is None

    @pytest.mark.parametrize(
        "expression",
        [
            pytest.param(
                "SELECT status, COUNT(*) AS violations FROM {{ table_name }} WHERE amount < 0 GROUP BY status",
                id="aggregate",
            ),
            pytest.param("SELECT id, status AS id_number FROM {{ table_name }} WHERE amount < 0", id="alias"),
        ],
    )
    def test_output_that_is_not_the_tables_columns_is_not_sampled(self, expression, caplog):
        caplog.set_level(logging.INFO, logger=Loggers.TEST_SUITE.value)
        response = run_with_samples(
            SQATableValidator, query_runner(order_rows()), build_test_case(TABLE_LINK, expression, EntityType.TABLE)
        )

        assert response.testCaseResult.testCaseStatus == TestCaseStatus.Failed
        assert response.failedRowsSample is None
        assert response.inspectionQuery == expression.replace("{{ table_name }}", "main.orders")
        assert "is not stored as a failed rows sample" in caplog.text

    @pytest.mark.parametrize(VARIANT_PARAMS, SQA_VARIANTS)
    def test_binary_values_are_stored_as_text(self, validator_class, entity_link, expression, entity_type):
        # Drivers return a binary column as bytes or memoryview, which the sample's JSON cannot hold
        rows = [{"id": 1, "amount": -1, "payload": BINARY_VALUE}, {"id": 2, "amount": 1, "payload": b"ok"}]

        response = run_with_samples(
            validator_class, query_runner(rows, Attachment), build_test_case(entity_link, expression, entity_type)
        )

        assert response.failedRowsSample is not None
        assert response.failedRowsSample.rows == [[1, -1, HexByteString().process_result_value(BINARY_VALUE, None)]]
        response.failedRowsSample.model_dump_json()

    def test_output_columns_match_the_table_case_insensitively(self):
        # SQLite reports a plain column under its declared name, so the aliases stand in for an engine
        # whose driver reports names in upper case
        response = run_with_samples(
            SQATableValidator,
            query_runner(order_rows()),
            build_test_case(
                TABLE_LINK, "SELECT id AS ID, amount AS Amount FROM {{ table_name }} WHERE amount < 0", EntityType.TABLE
            ),
        )

        assert response.failedRowsSample is not None
        assert [column.root for column in response.failedRowsSample.columns] == ["ID", "Amount"]
        assert response.failedRowsSample.rows == [[1, -1], [2, -2], [3, -3]]

    def test_inspection_query_renders_the_parameters_it_ran_with(self):
        values = [
            TestCaseParameterValue(name="maxAmount", value="0"),
            TestCaseParameterValue(name="threshold", value="1"),
            TestCaseParameterValue(name="thresholdUnit", value="ABSOLUTE"),
        ]
        response = run_with_samples(
            SQAColumnValidator,
            query_runner(order_rows()),
            build_test_case(
                COLUMN_LINK,
                "SELECT * FROM {{ table_name }} WHERE {{ column_name }} < {{ maxAmount }}",
                EntityType.COLUMN,
                values,
            ),
        )

        assert response.testCaseResult.testCaseStatus == TestCaseStatus.Failed
        assert response.failedRowsSample is not None
        assert len(response.failedRowsSample.rows) == NEGATIVE_ROWS
        assert response.inspectionQuery == "SELECT * FROM main.orders WHERE amount < '0'"

    @pytest.mark.parametrize(
        ("failing_expression", "error", "message"),
        [
            pytest.param(
                "DELETE FROM {{ table_name }} WHERE amount < 0", RuntimeError, "SQL expression is not safe", id="unsafe"
            ),
            pytest.param(
                "SELECT * FROM {{ table_name }} WHERE missing < 0", OperationalError, "no such column", id="query-error"
            ),
        ],
    )
    @pytest.mark.parametrize(VARIANT_PARAMS, SQA_VARIANTS)
    def test_a_rule_that_cannot_run_keeps_no_sample(
        self, validator_class, entity_link, expression, entity_type, failing_expression, error, message
    ):
        test_case = build_test_case(entity_link, failing_expression, entity_type)
        validator = validator_class(query_runner(order_rows()), test_case, EXECUTION_DATE)

        with pytest.raises(error, match=message):
            validator.run_validation()

        assert validator.fetch_failed_rows_sample() is None


@pytest.mark.parametrize(
    "dialect",
    [
        pytest.param(PGDialect_psycopg2(), id="postgres"),
        pytest.param(MySQLDialect_pymysql(), id="mysql"),
        pytest.param(SQLiteDialect_pysqlite(), id="sqlite"),
    ],
)
def test_inspection_query_shows_percent_signs_as_written(dialect):
    rendered = render_literal_sql(
        "SELECT * FROM orders WHERE status LIKE 'o%' AND note = :note", {"note": "50%", "threshold": "1"}, dialect
    )

    assert rendered == "SELECT * FROM orders WHERE status LIKE 'o%' AND note = '50%'"


class TestPandasRuleLibraryFailedRowsSample:
    @pytest.mark.parametrize(VARIANT_PARAMS, PANDAS_VARIANTS)
    def test_sample_spans_chunks_and_is_capped(self, validator_class, entity_link, expression, entity_type):
        negative = FAILED_ROW_SAMPLE_SIZE + 10
        rows = pd.DataFrame(order_rows(total=negative + 20, negative=negative))
        chunks = [rows.iloc[:30], rows.iloc[30:60], rows.iloc[60:]]

        response = run_with_samples(
            validator_class, pandas_runner(chunks), build_test_case(entity_link, expression, entity_type)
        )

        assert response.testCaseResult.failedRows == negative
        assert response.testCaseResult.passedRows == 20
        assert response.failedRowsSample is not None
        assert [column.root for column in response.failedRowsSample.columns] == ["id", "amount", "status"]
        assert response.failedRowsSample.rows == [[i, -i, "ok"] for i in range(1, FAILED_ROW_SAMPLE_SIZE + 1)]
        assert response.inspectionQuery is None

    @pytest.mark.parametrize(VARIANT_PARAMS, PANDAS_VARIANTS)
    def test_integers_stay_exact_in_an_all_numeric_frame(self, validator_class, entity_link, expression, entity_type):
        large = 2**53 + 1
        frame = pd.DataFrame({"id": [large, 7], "amount": [-1.5, 2.0]})

        response = run_with_samples(
            validator_class, pandas_runner([frame]), build_test_case(entity_link, expression, entity_type)
        )

        assert response.failedRowsSample is not None
        assert response.failedRowsSample.rows == [[large, -1.5]]
        assert type(response.failedRowsSample.rows[0][0]) is int

    @pytest.mark.parametrize(VARIANT_PARAMS, PANDAS_VARIANTS)
    def test_binary_values_are_stored_as_text(self, validator_class, entity_link, expression, entity_type):
        frame = pd.DataFrame({"amount": [-1, 1], "payload": [BINARY_VALUE, b"ok"]})

        response = run_with_samples(
            validator_class, pandas_runner([frame]), build_test_case(entity_link, expression, entity_type)
        )

        assert response.failedRowsSample is not None
        assert response.failedRowsSample.rows == [[-1, HexByteString().process_result_value(BINARY_VALUE, None)]]
        response.failedRowsSample.model_dump_json()

    @pytest.mark.parametrize(VARIANT_PARAMS, PANDAS_VARIANTS)
    def test_missing_values_become_none(self, validator_class, entity_link, expression, entity_type):
        frame = pd.DataFrame(
            {
                "amount": [-1, -2],
                "score": [float("nan"), 0.5],
                "status": [None, "ok"],
                "seen": [pd.NaT, pd.Timestamp("2021-07-03")],
            }
        )

        response = run_with_samples(
            validator_class, pandas_runner([frame]), build_test_case(entity_link, expression, entity_type)
        )

        assert response.failedRowsSample is not None
        assert response.failedRowsSample.rows == [
            [-1, None, None, None],
            [-2, 0.5, "ok", pd.Timestamp("2021-07-03")],
        ]

    @pytest.mark.parametrize(VARIANT_PARAMS, PANDAS_VARIANTS)
    def test_clean_pass_stores_nothing(self, validator_class, entity_link, expression, entity_type):
        frame = pd.DataFrame(order_rows(negative=0))

        response = run_with_samples(
            validator_class, pandas_runner([frame]), build_test_case(entity_link, expression, entity_type)
        )

        assert response.testCaseResult.testCaseStatus == TestCaseStatus.Success
        assert response.failedRowsSample is None

    @pytest.mark.parametrize(VARIANT_PARAMS, PANDAS_VARIANTS)
    def test_a_rule_that_cannot_run_keeps_no_sample(self, validator_class, entity_link, expression, entity_type):
        test_case = build_test_case(entity_link, "missing < 0", entity_type)
        validator = validator_class(pandas_runner([pd.DataFrame(order_rows())]), test_case, EXECUTION_DATE)

        with pytest.raises(UndefinedVariableError, match="missing"):
            validator.run_validation()

        assert validator.fetch_failed_rows_sample() is None
