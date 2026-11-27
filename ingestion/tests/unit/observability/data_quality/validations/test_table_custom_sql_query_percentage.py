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
`tableCustomSQLQuery` with a `thresholdUnit`, run against the SQLite `users` table (80 rows).

A PERCENTAGE threshold applies the test case's own `operator` to the share of the table's rows
the query returned. The cases are chosen so that reading the threshold as a raw count would give
the opposite verdict.
"""

from datetime import datetime
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest

from metadata.data_quality.validations.models import (
    TableCustomSQLQueryRuntimeParameters,
)
from metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery import (
    TableCustomSQLQueryValidator,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.entityReference import EntityReference

EXECUTION_DATE = datetime.strptime("2021-07-03", "%Y-%m-%d")

# 60 of the 80 rows: 75%
SIXTY_ROWS = "SELECT * FROM users WHERE age > 20"
ONE_ROW = "SELECT * FROM users LIMIT 1"


def _run(create_sqlite_table, compute_row_count=False, **params):
    test_case = TestCase(
        name="my_test_case",
        entityLink="<#E::table::service.db.users>",
        testSuite=EntityReference(id=uuid4(), type="TestSuite"),  # type: ignore
        testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),  # type: ignore
        computePassedFailedRowCount=compute_row_count,
        parameterValues=[
            *(TestCaseParameterValue(name=name, value=value) for name, value in params.items()),
            TestCaseParameterValue(
                name=TableCustomSQLQueryRuntimeParameters.__name__,
                value=TableCustomSQLQueryRuntimeParameters(
                    conn_config=DatabaseConnection(config=create_sqlite_table.service_connection),
                    entity=create_sqlite_table.entity,
                ).model_dump_json(),
            ),
        ],
    )  # type: ignore
    validator = TableCustomSQLQueryValidator(
        create_sqlite_table, test_case=test_case, execution_date=EXECUTION_DATE.timestamp()
    )
    return validator, validator.run_validation()


@pytest.mark.parametrize(
    "operator,threshold,expected",
    [
        ("<", "76", TestCaseStatus.Success),
        ("<", "70", TestCaseStatus.Failed),
        ("<=", "75", TestCaseStatus.Success),
        ("<=", "74", TestCaseStatus.Failed),
        (">", "70", TestCaseStatus.Success),
        (">", "75", TestCaseStatus.Failed),
        (">=", "75", TestCaseStatus.Success),
        (">=", "76", TestCaseStatus.Failed),
        ("==", "75", TestCaseStatus.Success),
        ("==", "60", TestCaseStatus.Failed),
        ("!=", "60", TestCaseStatus.Success),
        ("!=", "75", TestCaseStatus.Failed),
    ],
)
def test_every_operator_is_applied_to_the_percentage(create_sqlite_table, operator, threshold, expected):
    _, result = _run(
        create_sqlite_table,
        sqlExpression=SIXTY_ROWS,
        operator=operator,
        threshold=threshold,
        thresholdUnit="PERCENTAGE",
    )

    assert result.testCaseStatus == expected
    assert result.testResultValue[0].value == "60"


def test_one_percent_ceiling_fails_when_the_query_returns_more(create_sqlite_table):
    """1 row of 80 is 1.25%: a 1% ceiling is breached, a 1 row ceiling is not."""
    _, percentage = _run(
        create_sqlite_table, sqlExpression=ONE_ROW, operator="<=", threshold="1", thresholdUnit="PERCENTAGE"
    )
    _, absolute = _run(create_sqlite_table, sqlExpression=ONE_ROW, operator="<=", threshold="1")

    assert percentage.testCaseStatus == TestCaseStatus.Failed
    assert absolute.testCaseStatus == TestCaseStatus.Success


def test_percentage_accepts_a_fractional_threshold(create_sqlite_table):
    _, result = _run(
        create_sqlite_table, sqlExpression=ONE_ROW, operator="<=", threshold="1.5", thresholdUnit="PERCENTAGE"
    )

    assert result.testCaseStatus == TestCaseStatus.Success


def test_percentage_preserves_an_exact_integer_boundary(create_sqlite_table):
    with patch.object(TableCustomSQLQueryValidator, "compute_row_count", return_value=100):
        _, result = _run(
            create_sqlite_table,
            sqlExpression="SELECT * FROM users LIMIT 7",
            operator="<=",
            threshold="7",
            thresholdUnit="PERCENTAGE",
        )

    assert result.testCaseStatus == TestCaseStatus.Success


def test_percentage_applies_to_a_count_strategy(create_sqlite_table):
    """30 of 80 is 37.5%: it breaches a 37% ceiling that 30 rows would not."""
    _, result = _run(
        create_sqlite_table,
        sqlExpression="SELECT COUNT(*) FROM users WHERE age > 30",
        strategy="COUNT",
        operator="<=",
        threshold="37",
        thresholdUnit="PERCENTAGE",
    )

    assert result.testCaseStatus == TestCaseStatus.Failed
    assert result.testResultValue[0].value == "30"


def test_count_strategy_uses_the_partitioned_table_as_its_denominator(create_sqlite_table):
    """30 matching rows out of the 60-row partition is 50%, not 30 rows out of one aggregate row."""
    _, result = _run(
        create_sqlite_table,
        sqlExpression="SELECT COUNT(*) FROM users WHERE age > 30",
        strategy="COUNT",
        operator="<=",
        threshold="50",
        thresholdUnit="PERCENTAGE",
        partitionExpression="age > 20",
    )

    assert result.testCaseStatus == TestCaseStatus.Success, result.result
    assert result.result.startswith("Found 30 row(s), 50% of the 60 row(s) counted.")


def test_percentage_row_count_failure_rolls_back_the_session(create_sqlite_table):
    validator, _ = _run(
        create_sqlite_table,
        sqlExpression=SIXTY_ROWS,
        operator="<=",
        threshold="75",
        thresholdUnit="PERCENTAGE",
        partitionExpression="age > 20",
    )
    session = validator.runner.session

    with (
        patch.object(session, "execute", side_effect=RuntimeError("invalid partition")),
        patch.object(session, "rollback") as rollback,
        pytest.raises(RuntimeError, match="invalid partition"),
    ):
        validator.compute_row_count()

    rollback.assert_called_once_with()


def test_percentage_message_states_the_share_and_the_denominator(create_sqlite_table):
    _, result = _run(
        create_sqlite_table, sqlExpression=SIXTY_ROWS, operator="<=", threshold="1", thresholdUnit="PERCENTAGE"
    )

    assert result.result.startswith(
        "Found 60 row(s), 75% of the 80 row(s) counted. Test query is expected to return <= 1% of the row count."
    )


def test_percentage_counts_the_rows_instead_of_trusting_the_catalog_estimate(create_sqlite_table):
    """MySQL's information_schema TABLE_ROWS is a cached estimate and can read 0 on a full table."""
    stale_estimate = Mock()
    stale_estimate.compute.return_value._asdict.return_value = {"rowCount": 0}
    with patch(
        "metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery.TableMetricComputer",
        return_value=stale_estimate,
    ):
        _, result = _run(
            create_sqlite_table, sqlExpression=SIXTY_ROWS, operator="<=", threshold="80", thresholdUnit="PERCENTAGE"
        )

    assert result.testCaseStatus == TestCaseStatus.Success
    assert "75% of the 80 row(s)" in result.result


def test_percentage_without_rows_to_count_against_aborts(create_sqlite_table):
    with patch.object(TableCustomSQLQueryValidator, "compute_row_count", return_value=None):
        _, result = _run(
            create_sqlite_table, sqlExpression=SIXTY_ROWS, operator=">=", threshold="1", thresholdUnit="PERCENTAGE"
        )

    assert result.testCaseStatus == TestCaseStatus.Aborted


def test_an_empty_result_against_no_rows_is_zero_percent(create_sqlite_table):
    with patch.object(TableCustomSQLQueryValidator, "compute_row_count", return_value=0):
        _, result = _run(
            create_sqlite_table,
            sqlExpression="SELECT * FROM users WHERE 1 = 0",
            operator="<=",
            threshold="1",
            thresholdUnit="PERCENTAGE",
        )

    assert result.testCaseStatus == TestCaseStatus.Success


def test_equality_passed_failed_rows_count_the_percentage_as_rows(create_sqlite_table):
    """`== 50%` of 80 rows expects 40: 60 returned is 20 too many."""
    _, result = _run(
        create_sqlite_table,
        compute_row_count=True,
        sqlExpression=SIXTY_ROWS,
        operator="==",
        threshold="50",
        thresholdUnit="PERCENTAGE",
    )

    assert result.testCaseStatus == TestCaseStatus.Failed
    assert result.passedRows == 60
    assert result.failedRows == 20


@pytest.mark.parametrize("unit", [None, "ABSOLUTE"])
def test_absolute_keeps_reading_the_threshold_as_a_row_count(create_sqlite_table, unit):
    params = {"sqlExpression": SIXTY_ROWS, "operator": "<=", "threshold": "60"}
    if unit:
        params["thresholdUnit"] = unit

    _, result = _run(create_sqlite_table, **params)

    assert result.testCaseStatus == TestCaseStatus.Success
    assert result.result.startswith("Found 60 row(s). Test query is expected to return <= 60 row(s).")
    assert result.passedRows is None
    assert result.failedRows is None
