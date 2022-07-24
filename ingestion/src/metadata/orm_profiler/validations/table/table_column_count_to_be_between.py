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

from datetime import datetime

from metadata.generated.schema.entity.data.table import TableProfile
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.table.tableColumnCountToBeBetween import (
    TableColumnCountToBeBetween,
)
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


def table_column_count_to_be_between(
    test_case: TableColumnCountToBeBetween,
    table_profile: TableProfile,
    execution_date: datetime,
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

    if table_profile.columnCount is None:
        msg = "columnCount should not be None for TableColumnCountToBeBetween"
        logger.error(msg)
        return TestCaseResult(
            executionTime=execution_date.timestamp(),
            testCaseStatus=TestCaseStatus.Aborted,
            result=msg,
        )

    status = (
        TestCaseStatus.Success
        if test_case.minColValue <= table_profile.columnCount <= test_case.maxColValue
        else TestCaseStatus.Failed
    )
    result = f"Found {table_profile.columnCount} column vs. the expected range [{test_case.minColValue}, {test_case.maxColValue}]."

    return TestCaseResult(
        executionTime=execution_date.timestamp(), testCaseStatus=status, result=result
    )
