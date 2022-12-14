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
TableColumnCountToBeBetween validation implementation
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
from metadata.orm_profiler.profiler.runner import QueryRunner
from metadata.utils.logger import test_suite_logger
from metadata.utils.test_suite import get_test_case_param_value

logger = test_suite_logger()


@singledispatch
def table_column_count_to_be_between(
    runner,
    test_case: TestCase,
    execution_date: Union[datetime, float],
):
    raise NotImplementedError


@table_column_count_to_be_between.register
def _(
    runner: QueryRunner,
    test_case: TestCase,
    execution_date: Union[datetime, float],
) -> TestCaseResult:
    """
    Validate row count metric

    Args:
        test_case: test case type to be ran. Used to dispatch
        table_profile: table profile results
        execution_date: datetime of the test execution
    Returns:
        TestCaseResult with status and results
    """

    try:
        column_count = len(inspect(runner.table).c)
        if column_count is None:
            raise ValueError(
                f"Column Count for test case {test_case.name} returned None"
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
            testResultValue=[TestResultValue(name="columnCount", value=None)],
        )

    min_ = get_test_case_param_value(
        test_case.parameterValues,  # type: ignore
        "minColValue",
        int,
        default=float("-inf"),
    )

    max_ = get_test_case_param_value(
        test_case.parameterValues,  # type: ignore
        "maxColValue",
        int,
        default=float("inf"),
    )

    status = (
        TestCaseStatus.Success
        if min_ <= column_count <= max_
        else TestCaseStatus.Failed
    )
    result = f"Found {column_count} column vs. the expected range [{min_}, {max_}]."

    return TestCaseResult(
        timestamp=execution_date,
        testCaseStatus=status,
        result=result,
        testResultValue=[TestResultValue(name="columnCount", value=column_count)],
    )


@table_column_count_to_be_between.register
def _(
    runner: DataFrame,
    test_case: TestCase,
    execution_date: Union[datetime, float],
) -> TestCaseResult:
    """
    Validate row count metric

    Args:
        test_case: test case type to be ran. Used to dispatch
        table_profile: table profile results
        execution_date: datetime of the test execution
    Returns:
        TestCaseResult with status and results
    """
    column_count = len(runner.columns)
    min_ = get_test_case_param_value(
        test_case.parameterValues,  # type: ignore
        "minColValue",
        int,
        default=float("-inf"),
    )

    max_ = get_test_case_param_value(
        test_case.parameterValues,  # type: ignore
        "maxColValue",
        int,
        default=float("inf"),
    )

    status = (
        TestCaseStatus.Success
        if min_ <= column_count <= max_
        else TestCaseStatus.Failed
    )
    result = f"Found {column_count} column vs. the expected range [{min_}, {max_}]."

    return TestCaseResult(
        timestamp=execution_date,
        testCaseStatus=status,
        result=result,
        testResultValue=[TestResultValue(name="columnCount", value=column_count)],
    )
