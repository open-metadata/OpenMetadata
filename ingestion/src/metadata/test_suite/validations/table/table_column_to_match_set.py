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

import collections
import reprlib
import traceback
from datetime import datetime
from functools import singledispatch
from typing import List, Union

from pandas import DataFrame
from sqlalchemy import inspect

from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.orm_profiler.profiler.runner import QueryRunner
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


def format_column_list(status: TestCaseStatus, cols: List):
    """Format column list based on the test status

    Args:
        status: status of the test
        cols: list of columns
    """
    if status == TestCaseStatus.Success:
        return reprlib.repr(cols)
    return cols


@singledispatch
def table_column_to_match_set(
    runner: QueryRunner,
    test_case: TestCase,
    execution_date: Union[datetime, float],
):
    raise NotImplementedError


@table_column_to_match_set.register
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
        column_names = inspect(runner.table).c

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
            testResultValue=[TestResultValue(name="columnNames", value=None)],
        )

    column_name = next(
        param_value.value
        for param_value in test_case.parameterValues
        if param_value.name == "columnNames"
    )
    ordered = next(
        (
            bool(param_value.value)
            for param_value in test_case.parameterValues
            if param_value.name == "ordered"
        ),
        None,
    )
    expected_column_names = [item.strip() for item in column_name.split(",")]
    # pylint: disable=unnecessary-lambda-assignment
    compare = lambda x, y: collections.Counter(x) == collections.Counter(y)

    if ordered:
        _status = expected_column_names == [col.name for col in column_names]
    else:
        _status = compare(expected_column_names, [col.name for col in column_names])

    status = TestCaseStatus.Success if _status else TestCaseStatus.Failed

    result = (
        f"Found {format_column_list(status, [col.name for col in column_names])} column vs. "
        f"the expected column names {format_column_list(status, expected_column_names)}."
    )

    return TestCaseResult(
        timestamp=execution_date,
        testCaseStatus=status,
        result=result,
        testResultValue=[
            TestResultValue(
                name="columnNames", value=str([col.name for col in column_names])
            )
        ],
    )


@table_column_to_match_set.register
def _(
    runner: DataFrame,
    test_case: TestCase,
    execution_date: Union[datetime, float],
):
    """
    Validate row count metric

    Args:
        test_case: test case type to be ran. Used to dispatch
        table_profile: table profile results
        execution_date: datetime of the test execution
    Returns:
        TestCaseResult with status and results
    """
    column_names = list(runner.columns)
    column_name = next(
        param_value.value
        for param_value in test_case.parameterValues
        if param_value.name == "columnNames"
    )
    ordered = next(
        (
            bool(param_value.value)
            for param_value in test_case.parameterValues
            if param_value.name == "ordered"
        ),
        None,
    )
    expected_column_names = [item.strip() for item in column_name.split(",")]
    # pylint: disable=unnecessary-lambda-assignment
    compare = lambda x, y: collections.Counter(x) == collections.Counter(y)

    if ordered:
        _status = expected_column_names == column_names
    else:
        _status = compare(expected_column_names, column_names)

    status = TestCaseStatus.Success if _status else TestCaseStatus.Failed

    result = (
        f"Found {format_column_list(status, column_names)} column vs. "
        f"the expected column names {format_column_list(status, expected_column_names)}."
    )

    return TestCaseResult(
        timestamp=execution_date,
        testCaseStatus=status,
        result=result,
        testResultValue=[TestResultValue(name="columnNames", value=str(column_names))],
    )
