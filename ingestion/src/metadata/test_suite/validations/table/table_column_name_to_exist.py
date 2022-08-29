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

import reprlib
import traceback
from datetime import datetime
from typing import List

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


def format_column_list(status: TestCaseStatus, cols: List):
    """Format column list based on the test status

    Args:
        status: status of the test
        cols: list of columns
    """
    if status == TestCaseStatus.Success:
        return reprlib.repr(cols)
    return cols


def table_column_name_to_exist(
    test_case: TestCase,
    execution_date: datetime,
    runner: QueryRunner,
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
            testResultValue=[TestResultValue(name="columnNameExits", value=None)],
        )

    if column_names is None:
        msg = "columnNames should not be None for TableColumnNameToExist"
        logger.error(msg)
        return TestCaseResult(
            executionTime=execution_date,
            testCaseStatus=TestCaseStatus.Aborted,
            result=msg,
            testResultValue=[TestResultValue(name="columnNameExits", value=None)],
        )

    column_name = next(
        param_value.value
        for param_value in test_case.parameterValues
        if param_value.name == "columnName"
    )

    status = (
        TestCaseStatus.Success
        if column_name in {col.name for col in column_names}
        else TestCaseStatus.Failed
    )

    result = f"{column_name} column expected vs {format_column_list(status, [col.name for col in column_names])}"

    return TestCaseResult(
        timestamp=execution_date,
        testCaseStatus=status,
        result=result,
        testResultValue=[TestResultValue(name="columnNameExits", value=str(True))],
    )
