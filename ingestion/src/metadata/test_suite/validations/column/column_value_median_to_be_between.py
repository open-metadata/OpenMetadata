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
ColumnValuesToBeBetween validation implementation
"""
# pylint: disable=duplicate-code

import traceback
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
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiler.runner import QueryRunner
from metadata.utils.column_base_model import fetch_column_obj
from metadata.utils.entity_link import get_decoded_column
from metadata.utils.logger import test_suite_logger
from metadata.utils.test_suite import get_test_case_param_value

logger = test_suite_logger()


def test_case_status_result(min_bound, max_bound, median_value_res):
    return (
        TestCaseStatus.Success
        if min_bound <= median_value_res <= max_bound
        else TestCaseStatus.Failed,
        f"Found median={median_value_res} vs."
        + f" the expected median={min_bound}, max={max_bound}.",
    )


@singledispatch
def column_value_median_to_be_between(
    runner,
    test_case: TestCase,
    execution_date: Union[datetime, float],
):
    raise NotImplementedError


@column_value_median_to_be_between.register
def _(
    runner: QueryRunner,
    test_case: TestCase,
    execution_date: Union[datetime, float],
) -> TestCaseResult:
    """
    Validate Column Values metric
    :param test_case: columnValueMedianToBeBetween
    :param col_profile: should contain MIN & MAX metrics
    :param execution_date: Datetime when the tests ran
    :return: TestCaseResult with status and results
    """

    try:
        column_name = get_decoded_column(test_case.entityLink.__root__)
        col = next(
            (col for col in inspect(runner.table).c if col.name == column_name),
            None,
        )
        if col is None:
            raise ValueError(
                f"Cannot find the configured column {column_name} for test case {test_case.name}"
            )

        median_value_dict = dict(
            runner.dispatch_query_select_first(Metrics.MEDIAN.value(col).fn())
        )
        median_value_res = median_value_dict.get(Metrics.MEDIAN.name)
        if median_value_res is None:
            raise ValueError(
                f"Query on column {column_name} for test case {test_case.name} returned None"
            )

    except Exception as exc:
        msg = (
            f"Error computing {test_case.name} for {runner.table.__tablename__}: {exc}"
        )
        logger.debug(traceback.format_exc())
        logger.warning(msg)
        return TestCaseResult(
            timestamp=execution_date,
            testCaseStatus=TestCaseStatus.Aborted,
            result=msg,
            testResultValue=[TestResultValue(name="median", value=None)],
        )

    min_bound = get_test_case_param_value(
        test_case.parameterValues,  # type: ignore
        "minValueForMedianInCol",
        float,
        default=float("-inf"),
    )

    max_bound = get_test_case_param_value(
        test_case.parameterValues,  # type: ignore
        "maxValueForMedianInCol",
        float,
        default=float("inf"),
    )

    status, result = test_case_status_result(min_bound, max_bound, median_value_res)
    return TestCaseResult(
        timestamp=execution_date,
        testCaseStatus=status,
        result=result,
        testResultValue=[TestResultValue(name="median", value=str(median_value_res))],
    )


@column_value_median_to_be_between.register
def _(
    runner: DataFrame,
    test_case: TestCase,
    execution_date: Union[datetime, float],
):
    """
    Validate Column Values metric
    :param test_case: columnValueMedianToBeBetween
    :param col_profile: should contain MIN & MAX metrics
    :param execution_date: Datetime when the tests ran
    :return: TestCaseResult with status and results
    """
    column_obj = fetch_column_obj(test_case.entityLink.__root__, runner)

    median_value_res = Metrics.MEDIAN.value(column_obj).dl_fn(runner)
    min_bound = get_test_case_param_value(
        test_case.parameterValues,  # type: ignore
        "minValueForMedianInCol",
        float,
        default=float("-inf"),
    )

    max_bound = get_test_case_param_value(
        test_case.parameterValues,  # type: ignore
        "maxValueForMedianInCol",
        float,
        default=float("inf"),
    )
    status, result = test_case_status_result(min_bound, max_bound, median_value_res)
    return TestCaseResult(
        timestamp=execution_date,
        testCaseStatus=status,
        result=result,
        testResultValue=[TestResultValue(name="median", value=str(median_value_res))],
    )
