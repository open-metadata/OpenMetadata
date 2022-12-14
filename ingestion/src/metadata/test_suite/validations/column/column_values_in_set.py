#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
ColumnValuesToBeNotNull validation implementation
"""
# pylint: disable=duplicate-code
import traceback
from ast import literal_eval
from datetime import datetime
from functools import singledispatch
from typing import Union

from pandas import DataFrame
from sqlalchemy import inspect

from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.orm_profiler.metrics.core import add_props
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiler.runner import QueryRunner
from metadata.utils.column_base_model import fetch_column_obj
from metadata.utils.entity_link import get_decoded_column
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


def test_case_status_result(set_count_res):
    return (
        TestCaseStatus.Success if set_count_res >= 1 else TestCaseStatus.Failed,
        f"Found countInSet={set_count_res}",
    )


# pylint: disable=abstract-class-instantiated
@singledispatch
def column_values_in_set(
    runner,
    test_case: TestCase,
    execution_date: Union[datetime, float],
):
    raise NotImplementedError


@column_values_in_set.register
def _(
    runner: QueryRunner,
    test_case: TestCase,
    execution_date: Union[datetime, float],
) -> TestCaseResult:
    """
    Validate Column Values metric
    :param test_case: ColumnValuesToBeUnique. Just used to trigger singledispatch
    :param col_profile: should contain count and distinct count metrics
    :param execution_date: Datetime when the tests ran
    :param session: SQLAlchemy Session, for tests that need to compute new metrics
    :param table: SQLAlchemy Table, for tests that need to compute new metrics
    :param profile_sample: % of the data to run the profiler on
    :return: TestCaseResult with status and results
    """

    allowed_value = next(
        (
            literal_eval(param.value)
            for param in test_case.parameterValues
            if param.name == "allowedValues"
        )
    )
    set_count = add_props(values=allowed_value)(Metrics.COUNT_IN_SET.value)

    try:
        column_name = get_decoded_column(test_case.entityLink.__root__)
        col = next(
            (col for col in inspect(runner.table).c if col.name == column_name),
            None,
        )
        if col is None:
            raise ValueError(
                f"Cannot find the configured column {column_name} for test case {test_case.name.__root__}"
            )

        set_count_dict = dict(runner.dispatch_query_select_first(set_count(col).fn()))
        set_count_res = set_count_dict.get(Metrics.COUNT_IN_SET.name)

    except Exception as exc:  # pylint: disable=broad-except
        msg = (
            f"Error computing {test_case.name} for {runner.table.__tablename__}: {exc}"
        )
        logger.debug(traceback.format_exc())
        logger.warning(msg)
        return TestCaseResult(
            timestamp=execution_date,
            testCaseStatus=TestCaseStatus.Aborted,
            result=msg,
            testResultValue=[TestResultValue(name="allowedValueCount", value=None)],
        )

    status, result = test_case_status_result(set_count_res)

    return TestCaseResult(
        timestamp=execution_date,
        testCaseStatus=status,
        result=result,
        testResultValue=[
            TestResultValue(
                name="allowedValueCount",
                value=str(set_count_res),
            )
        ],
    )


# pylint: disable=no-member,abstract-class-instantiated
@column_values_in_set.register
def _(
    runner: DataFrame,
    test_case: TestCase,
    execution_date: Union[datetime, float],
):
    allowed_value = next(
        (
            literal_eval(param.value)
            for param in test_case.parameterValues
            if param.name == "allowedValues"
        )
    )
    column_obj = fetch_column_obj(test_case.entityLink.__root__, runner)
    set_count_res = add_props(values=allowed_value)(Metrics.COUNT_IN_SET.value)(
        column_obj
    ).dl_fn(runner)
    status, result = test_case_status_result(set_count_res)

    return TestCaseResult(
        timestamp=execution_date,
        testCaseStatus=status,
        result=result,
        testResultValue=[
            TestResultValue(
                name="allowedValueCount",
                value=str(set_count_res),
            )
        ],
    )
