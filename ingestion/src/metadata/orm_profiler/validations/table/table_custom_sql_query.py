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

from sqlalchemy import text
from sqlalchemy.orm import DeclarativeMeta, Session

from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.table.tableCustomSQLQuery import (
    TableCustomSQLQuery,
)
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


def table_custom_sql_query(
    test_case: TableCustomSQLQuery,
    execution_date: datetime,
    session: Session,
    **__,
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

    rows = session.execute(text(test_case.sqlExpression)).all()

    status = TestCaseStatus.Success if not rows else TestCaseStatus.Failed
    result = f"Found {len(rows)} row(s). Test query is expected to return 0 row."

    return TestCaseResult(
        executionTime=execution_date.timestamp(), testCaseStatus=status, result=result
    )
