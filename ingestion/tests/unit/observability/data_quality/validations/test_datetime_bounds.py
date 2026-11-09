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
"""Datetime bounds on the SQL and pandas validation paths."""

from datetime import datetime
from uuid import uuid4

import pandas as pd
import pytest
import sqlalchemy as sqa
from pandas import DataFrame
from sqlalchemy.orm import DeclarativeBase, Session

from metadata.data_quality.validations.column.pandas.columnValueMaxToBeBetween import ColumnValueMaxToBeBetweenValidator
from metadata.data_quality.validations.column.pandas.columnValueMinToBeBetween import ColumnValueMinToBeBetweenValidator
from metadata.data_quality.validations.column.pandas.columnValuesToBeBetween import (
    ColumnValuesToBeBetweenValidator as PandasValuesValidator,
)
from metadata.data_quality.validations.column.sqlalchemy.columnValuesToBeBetween import (
    ColumnValuesToBeBetweenValidator as SQAValuesValidator,
)
from metadata.generated.schema.entity.data.table import DataType
from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.runner import PandasRunner, QueryRunner
from metadata.utils.sqa_like_column import SQALikeColumn

EXECUTION_DATE = datetime(2021, 7, 3)
ENTITY_LINK_VALUE = "<#E::table::service.db.timestamp_measurements::columns::value>"


class Base(DeclarativeBase):
    pass


def _test_case(entity_link, parameter_values) -> TestCase:
    return TestCase(
        name="my_test_case",
        entityLink=entity_link,
        testSuite=EntityReference(id=uuid4(), type="TestSuite"),
        testDefinition=EntityReference(id=uuid4(), type="TestDefinition"),
        parameterValues=parameter_values,
        computePassedFailedRowCount=False,
    )


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
