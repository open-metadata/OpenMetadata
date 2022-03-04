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

from datetime import datetime
from typing import Optional

from sqlalchemy import inspect
from sqlalchemy.orm import DeclarativeMeta, Session

from metadata.generated.schema.entity.data.table import ColumnProfile
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.column.columnValuesToMatchRegex import (
    ColumnValuesToMatchRegex,
)
from metadata.orm_profiler.metrics.core import add_props
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiles.core import Profiler
from metadata.orm_profiler.utils import logger

logger = logger()


def column_values_to_match_regex(
    test_case: ColumnValuesToMatchRegex,
    col_profile: ColumnProfile,
    execution_date: datetime,
    session: Optional[Session] = None,
    table: Optional[DeclarativeMeta] = None,
) -> TestCaseResult:
    """
    Validate Column Values metric
    :param test_case: ColumnValuesToMatchRegex
    :param col_profile: should contain count and distinct count metrics
    :param execution_date: Datetime when the tests ran
    :param session: SQLAlchemy Session, for tests that need to compute new metrics
    :param table: SQLAlchemy Table, for tests that need to compute new metrics
    :return: TestCaseResult with status and results
    """

    like_count = add_props(expression=test_case.regex)(Metrics.LIKE_COUNT.value)

    if not col_profile.valuesCount:
        msg = "We expect `valuesCount` to be informed for ColumnValuesToMatchRegex."
        logger.error(msg)
        return TestCaseResult(
            executionTime=execution_date.timestamp(),
            testCaseStatus=TestCaseStatus.Aborted,
            result=msg,
        )

    try:
        col = next(
            iter([col for col in inspect(table).c if col.name == col_profile.name]),
            None,
        )

        if col is None:
            raise ValueError(
                f"Cannot find the configured column {col_profile.name} for ColumnValuesToMatchRegex"
            )

        res = (
            Profiler(like_count, session=session, table=table, use_cols=[col])
            .execute()
            .column_results
        )
        like_count_res = res.get(col.name)[Metrics.LIKE_COUNT.name]

    except Exception as err:  # pylint: disable=broad-except
        session.rollback()
        msg = f"Error computing ColumnValuesToMatchRegex for {col_profile.name} - {err}"
        logger.error(msg)
        return TestCaseResult(
            executionTime=execution_date.timestamp(),
            testCaseStatus=TestCaseStatus.Aborted,
            result=msg,
        )

    status = (
        TestCaseStatus.Success
        if col_profile.valuesCount == like_count_res
        else TestCaseStatus.Failed
    )
    result = f"Found likeCount={like_count_res} & valuesCount={col_profile.valuesCount}. They should be equal."

    return TestCaseResult(
        executionTime=execution_date.timestamp(), testCaseStatus=status, result=result
    )
