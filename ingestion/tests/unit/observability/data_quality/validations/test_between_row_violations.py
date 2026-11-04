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

import pandas as pd
import pytest
import sqlalchemy as sqa
from pandas import DataFrame
from sqlalchemy.orm import DeclarativeBase, Session

from metadata.data_quality.builders.validator_builder import ValidatorBuilder
from metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface import (
    SQATestSuiteInterface,
)
from metadata.data_quality.validations.checkers.between_bounds_checker import (
    BetweenBoundsChecker,
)
from metadata.data_quality.validations.column.pandas.columnValueLengthsToBeBetween import (
    ColumnValueLengthsToBeBetweenValidator as PandasLengthsValidator,
)
from metadata.data_quality.validations.column.pandas.columnValueMaxToBeBetween import ColumnValueMaxToBeBetweenValidator
from metadata.data_quality.validations.column.pandas.columnValueMinToBeBetween import ColumnValueMinToBeBetweenValidator
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
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.runner import PandasRunner, QueryRunner
from metadata.sampler.sqlalchemy.sampler import SQASampler
from metadata.utils.sqa_like_column import SQALikeColumn

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


def values_test_case(threshold=None, unit=None, compute_row_count=False) -> TestCase:
    """A values-to-be-between test case on the fixture window"""
    return _test_case(
        ENTITY_LINK_VALUE,
        [
            TestCaseParameterValue(name="minValue", value=str(MIN_BOUND)),
            TestCaseParameterValue(name="maxValue", value=str(MAX_BOUND)),
        ],
        threshold,
        unit,
        compute_row_count,
    )


def lengths_test_case(threshold=None, unit=None, compute_row_count=False) -> TestCase:
    """A lengths-to-be-between test case on the fixture window"""
    return _test_case(
        ENTITY_LINK_LABEL,
        [
            TestCaseParameterValue(name="minLength", value=str(MIN_BOUND)),
            TestCaseParameterValue(name="maxLength", value=str(MAX_BOUND)),
        ],
        threshold,
        unit,
        compute_row_count,
    )


def _test_case(entity_link, parameter_values, threshold, unit, compute_row_count=False) -> TestCase:
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
        computePassedFailedRowCount=compute_row_count,
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


@pytest.mark.parametrize("threshold", [None, 0, 0.0])
def test_no_tolerance_keeps_the_min_max_verdict(sqa_runner, threshold):
    """Without a tolerance nothing is counted: the extremes alone answer the same question

    A threshold explicitly set to zero tolerates nothing either, so it must not pay for the count.
    """
    validator = SQAValuesValidator(sqa_runner, values_test_case(threshold), EXECUTION_DATE.timestamp())

    with patch.object(SQAValuesValidator, "_run_violation_count") as counted:
        result = validator.run_validation()

    counted.assert_not_called()
    assert result.testCaseStatus == TestCaseStatus.Failed
    assert result.failedRows is None


@pytest.mark.parametrize(
    "validator_class,test_case_builder",
    [
        (SQAValuesValidator, values_test_case),
        (SQALengthsValidator, lengths_test_case),
    ],
)
def test_row_reporting_reuses_the_counted_violations(sqa_runner, validator_class, test_case_builder):
    """The reported rows are the ones the verdict was taken on, not a second scan's

    A table can change between two scans, and a percentage sample draws different rows each
    time, so counting again could report rows that contradict the status.
    """
    test_case = test_case_builder(threshold=EXPECTED_VIOLATIONS, unit="ABSOLUTE", compute_row_count=True)
    validator = validator_class(sqa_runner, test_case, EXECUTION_DATE.timestamp())

    with patch.object(validator_class, "compute_row_count") as counted_again:
        result = validator.run_validation()

    counted_again.assert_not_called()
    assert result.testCaseStatus == TestCaseStatus.Success
    assert result.failedRows == EXPECTED_VIOLATIONS
    assert result.passedRows == EXPECTED_ROWS - EXPECTED_VIOLATIONS


@pytest.mark.parametrize(
    "min_bound,max_bound,violations",
    [
        (None, None, 0),  # a window with neither side set excludes nothing
        (MIN_BOUND, None, 1),  # only the 1 is below 3
        (None, MAX_BOUND, 2),  # only the 9 and the 12 are above 8
    ],
)
def test_an_unset_bound_excludes_nothing(pandas_runner, min_bound, max_bound, violations):
    """A bound a validator resolved to None is a side of the window that lets everything through

    Both engines have to read it that way: the SQL half builds no condition for it, so the
    pandas half must not compare against it either.
    """
    checker = BetweenBoundsChecker(min_bound=min_bound, max_bound=max_bound)

    counted = sum(int(checker.get_violations_mask(df["value"]).sum()) for df in pandas_runner)

    assert counted == violations


@pytest.mark.parametrize(
    "validator_cls, entity_link",
    [
        (SQAValuesValidator, ENTITY_LINK_VALUE),
        (SQALengthsValidator, ENTITY_LINK_LABEL),
    ],
)
def test_sqa_an_unbounded_window_fails_no_row(sqa_runner, validator_cls, entity_link):
    """With neither bound set nothing is outside the window, so no row may be reported failed"""
    validator = validator_cls(sqa_runner, _test_case(entity_link, [], None, None), EXECUTION_DATE.timestamp())

    assert validator.compute_row_count(validator.get_column(), float("-inf"), float("inf")) == (EXPECTED_ROWS, 0)


def test_sqa_one_open_side_counts_only_the_other(sqa_runner):
    """Only the lower bound set: the rows below it fail, and no upper side is invented"""
    validator = SQAValuesValidator(
        sqa_runner, _test_case(ENTITY_LINK_VALUE, [], None, None), EXECUTION_DATE.timestamp()
    )

    assert validator.compute_row_count(validator.get_column(), MIN_BOUND, float("inf")) == (EXPECTED_ROWS, 1)


@pytest.mark.parametrize(
    "validator_cls, entity_link",
    [
        (SQAValuesValidator, ENTITY_LINK_VALUE),
        (SQALengthsValidator, ENTITY_LINK_LABEL),
    ],
)
def test_sqa_an_unbounded_window_samples_no_filter(sqa_runner, validator_cls, entity_link):
    """The failed-row sample is drawn with the same window, so an open window filters nothing"""
    validator = validator_cls(sqa_runner, _test_case(entity_link, [], None, None), EXECUTION_DATE.timestamp())

    assert validator.filter()["filters"] == []


def test_the_window_is_never_widened_by_the_threshold(sqa_runner):
    """The tolerance is spent on rows here, so spending it on the bounds too would double it"""
    validator = SQAValuesValidator(sqa_runner, values_test_case(threshold=5), EXECUTION_DATE.timestamp())

    assert validator._get_test_parameters() == {"minValue": MIN_BOUND, "maxValue": MAX_BOUND}


class TimestampMeasurement(Base):
    __tablename__ = "timestamp_measurements"
    id = sqa.Column(sqa.Integer, primary_key=True)
    value = sqa.Column(sqa.DateTime)


@pytest.fixture(params=["sqlalchemy", "pandas"])
def datetime_validator(request):
    values = [datetime(2023, 2, 1, 5, 0, 0, 125000), datetime(2023, 2, 1, 6, 0, 0, 500000)]
    if request.param == "pandas":
        yield PandasValuesValidator, PandasRunner.from_dataframe(DataFrame({"value": values}))
    else:
        engine = sqa.create_engine("sqlite://")
        try:
            TimestampMeasurement.__table__.create(engine)
            with Session(engine) as session:
                session.add_all([TimestampMeasurement(value=value) for value in values])
                session.commit()
                yield SQAValuesValidator, QueryRunner(session, TimestampMeasurement, TimestampMeasurement)
        finally:
            engine.dispose()


@pytest.mark.parametrize(
    "min_value,max_value,expected_status",
    [
        ("2023-02-01 05:00:00", "2023-02-01T06:00:01Z", TestCaseStatus.Success),
        ("2023-02-01", "2023-02-02", TestCaseStatus.Success),
        ("2023-02-01T10:30:00.125+05:30", "2023-02-01T02:30:00.500-03:30", TestCaseStatus.Success),
        ("1675227600.125", "1675231200.500", TestCaseStatus.Success),
        ("1675227600125", "1675231200500", TestCaseStatus.Success),
        ("1675227600", "2023-02-01T06:00:01Z", TestCaseStatus.Success),
        ("2023-02-01T05:00:00.126Z", "2023-02-01T06:00:00.500Z", TestCaseStatus.Failed),
        ("1675227600.126", "1675231200.500", TestCaseStatus.Failed),
        ("2023-02-01T05:00:00.125Z", "2023-02-01T06:00:00.499Z", TestCaseStatus.Failed),
    ],
)
def test_datetime_bounds_accept_epoch_and_iso(datetime_validator, min_value, max_value, expected_status):
    validator_class, runner = datetime_validator
    test_case = _test_case(
        "<#E::table::service.db.timestamp_measurements::columns::value>",
        [
            TestCaseParameterValue(name="minValue", value=min_value),
            TestCaseParameterValue(name="maxValue", value=max_value),
        ],
        threshold=None,
        unit=None,
    )
    result = validator_class(runner, test_case, EXECUTION_DATE.timestamp()).run_validation()
    assert result.testCaseStatus == expected_status


def test_pandas_datetime_bounds_preserve_microseconds_across_chunks():
    frames = [
        DataFrame({"value": [datetime(2023, 2, 1, 5, 0, 0, 125123), None]}),
        DataFrame({"value": [pd.NaT]}),
        DataFrame({"value": [datetime(2023, 2, 1, 6, 0, 0, 500456)]}),
    ]
    runner = PandasRunner(dataset=lambda: iter(frames), raw_dataset=lambda: iter(frames))
    test_case = _test_case(
        "<#E::table::service.db.timestamp_measurements::columns::value>",
        [
            TestCaseParameterValue(name="minValue", value="2023-02-01T05:00:00.125123Z"),
            TestCaseParameterValue(name="maxValue", value="2023-02-01T06:00:00.500456Z"),
        ],
        threshold=None,
        unit=None,
    )
    result = PandasValuesValidator(runner, test_case, EXECUTION_DATE.timestamp()).run_validation()
    assert result.testCaseStatus == TestCaseStatus.Success
    assert [value.value for value in result.testResultValue] == [
        "2023-02-01 05:00:00.125123",
        "2023-02-01 06:00:00.500456",
    ]


@pytest.mark.parametrize(
    "validator_class,metric",
    [
        (ColumnValueMinToBeBetweenValidator, Metrics.min),
        (ColumnValueMaxToBeBetweenValidator, Metrics.max),
    ],
)
def test_dimensional_datetime_extrema_keep_numeric_bounds(validator_class, metric):
    runner = PandasRunner.from_dataframe(
        DataFrame(
            {
                "value": [datetime(2023, 2, 1), datetime(2023, 2, 3)],
                "group": ["A", "B"],
            }
        )
    )
    bounds = {validator_class.MIN_BOUND: 1675209600000, validator_class.MAX_BOUND: 1675296000000}
    test_case = _test_case(
        ENTITY_LINK_VALUE,
        [TestCaseParameterValue(name=name, value=str(value)) for name, value in bounds.items()],
        threshold=None,
        unit=None,
    )
    validator = validator_class(runner, test_case, EXECUTION_DATE.timestamp())
    results = validator._execute_dimensional_validation(
        SQALikeColumn(name="value", type=DataType.DATETIME),
        SQALikeColumn(name="group", type=DataType.STRING),
        {metric.name: metric},
        bounds,
        5,
    )
    assert {result.dimensionValues[0].value: result.testCaseStatus for result in results} == {
        "A": TestCaseStatus.Success,
        "B": TestCaseStatus.Failed,
    }
