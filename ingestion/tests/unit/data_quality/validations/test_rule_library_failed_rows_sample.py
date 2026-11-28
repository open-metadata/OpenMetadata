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

import json
import logging
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Thread
from typing import ClassVar
from unittest.mock import patch
from urllib.parse import parse_qs, unquote, urlsplit
from uuid import uuid4

import pandas as pd
import pytest
import requests
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
    table_columns_sample,
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
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import OpenMetadataConnection
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
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.sink.metadata_rest import MetadataRestSink, MetadataRestSinkConfig
from metadata.profiler.orm.types.custom_hex_byte_string import HexByteString
from metadata.profiler.processor.runner import PandasRunner, QueryRunner
from metadata.utils.helpers import is_safe_sql_query
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
    __table_args__: ClassVar[dict] = {"schema": "main"}
    id = Column(Integer, primary_key=True)
    amount = Column(Integer)
    status = Column(String(16))


BinaryBase = declarative_base()
BINARY_VALUE = b"\x89PNG\xff\x00"


class Attachment(BinaryBase):
    __tablename__ = "orders"
    __table_args__: ClassVar[dict] = {"schema": "main"}
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
    parameter_definitions: list[TestCaseParameterDefinition] | None = None,
) -> TestCase:
    test_definition = TestDefinition(
        id=uuid4(),
        name="noNegativeAmounts",
        description="Amounts must not be negative",
        entityType=entity_type,
        testPlatforms=["OpenMetadata"],
        parameterDefinition=[*THRESHOLD_PARAMETERS, *(parameter_definitions or [])],
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


def run_with_samples(validator_class, runner, test_case: TestCase, *, collect_samples=True) -> TestCaseResultResponse:
    """Run the validation, then collect failed rows when sample storage is enabled."""
    validator = validator_class(runner, test_case, EXECUTION_DATE)
    response = TestCaseResultResponse(testCaseResult=validator.run_validation(), testCase=test_case)
    if collect_samples:
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


def sample_api_request_status(path: str, expected: str, sample_upload: bool) -> int:
    request = urlsplit(path)
    if unquote(request.path) != expected:
        return 404
    query = parse_qs(request.query, keep_blank_values=True)
    allowed_query = {"validate": ["true"]} if sample_upload else {}
    return 200 if query in ({}, allowed_query) else 400


@pytest.fixture
def sample_api():
    """A stateful HTTP boundary using the existing server endpoint shapes."""
    state = {"sample": None, "query": None, "result": None, "delete_status": 200, "events": []}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def respond(self, code, payload):
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(payload).encode())

        def matches_route(self, suffix, *, sample_upload=False):
            status = sample_api_request_status(self.path, f"/v1/dataQuality/testCases/{suffix}", sample_upload)
            if status != 200:
                self.respond(status, {"code": status, "message": "unsupported route, identity or column validation"})
                return False
            return True

        def do_POST(self):
            if not self.matches_route(f"testCaseResults/{state['case']['fullyQualifiedName']}"):
                return
            state["events"].append("result")
            state["result"] = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            self.respond(200, state["result"])

        def do_PUT(self):
            sample_upload = urlsplit(self.path).path.endswith("/failedRowsSample")
            endpoint = "failedRowsSample" if sample_upload else "inspectionQuery"
            if not self.matches_route(f"{state['case']['id']}/{endpoint}", sample_upload=sample_upload):
                return
            body = self.rfile.read(int(self.headers["Content-Length"]))
            if sample_upload:
                state["events"].append("sample")
                state["sample"] = json.loads(body)
                self.respond(200, {"failedRowsSample": state["sample"]})
            else:
                state["events"].append("query")
                state["query"] = body.decode()
                self.respond(200, state["case"])

        def do_DELETE(self):
            if not self.matches_route(f"{state['case']['id']}/failedRowsSample"):
                return
            state["events"].append("delete")
            code = state["delete_status"]
            if code == 200:
                state["sample"] = None
            self.respond(code, {} if code == 200 else {"code": code, "message": "delete failed"})

        def do_GET(self):
            if not self.matches_route(f"{state['case']['id']}/failedRowsSample"):
                return
            self.respond(200 if state["sample"] else 404, state["sample"] or {"code": 404, "message": "absent"})

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    metadata = OpenMetadata(
        OpenMetadataConnection(
            hostPort=f"http://127.0.0.1:{server.server_port}",
            authProvider="openmetadata",
            securityConfig={"jwtToken": "test-token"},
            enableVersionValidation=False,
        )
    )
    yield metadata, state
    metadata.close()
    server.shutdown()
    server.server_close()
    thread.join()


@pytest.mark.parametrize(
    ("method", "route", "expected_status"),
    [
        ("GET", "{case_id}/unknown", 404),
        ("DELETE", "{case_id}/unknown", 404),
        ("PUT", "{case_id}/unknown", 404),
        ("POST", "unknown/{case_fqn}", 404),
        ("GET", "{wrong_id}/failedRowsSample", 404),
        ("DELETE", "{wrong_id}/failedRowsSample", 404),
        ("PUT", "{wrong_id}/failedRowsSample", 404),
        ("PUT", "{wrong_id}/inspectionQuery", 404),
        ("POST", "testCaseResults/wrong.case", 404),
        ("PUT", "{case_id}/failedRowsSample?validate=false", 400),
    ],
)
def test_sample_api_rejects_invalid_requests_without_state_changes(sample_api, method, route, expected_status):
    metadata, state = sample_api
    case_id = str(uuid4())
    case_fqn = "service.db.main.orders.no_negative_amounts"
    state.update(
        case={"id": case_id, "fullyQualifiedName": case_fqn},
        sample={"columns": ["amount"], "rows": [[-1]]},
        query=RULE_SQL,
        result={"failedRows": NEGATIVE_ROWS},
    )
    before = json.loads(json.dumps(state))
    route = route.format(case_id=case_id, case_fqn=case_fqn, wrong_id=uuid4())
    response = requests.request(
        method,
        f"{metadata.config.hostPort}/v1/dataQuality/testCases/{route}",
        json={"columns": ["amount"], "rows": [[-2]]},
        timeout=5,
    )
    assert response.status_code == expected_status
    assert state == before


def test_delete_sample_without_persisted_case_preserves_http_state(sample_api):
    metadata, state = sample_api
    case = build_test_case(TABLE_LINK, RULE_SQL, EntityType.TABLE)
    state["sample"] = {"columns": ["amount"], "rows": [[-1]]}
    before = json.loads(json.dumps(state))
    with pytest.raises(ValueError, match="persisted test case"):
        metadata.delete_failed_rows_sample(case)
    assert state == before


@pytest.mark.parametrize(VARIANT_PARAMS, SQA_VARIANTS)
def test_unsupported_run_removes_preceding_sample_over_http(
    sample_api, validator_class, entity_link, expression, entity_type
):
    metadata, state = sample_api
    case = build_test_case(entity_link, expression, entity_type)
    case = TestCase.model_validate(
        {**case.model_dump(), "id": uuid4(), "fullyQualifiedName": "service.db.main.orders.no_negative_amounts"}
    )
    state["case"] = json.loads(case.model_dump_json())
    sink = MetadataRestSink(MetadataRestSinkConfig(), metadata)
    runner = query_runner(order_rows())
    sink.write_test_case_results(run_with_samples(validator_class, runner, case))
    assert metadata.get_failed_rows_sample(case).rows == [[1, -1, "ok"], [2, -2, "ok"], [3, -3, "ok"]]

    unsupported = build_test_case(
        entity_link, "SELECT amount AS status FROM {{ table_name }} WHERE amount < 0", entity_type
    )
    unsupported.id = case.id
    unsupported.fullyQualifiedName = case.fullyQualifiedName
    sink.write_test_case_results(run_with_samples(validator_class, runner, unsupported))

    assert metadata.get_failed_rows_sample(case) is None
    assert state["sample"] is None
    assert state["result"]["failedRows"] == NEGATIVE_ROWS
    assert state["query"] == "SELECT amount AS status FROM main.orders WHERE amount < 0"
    assert state["events"] == ["result", "sample", "query", "result", "delete", "query"]


@pytest.mark.parametrize("mode", ["disabled", "fetch-error"])
def test_missing_sample_without_clear_intent_preserves_persisted_sample(sample_api, mode):
    metadata, state = sample_api
    case = TestCase.model_validate(
        {
            **build_test_case(
                TABLE_LINK, "SELECT * FROM {{ table_name }} WHERE amount < 0", EntityType.TABLE
            ).model_dump(),
            "id": uuid4(),
            "fullyQualifiedName": "service.db.main.orders.no_negative_amounts",
        }
    )
    state["case"] = json.loads(case.model_dump_json())
    sink = MetadataRestSink(MetadataRestSinkConfig(), metadata)
    runner = query_runner(order_rows())
    sink.write_test_case_results(run_with_samples(SQATableValidator, runner, case))
    original = metadata.get_failed_rows_sample(case)
    if mode == "disabled":
        case.computePassedFailedRowCount = False
        response = run_with_samples(SQATableValidator, runner, case)
    else:
        with patch.object(SQATableValidator, "fetch_failed_rows_sample", side_effect=RuntimeError("unavailable")):
            response = run_with_samples(SQATableValidator, runner, case)
    assert response.clearFailedRowsSample is False
    sink.write_test_case_results(response)
    assert metadata.get_failed_rows_sample(case) == original


@pytest.mark.parametrize("delete_status", [404, 403])
def test_delete_boundary_errors_preserve_results_and_inspection_query(sample_api, delete_status, caplog):
    metadata, state = sample_api
    case = TestCase.model_validate(
        {
            **build_test_case(
                TABLE_LINK, "SELECT amount AS status FROM {{ table_name }} WHERE amount < 0", EntityType.TABLE
            ).model_dump(),
            "id": uuid4(),
            "fullyQualifiedName": "service.db.main.orders.no_negative_amounts",
        }
    )
    state["case"] = json.loads(case.model_dump_json())
    state["delete_status"] = delete_status
    response = run_with_samples(SQATableValidator, query_runner(order_rows()), case)
    MetadataRestSink(MetadataRestSinkConfig(), metadata).write_test_case_results(response)
    assert state["result"]["failedRows"] == NEGATIVE_ROWS
    assert state["query"] == response.inspectionQuery
    assert state["events"] == ["result", "delete", "query"]
    if delete_status == 403:
        assert "Failed to clear failed rows sample" in caplog.text
        with pytest.raises(APIError):
            metadata.delete_failed_rows_sample(case)
    else:
        metadata.delete_failed_rows_sample(case)


@pytest.mark.parametrize(VARIANT_PARAMS, SQA_VARIANTS)
@pytest.mark.parametrize(
    ("data_type", "raw_value", "condition", "rendered_condition"),
    [
        (TestDataType.INT, "0", "amount < {{ cutoff }}", "amount < 0"),
        (TestDataType.DECIMAL, "0.0", "amount < {{ cutoff }}", "amount < 0.0"),
        (TestDataType.BOOLEAN, "true", "amount < 0 AND {{ cutoff }} = TRUE", "amount < 0 AND 1 = TRUE"),
        (
            TestDataType.DATE,
            "2025-01-15",
            "amount < 0 AND {{ cutoff }} = date('2025-01-15')",
            "amount < 0 AND '2025-01-15' = date('2025-01-15')",
        ),
        (
            TestDataType.DATETIME,
            "2025-01-15T10:30:00",
            "amount < 0 AND datetime({{ cutoff }}) = '2025-01-15 10:30:00'",
            "amount < 0 AND datetime('2025-01-15 10:30:00.000000') = '2025-01-15 10:30:00'",
        ),
    ],
)
def test_typed_parameters_preserve_counts_samples_and_inspection_sql(
    validator_class, entity_link, expression, entity_type, data_type, raw_value, condition, rendered_condition
):
    case = build_test_case(
        entity_link,
        "SELECT * FROM {{ table_name }} WHERE " + condition,
        entity_type,
        values=[TestCaseParameterValue(name="cutoff", value=raw_value)],
        parameter_definitions=[TestCaseParameterDefinition(name="cutoff", dataType=data_type)],
    )
    response = run_with_samples(validator_class, query_runner(order_rows()), case)
    assert response.testCaseResult.testCaseStatus == TestCaseStatus.Failed
    assert response.testCaseResult.failedRows == NEGATIVE_ROWS
    assert response.testCaseResult.passedRows == TOTAL_ROWS - NEGATIVE_ROWS
    assert response.failedRowsSample is not None
    assert response.failedRowsSample.rows == [[1, -1, "ok"], [2, -2, "ok"], [3, -3, "ok"]]
    assert response.clearFailedRowsSample is False
    assert response.inspectionQuery == "SELECT * FROM main.orders WHERE " + rendered_condition


class TestSQARuleLibraryFailedRowsSample:
    @pytest.mark.parametrize(VARIANT_PARAMS, SQA_VARIANTS)
    @pytest.mark.parametrize(
        "unsafe_sql",
        [
            "SELECT amount AS status FROM {{ table_name }} WHERE amount < 0",
            "SELECT amount status FROM {{ table_name }} WHERE amount < 0",
            "SELECT amount + 1 AS status FROM {{ table_name }} WHERE amount < 0",
            "SELECT a.amount FROM {{ table_name }} a JOIN {{ table_name }} b ON a.id = b.id WHERE a.amount < 0",
            "WITH x AS (SELECT * FROM {{ table_name }}) SELECT * FROM x WHERE amount < 0",
            "SELECT * FROM (SELECT * FROM {{ table_name }}) x WHERE amount < 0",
            "SELECT amount FROM {{ table_name }} WHERE amount < 0 UNION ALL SELECT amount FROM {{ table_name }} WHERE 0",
            "SELECT /*!50000 amount AS */ status FROM {{ table_name }} WHERE amount < 0",
            "SELECT /*M!100100 amount AS */ status FROM {{ table_name }} WHERE amount < 0",
        ],
    )
    def test_ambiguous_source_output_preserves_result_without_sample(
        self, validator_class, entity_link, expression, entity_type, unsafe_sql
    ):
        response = run_with_samples(
            validator_class, query_runner(order_rows()), build_test_case(entity_link, unsafe_sql, entity_type)
        )
        assert response.testCaseResult.testCaseStatus == TestCaseStatus.Failed
        assert response.testCaseResult.failedRows == NEGATIVE_ROWS
        assert response.failedRowsSample is None
        assert response.clearFailedRowsSample is True
        assert response.inspectionQuery == unsafe_sql.replace("{{ table_name }}", "main.orders")

    @pytest.mark.parametrize(VARIANT_PARAMS, SQA_VARIANTS)
    @pytest.mark.parametrize(
        "safe_sql",
        [
            "SELECT * FROM {{ table_name }} WHERE amount < 0",
            "SELECT o.* FROM {{ table_name }} o WHERE amount < 0",
            "SELECT o.id, o.amount AS amount FROM {{ table_name }} AS o WHERE amount < 0",
            'SELECT "id", "amount" AS "amount" FROM {{ table_name }} WHERE amount < 0',
            "SELECT /* ordinary column documentation */ amount FROM {{ table_name }} WHERE amount < 0",
        ],
    )
    def test_direct_source_output_is_sampled(self, validator_class, entity_link, expression, entity_type, safe_sql):
        response = run_with_samples(
            validator_class, query_runner(order_rows()), build_test_case(entity_link, safe_sql, entity_type)
        )
        assert response.testCaseResult.failedRows == NEGATIVE_ROWS
        assert response.failedRowsSample is not None
        assert len(response.failedRowsSample.rows) == NEGATIVE_ROWS
        assert response.clearFailedRowsSample is False

    @pytest.mark.parametrize(VARIANT_PARAMS, SQA_VARIANTS)
    def test_sample_conversion_failure_cannot_change_count(self, validator_class, entity_link, expression, entity_type):
        with patch(
            "metadata.data_quality.validations.mixins.failed_row_sampler_mixin._sample_value",
            side_effect=ValueError("conversion"),
        ):
            response = run_with_samples(
                validator_class, query_runner(order_rows()), build_test_case(entity_link, expression, entity_type)
            )
        assert response.testCaseResult.failedRows == NEGATIVE_ROWS
        assert response.testCaseResult.testCaseStatus == TestCaseStatus.Failed
        assert response.failedRowsSample is None
        assert response.clearFailedRowsSample is False

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
        assert response.clearFailedRowsSample is False

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
        assert response.clearFailedRowsSample is False

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


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT amount FROM other.orders",
        "SELECT * EXCEPT (status) FROM main.orders",
        "SELECT * REPLACE (amount AS status) FROM main.orders",
        "SELECT amount FROM main.orders; SELECT amount FROM main.orders",
        "SELECT amount FROM main.orders PIVOT (SUM(amount) FOR status IN ('ok'))",
        "SELECT unknown.amount FROM main.orders",
    ],
)
def test_unattributable_sql_is_not_sampled(sql):
    assert (
        table_columns_sample(
            Order.__table__,
            ["amount"],
            [[-1]],
            sql=sql,
            table_reference="main.orders",
            dialect=SQLiteDialect_pysqlite(),
        )
        is None
    )


@pytest.mark.parametrize("marker", ["/*!", "/*!50000", "/*M!", "/*M!100100", "/*m!100100"])
def test_mysql_executable_comments_cannot_hide_renamed_source_values(marker):
    sql = f"SELECT {marker} amount AS */ status FROM main.orders WHERE amount < 0"
    assert is_safe_sql_query(sql)
    # MySQL/MariaDB can execute the comment's projection; SQLGlot sees only `status`.
    sample = table_columns_sample(
        Order.__table__, ["status"], [[-1]], sql=sql, table_reference="main.orders", dialect=MySQLDialect_pymysql()
    )
    assert sample is None


@pytest.mark.parametrize("backslash_escapes", [False, True, None])
def test_mysql_mode_dependent_backslash_cannot_hide_a_union(backslash_escapes):
    dialect = MySQLDialect_pymysql()
    dialect._backslash_escapes = backslash_escapes
    sql = "SELECT status FROM main.orders WHERE status = 'x\\' UNION SELECT amount FROM main.orders -- '"
    assert is_safe_sql_query(sql)
    sample = table_columns_sample(
        Order.__table__, ["status"], [[-1]], sql=sql, table_reference="main.orders", dialect=dialect
    )
    assert sample is None


@pytest.mark.parametrize(
    "dialect,reference,sql,safe",
    [
        (PGDialect_psycopg2(), '"main"."orders"', 'SELECT "amount" FROM "main"."orders"', True),
        (PGDialect_psycopg2(), '"main"."orders"', 'SELECT amount AS "Amount" FROM main.orders', False),
        (MySQLDialect_pymysql(), "`main`.`orders`", "SELECT o.`amount` FROM `main`.`orders` o", True),
        (MySQLDialect_pymysql(), "main.orders", "SELECT amount FROM main.orders WHERE amount < 3--1", False),
        (PGDialect_psycopg2(), "main.orders", "SELECT amount FROM main.orders -- exercise regular comment", True),
        (SQLiteDialect_pysqlite(), "main.orders", "SELECT amount FROM orders", False),
    ],
)
def test_source_matching_respects_execution_dialect(dialect, reference, sql, safe):
    sample = table_columns_sample(
        Order.__table__, ["amount"], [[-1]], sql=sql, table_reference=reference, dialect=dialect
    )
    assert (sample is not None) is safe


class TestPandasRuleLibraryFailedRowsSample:
    @pytest.mark.parametrize(VARIANT_PARAMS, PANDAS_VARIANTS)
    @pytest.mark.parametrize("mode", ["counts-off", "samples-off", "conversion-error"])
    def test_conversion_cannot_change_verdict(self, validator_class, entity_link, expression, entity_type, mode):
        case = build_test_case(entity_link, expression, entity_type, compute_row_count=mode != "counts-off")
        with patch(
            "metadata.data_quality.validations.mixins.failed_row_sampler_mixin._sample_value",
            side_effect=ValueError("sample value conversion failed"),
        ) as convert:
            response = run_with_samples(
                validator_class,
                pandas_runner([pd.DataFrame(order_rows())]),
                case,
                collect_samples=mode != "samples-off",
            )
        assert response.testCaseResult.testCaseStatus == TestCaseStatus.Failed
        assert response.failedRowsSample is None
        assert not response.clearFailedRowsSample
        if mode == "conversion-error":
            assert response.testCaseResult.failedRows == NEGATIVE_ROWS
            assert response.testCaseResult.passedRows == TOTAL_ROWS - NEGATIVE_ROWS
            assert convert.call_count == 1
        else:
            convert.assert_not_called()

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
