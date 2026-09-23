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
Row-level violation counts for the two between tests.

`columnValuesToBeBetween` and `columnValueLengthsToBeBetween` read every row, so their failure
threshold is a row tolerance: it is checked against how many values fall outside the window, which
the MIN/MAX these tests report cannot answer. The counting is built by `BetweenBoundsChecker`, so
the SQL and the pandas engines have to agree on the same fixture.
"""

import os
from datetime import datetime
from unittest.mock import patch
from uuid import uuid4

import pytest
import sqlalchemy as sqa
from pandas import DataFrame
from sqlalchemy.orm import DeclarativeBase

from metadata.data_quality.builders.validator_builder import ValidatorBuilder
from metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface import (
    SQATestSuiteInterface,
)
from metadata.data_quality.validations.column.pandas.columnValueLengthsToBeBetween import (
    ColumnValueLengthsToBeBetweenValidator as PandasLengthsValidator,
)
from metadata.data_quality.validations.column.pandas.columnValuesToBeBetween import (
    ColumnValuesToBeBetweenValidator as PandasValuesValidator,
)
from metadata.data_quality.validations.column.sqlalchemy.columnValueLengthsToBeBetween import (
    ColumnValueLengthsToBeBetweenValidator as SQALengthsValidator,
)
from metadata.data_quality.validations.column.sqlalchemy.columnValuesToBeBetween import (
    ColumnValuesToBeBetweenValidator as SQAValuesValidator,
)
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
    SQLiteScheme,
)
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.profiler.processor.runner import PandasRunner
from metadata.sampler.sqlalchemy.sampler import SQASampler

EXECUTION_DATE = datetime.strptime("2021-07-03", "%Y-%m-%d")

ENTITY_LINK_VALUE = "<#E::table::service.db.measurements::columns::value>"
ENTITY_LINK_LABEL = "<#E::table::service.db.measurements::columns::label>"

# Both tests are run against the same window, [3, 8], so the fixture is hand countable once:
# `value` and `label`'s length are the same seven numbers. Three of them -- 1, 9 and 12 -- fall
# outside the window, and the NULL row violates nothing: it has no value to compare and no length.
ROWS = [
    (1, "a"),
    (3, "abc"),
    (5, "abcde"),
    (8, "abcdefgh"),
    (9, "abcdefghi"),
    (12, "abcdefghijkl"),
    (None, None),
]

MIN_BOUND = 3
MAX_BOUND = 8
EXPECTED_VIOLATIONS = 3
EXPECTED_ROWS = len(ROWS)


class Base(DeclarativeBase):
    pass


class Measurement(Base):
    __tablename__ = "measurements"
    id = sqa.Column(sqa.Integer, primary_key=True)
    value = sqa.Column(sqa.Integer)
    label = sqa.Column(sqa.String(64))


TABLE = Table(
    id=uuid4(),
    name="measurements",
    fullyQualifiedName="service.db.measurements",
    columns=[
        Column(name="id", dataType=DataType.INT),  # type: ignore
        Column(name="value", dataType=DataType.INT),  # type: ignore
        Column(name="label", dataType=DataType.STRING),  # type: ignore
    ],
    database=EntityReference(id=uuid4(), name="db", type="database"),  # type: ignore
)  # type: ignore


@pytest.fixture
def sqa_runner(worker_id):
    """A sqlite table holding the fixture, and the runner reading it"""
    worker_suffix = f"_{worker_id}" if worker_id != "master" else ""
    db_path = os.path.join(  # noqa: PTH118
        os.path.dirname(__file__),  # noqa: PTH120
        f"{os.path.splitext(os.path.basename(__file__))[0]}{worker_suffix}.db",  # noqa: PTH119, PTH122
    )
    sqlite_conn = SQLiteConnection(
        scheme=SQLiteScheme.sqlite_pysqlite,
        databaseMode=db_path + "?check_same_thread=False",
    )  # type: ignore

    with patch.object(SQASampler, "build_table_orm", return_value=Measurement):
        sampler = SQASampler(
            service_connection_config=sqlite_conn,
            ometa_client=None,
            entity=TABLE,
        )
    interface = SQATestSuiteInterface(
        sqlite_conn,
        None,
        sampler,
        TABLE,
        validator_builder=ValidatorBuilder,
    )

    engine = interface.session.get_bind()
    Measurement.__table__.create(bind=engine)
    interface.session.add_all([Measurement(value=value, label=label) for value, label in ROWS])
    interface.session.commit()

    yield interface.runner

    Measurement.__table__.drop(bind=engine)
    if os.path.exists(db_path):  # noqa: PTH110
        os.remove(db_path)  # noqa: PTH107


@pytest.fixture
def pandas_runner():
    """The same fixture, split over two dataframes so the counting has to accumulate"""
    frames = (
        DataFrame(ROWS[:4], columns=["value", "label"]),
        DataFrame(ROWS[4:], columns=["value", "label"]),
    )
    return PandasRunner(dataset=lambda: iter(frames), raw_dataset=None)


def values_test_case(threshold=None, unit=None) -> TestCase:
    """A values-to-be-between test case on the fixture window"""
    return _test_case(
        ENTITY_LINK_VALUE,
        [
            TestCaseParameterValue(name="minValue", value=str(MIN_BOUND)),
            TestCaseParameterValue(name="maxValue", value=str(MAX_BOUND)),
        ],
        threshold,
        unit,
    )


def lengths_test_case(threshold=None, unit=None) -> TestCase:
    """A lengths-to-be-between test case on the fixture window"""
    return _test_case(
        ENTITY_LINK_LABEL,
        [
            TestCaseParameterValue(name="minLength", value=str(MIN_BOUND)),
            TestCaseParameterValue(name="maxLength", value=str(MAX_BOUND)),
        ],
        threshold,
        unit,
    )


def _test_case(entity_link, parameter_values, threshold, unit) -> TestCase:
    if threshold is not None:
        parameter_values = [*parameter_values, TestCaseParameterValue(name="threshold", value=str(threshold))]
    if unit is not None:
        parameter_values = [*parameter_values, TestCaseParameterValue(name="thresholdUnit", value=unit)]
    return TestCase(
        name="my_test_case",
        entityLink=entity_link,
        testSuite=EntityReference(id=uuid4(), type="TestSuite"),  # type: ignore
        testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),  # type: ignore
        parameterValues=parameter_values,
    )  # type: ignore


def test_sqa_counts_the_rows_outside_the_value_window(sqa_runner):
    validator = SQAValuesValidator(sqa_runner, values_test_case(threshold=1), EXECUTION_DATE.timestamp())
    column = validator.get_column()

    assert validator._run_violation_count(column, validator._get_test_parameters()) == (
        EXPECTED_ROWS,
        EXPECTED_VIOLATIONS,
    )


def test_pandas_counts_the_rows_outside_the_value_window(pandas_runner):
    validator = PandasValuesValidator(pandas_runner, values_test_case(threshold=1), EXECUTION_DATE.timestamp())
    column = validator.get_column()

    assert validator._run_violation_count(column, validator._get_test_parameters()) == (
        EXPECTED_ROWS,
        EXPECTED_VIOLATIONS,
    )


def test_sqa_counts_the_rows_outside_the_length_window(sqa_runner):
    validator = SQALengthsValidator(sqa_runner, lengths_test_case(threshold=1), EXECUTION_DATE.timestamp())
    column = validator.get_column()

    assert validator._run_violation_count(column, validator._get_test_parameters()) == (
        EXPECTED_ROWS,
        EXPECTED_VIOLATIONS,
    )


def test_pandas_counts_the_rows_outside_the_length_window(pandas_runner):
    validator = PandasLengthsValidator(pandas_runner, lengths_test_case(threshold=1), EXECUTION_DATE.timestamp())
    column = validator.get_column()

    assert validator._run_violation_count(column, validator._get_test_parameters()) == (
        EXPECTED_ROWS,
        EXPECTED_VIOLATIONS,
    )


@pytest.mark.parametrize(
    "threshold,unit,status",
    [
        (EXPECTED_VIOLATIONS, "ABSOLUTE", TestCaseStatus.Success),
        (EXPECTED_VIOLATIONS - 1, "ABSOLUTE", TestCaseStatus.Failed),
        (50, "PERCENTAGE", TestCaseStatus.Success),  # 3 out of 7 rows is 42.86%
        (40, "PERCENTAGE", TestCaseStatus.Failed),
    ],
)
def test_row_tolerance_decides_the_value_verdict(sqa_runner, pandas_runner, threshold, unit, status):
    """The verdict is the violation count against the threshold, not the MIN/MAX"""
    sqa_result = SQAValuesValidator(
        sqa_runner, values_test_case(threshold, unit), EXECUTION_DATE.timestamp()
    ).run_validation()
    pandas_result = PandasValuesValidator(
        pandas_runner, values_test_case(threshold, unit), EXECUTION_DATE.timestamp()
    ).run_validation()

    for result in (sqa_result, pandas_result):
        assert result.testCaseStatus == status
        assert result.failedRows == EXPECTED_VIOLATIONS
        assert result.passedRows == EXPECTED_ROWS - EXPECTED_VIOLATIONS


@pytest.mark.parametrize(
    "threshold,unit,status",
    [
        (EXPECTED_VIOLATIONS, "ABSOLUTE", TestCaseStatus.Success),
        (EXPECTED_VIOLATIONS - 1, "ABSOLUTE", TestCaseStatus.Failed),
        (50, "PERCENTAGE", TestCaseStatus.Success),
        (40, "PERCENTAGE", TestCaseStatus.Failed),
    ],
)
def test_row_tolerance_decides_the_length_verdict(sqa_runner, pandas_runner, threshold, unit, status):
    sqa_result = SQALengthsValidator(
        sqa_runner, lengths_test_case(threshold, unit), EXECUTION_DATE.timestamp()
    ).run_validation()
    pandas_result = PandasLengthsValidator(
        pandas_runner, lengths_test_case(threshold, unit), EXECUTION_DATE.timestamp()
    ).run_validation()

    assert sqa_result.testCaseStatus == status
    assert pandas_result.testCaseStatus == status


def test_min_and_max_are_still_reported(sqa_runner):
    """Users read the extremes, so a row tolerance does not take them off the result"""
    result = SQAValuesValidator(sqa_runner, values_test_case(threshold=5), EXECUTION_DATE.timestamp()).run_validation()

    assert [(value.name, value.value) for value in result.testResultValue] == [("min", "1"), ("max", "12")]

    lengths = SQALengthsValidator(
        sqa_runner, lengths_test_case(threshold=5), EXECUTION_DATE.timestamp()
    ).run_validation()

    assert [(value.name, value.value) for value in lengths.testResultValue] == [
        ("minValueLength", "1"),
        ("maxValueLength", "12"),
    ]


def test_no_tolerance_keeps_the_min_max_verdict(sqa_runner):
    """Without a tolerance nothing is counted: the extremes alone answer the same question"""
    validator = SQAValuesValidator(sqa_runner, values_test_case(), EXECUTION_DATE.timestamp())

    with patch.object(SQAValuesValidator, "_run_violation_count") as counted:
        result = validator.run_validation()

    counted.assert_not_called()
    assert result.testCaseStatus == TestCaseStatus.Failed
    assert result.failedRows is None


def test_the_window_is_never_widened_by_the_threshold(sqa_runner):
    """The tolerance is spent on rows here, so spending it on the bounds too would double it"""
    validator = SQAValuesValidator(sqa_runner, values_test_case(threshold=5), EXECUTION_DATE.timestamp())

    assert validator._get_test_parameters() == {"minValue": MIN_BOUND, "maxValue": MAX_BOUND}
