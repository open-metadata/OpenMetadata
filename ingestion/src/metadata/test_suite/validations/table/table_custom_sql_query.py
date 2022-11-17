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
# pylint: disable=duplicate-code,protected-access

import traceback
from datetime import datetime

from sqlalchemy import text

from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.orm_profiler.profiler.runner import QueryRunner
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


def table_custom_sql_query(
    test_case: TestCase,
    execution_date: datetime,
    runner: QueryRunner,
) -> TestCaseResult:
    """
    Validate custom SQL tests. Tests will fail if number of rows
    returned is not 0

    Args:
        test_case: test case type to be ran. Used to dispatch
        table_profile: table profile results
        execution_date: datetime of the test execution
        session: sqlalchemy session
        table: sqlalchemy declarative meta table
    Returns:
        TestCaseResult with status and results
    """

    sql_expression = next(
        param_value.value
        for param_value in test_case.parameterValues
        if param_value.name == "sqlExpression"
    )

    try:
        rows = runner._session.execute(text(sql_expression)).all()

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
            testResultValue=[TestResultValue(name="resultRowCount", value=None)],
        )

    if not rows:
        status = TestCaseStatus.Success
        result_value = 0
    else:
        status = TestCaseStatus.Failed
        result_value = len(rows)

    result = f"Found {result_value} row(s). Test query is expected to return 0 row."

    return TestCaseResult(
        timestamp=execution_date,
        testCaseStatus=status,
        result=result,
        testResultValue=[
            TestResultValue(name="resultRowCount", value=str(result_value))
        ],
    )
