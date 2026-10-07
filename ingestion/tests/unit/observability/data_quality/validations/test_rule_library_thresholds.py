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
Failure thresholds on rule-library `sqlExpression` test definitions, column and table level.
"""

from datetime import datetime
from uuid import uuid4

import pandas as pd
import pytest
from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from metadata.data_quality.validations.column.pandas.columnRuleLibrarySqlExpressionValidator import (
    ColumnRuleLibrarySqlExpressionValidator as PandasColumnValidator,
)
from metadata.data_quality.validations.column.sqlalchemy.columnRuleLibrarySqlExpressionValidator import (
    ColumnRuleLibrarySqlExpressionValidator as SQAColumnValidator,
)
from metadata.data_quality.validations.models import (
    EvaluationScopeRuntimeParameters,
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
from metadata.generated.schema.type.basic import ProfileSampleType
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.profiler.processor.runner import PandasRunner, QueryRunner

EXECUTION_DATE = int(datetime(2021, 7, 3).timestamp() * 1000)
COLUMN_LINK = "<#E::table::service.db.main.orders::columns::amount>"
TABLE_LINK = "<#E::table::service.db.main.orders>"
TOTAL_ROWS = 10
NEGATIVE_ROWS = 3
TWENTY_PERCENT = EvaluationScopeRuntimeParameters(
    profile_sample=20.0, profile_sample_type=ProfileSampleType.PERCENTAGE, sampling_applied=True
)

COLUMN_SQL = "SELECT * FROM {{ table_name }} WHERE {{ column_name }} < 0"
TABLE_SQL = "SELECT * FROM {{ table_name }} WHERE amount < 0"
PANDAS_COLUMN_EXPRESSION = "{{ column_name }} < 0"
PANDAS_TABLE_EXPRESSION = "amount < 0"

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


class SampledOrder(Base):
    """Stands in for the sampled dataset: the rule's SQL must never read from it"""

    __tablename__ = "orders_sample"
    id = Column(Integer, primary_key=True)
    amount = Column(Integer)
    status = Column(String(16))


def order_rows():
    return [{"id": i, "amount": -i if i <= NEGATIVE_ROWS else i, "status": "ok"} for i in range(1, TOTAL_ROWS + 1)]


@pytest.fixture
def query_runner():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    session.add_all(Order(**row) for row in order_rows())
    session.add_all(SampledOrder(**row) for row in order_rows()[:2])
    session.commit()
    yield QueryRunner(session=session, dataset=SampledOrder, raw_dataset=Order.__table__)
    session.close()


@pytest.fixture
def pandas_runner():
    rows = pd.DataFrame(order_rows())
    chunks = [rows.iloc[:4], rows.iloc[4:]]
    return PandasRunner(dataset=lambda: iter(chunks), raw_dataset=lambda: iter(chunks))


def build_test_case(
    entity_link: str,
    sql_expression: str,
    entity_type: EntityType,
    threshold: str | None = None,
    unit: str | None = None,
    declares_threshold: bool = True,
    extra_definitions: list[TestCaseParameterDefinition] | None = None,
    extra_values: list[TestCaseParameterValue] | None = None,
    scope: EvaluationScopeRuntimeParameters | None = None,
) -> TestCase:
    test_definition = TestDefinition(
        id=uuid4(),
        name="noNegativeAmounts",
        description="Amounts must not be negative",
        entityType=entity_type,
        testPlatforms=["OpenMetadata"],
        parameterDefinition=(THRESHOLD_PARAMETERS if declares_threshold else []) + (extra_definitions or []),
        sqlExpression=sql_expression,
    )  # type: ignore
    runtime_params = RuleLibrarySqlExpressionRuntimeParameters(
        conn_config=DatabaseConnection(
            config=SQLiteConnection(scheme=SQLiteScheme.sqlite_pysqlite, databaseMode=":memory:")  # type: ignore
        ),
        test_definition=test_definition,
    )

    parameter_values = list(extra_values or [])
    if threshold is not None:
        parameter_values.append(TestCaseParameterValue(name="threshold", value=threshold))
    if unit is not None:
        parameter_values.append(TestCaseParameterValue(name="thresholdUnit", value=unit))
    parameter_values.append(
        TestCaseParameterValue(
            name=RuleLibrarySqlExpressionRuntimeParameters.__name__, value=runtime_params.model_dump_json()
        )
    )
    if scope is not None:
        parameter_values.append(
            TestCaseParameterValue(name=EvaluationScopeRuntimeParameters.__name__, value=scope.model_dump_json())
        )

    return TestCase(
        name="no_negative_amounts",
        entityLink=entity_link,
        testSuite=EntityReference(id=uuid4(), type="TestSuite"),  # type: ignore
        testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),  # type: ignore
        parameterValues=parameter_values,
    )  # type: ignore


VARIANTS = [
    pytest.param(SQAColumnValidator, "query_runner", COLUMN_LINK, COLUMN_SQL, EntityType.COLUMN, id="sqa-column"),
    pytest.param(SQATableValidator, "query_runner", TABLE_LINK, TABLE_SQL, EntityType.TABLE, id="sqa-table"),
    pytest.param(
        PandasColumnValidator,
        "pandas_runner",
        COLUMN_LINK,
        PANDAS_COLUMN_EXPRESSION,
        EntityType.COLUMN,
        id="pandas-column",
    ),
    pytest.param(
        PandasTableValidator, "pandas_runner", TABLE_LINK, PANDAS_TABLE_EXPRESSION, EntityType.TABLE, id="pandas-table"
    ),
]


def run(request, validator_class, runner_fixture, entity_link, expression, entity_type, **kwargs):
    test_case = build_test_case(entity_link, expression, entity_type, **kwargs)
    validator = validator_class(request.getfixturevalue(runner_fixture), test_case, EXECUTION_DATE)
    return validator.run_validation()


@pytest.mark.parametrize(("validator_class", "runner_fixture", "entity_link", "expression", "entity_type"), VARIANTS)
@pytest.mark.parametrize(
    ("threshold", "unit", "expected_status"),
    [
        pytest.param(None, None, TestCaseStatus.Failed, id="unset"),
        pytest.param("0", "ABSOLUTE", TestCaseStatus.Failed, id="zero"),
        pytest.param("2", "ABSOLUTE", TestCaseStatus.Failed, id="absolute-below"),
        pytest.param("3", "ABSOLUTE", TestCaseStatus.Success, id="absolute-at"),
        pytest.param("29", "PERCENTAGE", TestCaseStatus.Failed, id="percentage-below"),
        pytest.param("30", "PERCENTAGE", TestCaseStatus.Success, id="percentage-at"),
    ],
)
def test_threshold_tolerates_matching_rows(
    request, validator_class, runner_fixture, entity_link, expression, entity_type, threshold, unit, expected_status
):
    result = run(
        request, validator_class, runner_fixture, entity_link, expression, entity_type, threshold=threshold, unit=unit
    )

    assert result.testCaseStatus == expected_status
    assert result.testResultValue[0].value == str(NEGATIVE_ROWS)


@pytest.mark.parametrize(("validator_class", "runner_fixture", "entity_link", "expression", "entity_type"), VARIANTS)
def test_percentage_reports_the_denominator(
    request, validator_class, runner_fixture, entity_link, expression, entity_type
):
    result = run(
        request,
        validator_class,
        runner_fixture,
        entity_link,
        expression,
        entity_type,
        threshold="30",
        unit="PERCENTAGE",
    )

    assert result.failedRows == NEGATIVE_ROWS
    assert result.passedRows == TOTAL_ROWS - NEGATIVE_ROWS
    assert f"Found {NEGATIVE_ROWS} rows matching the condition out of {TOTAL_ROWS} evaluated (30.00%)" in result.result
    assert "Threshold is 30%, so this test passed." in result.result


@pytest.mark.parametrize(
    ("validator_class", "runner_fixture", "entity_link", "expression", "entity_type"),
    [variant for variant in VARIANTS if variant.id.startswith("sqa")],
)
def test_zero_threshold_passes_without_matching_rows(
    request, validator_class, runner_fixture, entity_link, expression, entity_type
):
    result = run(
        request,
        validator_class,
        runner_fixture,
        entity_link,
        expression.replace("< 0", "< -100"),
        entity_type,
        threshold="0",
        unit="ABSOLUTE",
    )

    assert result.testCaseStatus == TestCaseStatus.Success


def test_sql_denominator_counts_the_full_table_not_the_sample(request):
    """The rule's SQL reads the full table, so its denominator has to as well"""
    result = run(
        request,
        SQAColumnValidator,
        "query_runner",
        COLUMN_LINK,
        COLUMN_SQL,
        EntityType.COLUMN,
        threshold="30",
        unit="PERCENTAGE",
        scope=TWENTY_PERCENT,
    )

    assert f"out of {TOTAL_ROWS} evaluated" in result.result
    assert "Evaluated on the full table." in result.result
    assert "the configured sample did not apply to it" in result.result


def test_pandas_expression_states_the_sample_it_ran_on(request):
    """The pandas expression runs on the sampled dataframes, so it must not claim the full table"""
    result = run(
        request,
        PandasColumnValidator,
        "pandas_runner",
        COLUMN_LINK,
        PANDAS_COLUMN_EXPRESSION,
        EntityType.COLUMN,
        threshold="30",
        unit="PERCENTAGE",
        scope=TWENTY_PERCENT,
    )

    assert "full table" not in result.result
    assert "sample" in result.result


@pytest.mark.parametrize(("validator_class", "runner_fixture", "entity_link", "expression", "entity_type"), VARIANTS)
def test_full_table_scope_is_stated(request, validator_class, runner_fixture, entity_link, expression, entity_type):
    result = run(request, validator_class, runner_fixture, entity_link, expression, entity_type)

    assert result.result.endswith("Evaluated on the full table.")


def test_threshold_is_a_template_parameter_when_the_definition_does_not_opt_in(request):
    """A custom definition may already use `threshold` in its own SQL; that must not turn into a tolerance"""
    result = run(
        request,
        SQATableValidator,
        "query_runner",
        TABLE_LINK,
        "SELECT * FROM {{ table_name }} WHERE amount < {{ threshold }}",
        EntityType.TABLE,
        declares_threshold=False,
        extra_definitions=[TestCaseParameterDefinition(name="threshold", dataType="INT")],
        extra_values=[TestCaseParameterValue(name="threshold", value="5")],
    )

    assert result.testCaseStatus == TestCaseStatus.Failed
    assert result.testResultValue[0].value == "4"
    assert "Threshold is no tolerance" in result.result


def test_absolute_threshold_does_not_count_the_table(request, query_runner):
    """The denominator is only paid for when the verdict or the row split reads it"""
    test_case = build_test_case(TABLE_LINK, TABLE_SQL, EntityType.TABLE, threshold="3", unit="ABSOLUTE")
    validator = SQATableValidator(query_runner, test_case, EXECUTION_DATE)

    result = validator.run_validation()

    assert result.testCaseStatus == TestCaseStatus.Success
    assert result.failedRows is None
    assert "an uncounted population" in result.result


def test_row_split_is_left_out_when_the_rule_returns_more_rows_than_the_table(request):
    result = run(
        request,
        SQATableValidator,
        "query_runner",
        TABLE_LINK,
        "SELECT a.id FROM {{ table_name }} a CROSS JOIN {{ table_name }} b",
        EntityType.TABLE,
        threshold="100",
        unit="PERCENTAGE",
    )

    assert result.testResultValue[0].value == str(TOTAL_ROWS * TOTAL_ROWS)
    assert result.failedRows is None
    assert result.passedRows is None
