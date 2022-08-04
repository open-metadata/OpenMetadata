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
from datetime import datetime
from typing import List

from sqlalchemy import inspect
from sqlalchemy.orm import DeclarativeMeta

from metadata.generated.schema.entity.data.table import TableProfile
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import TestDefinition
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


def table_column_name_to_exist(
    test_case: TestCase,
    test_definition: TestDefinition,
    table_profile: TableProfile,
    execution_date: datetime,
    table: DeclarativeMeta,
    **__,
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
    if table is None:
        msg = "columnNames should not be None for TableColumnNameToExist"
        logger.error(msg)
        return TestCaseResult(
            executionTime=execution_date.timestamp(),
            testCaseStatus=TestCaseStatus.Aborted,
            result=msg,
        )

    column_name = next(
        param_value.value
        for param_value in test_case.parameterValues
        if param_value.name == "columnName"
    )

    status = (
        TestCaseStatus.Success
        if column_name in [col.name for col in inspect(table).c]
        else TestCaseStatus.Failed
    )

    result = f"{column_name} column expected vs {format_column_list(status, [col.name for col in inspect(table).c])}"

    return TestCaseResult(
        timestamp=execution_date.timestamp(), testCaseStatus=status, result=result
    )
