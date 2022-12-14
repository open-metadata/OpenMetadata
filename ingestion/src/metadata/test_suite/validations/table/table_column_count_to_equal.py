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
TableColumnCountToEqual validation implementation
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

logger = test_suite_logger()


@singledispatch
def table_column_count_to_equal(
    runner,
    test_case: TestCase,
    execution_date: Union[datetime, float],
):
    raise NotImplementedError


@table_column_count_to_equal.register
def _(
    runner: QueryRunner,
    test_case: TestCase,
    execution_date: Union[datetime, float],
) -> TestCaseResult:
    """
    Validate row count metric
    :param test_case: TableColumnCountToEqual
    :param table_profile: should contain columnCount metric
    :param execution_date: Datetime when the tests ran
    :return: TestCaseResult with status and results
    """

    try:
        column_count = len(inspect(runner.table).c)

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

    count = next(
        int(param_value.value)
        for param_value in test_case.parameterValues
        if param_value.name == "columnCount"
    )

    status = TestCaseStatus.Success if column_count == count else TestCaseStatus.Failed
    result = f"Found {column_count} columns vs. the expected {count}"

    return TestCaseResult(
        timestamp=execution_date,
        testCaseStatus=status,
        result=result,
        testResultValue=[TestResultValue(name="columnCount", value=str(column_count))],
    )


@table_column_count_to_equal.register
def _(
    runner: DataFrame,
    test_case: TestCase,
    execution_date: Union[datetime, float],
):
    column_count = len(runner.columns)
    count = next(
        int(param_value.value)
        for param_value in test_case.parameterValues
        if param_value.name == "columnCount"
    )

    status = TestCaseStatus.Success if column_count == count else TestCaseStatus.Failed
    result = f"Found {column_count} columns vs. the expected {count}"

    return TestCaseResult(
        timestamp=execution_date,
        testCaseStatus=status,
        result=result,
        testResultValue=[TestResultValue(name="columnCount", value=str(column_count))],
    )
