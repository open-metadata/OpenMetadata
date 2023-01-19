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
TableRowInsertedCountToBeBetween validation implementation
"""

import traceback
from datetime import datetime
from functools import singledispatch
from typing import List, Optional, Union, cast

from pandas import DataFrame
from sqlalchemy import Column, text

from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiler.runner import QueryRunner
from metadata.utils.logger import test_suite_logger
from metadata.utils.sqa_utils import (
    dispatch_to_date_or_datetime,
    get_partition_col_type,
)
from metadata.utils.test_suite import build_test_case_result, get_test_case_param_value

logger = test_suite_logger()


@singledispatch
def table_row_inserted_count_to_be_between(
    runner,
    test_case: TestCase,
    execution_date: Union[datetime, float],
):
    raise NotImplementedError


@table_row_inserted_count_to_be_between.register
def _(
    runner: QueryRunner,
    test_case: TestCase,
    execution_date: Union[datetime, float],
) -> TestCaseResult:
    """_summary_

    Args:
        runner (QueryRunner): _description_
        test_case (TestCase): _description_
        execution_date (Union[datetime, float]): _description_

    Returns:
        TestCaseResult: _description_
    """
    parameter_values = test_case.parameterValues
    parameter_values = cast(List[TestCaseParameterValue], parameter_values)
    column_name: Optional[Column] = get_test_case_param_value(
        parameter_values,
        "columnName",
        Column,
    )
    range_type: Optional[str] = get_test_case_param_value(
        parameter_values,
        "rangeType",
        str,
    )
    range_interval: Optional[int] = get_test_case_param_value(
        parameter_values,
        "rangeInterval",
        int,
    )

    if any(var is None for var in [column_name, range_type, range_interval]):
        result = f"Error computing {test_case.name} for {runner.table.__tablename__}: No value found for columnName, rangeType or rangeInterval"
        logger.debug(traceback.format_exc())
        logger.warning(result)
        return build_test_case_result(
            execution_date,
            TestCaseStatus.Aborted,
            result,
            [TestResultValue(name="rowCount", value=None)],
            sample_data=None,
        )

    try:
        date_or_datetime_fn = dispatch_to_date_or_datetime(
            range_interval,
            text(range_type),
            get_partition_col_type(column_name.name, runner.table.__table__.c),
        )

        row_count_dict = dict(
            runner.dispatch_query_select_first(
                Metrics.ROW_COUNT.value().fn(),
                query_filter_={
                    "filters": [(column_name, "ge", date_or_datetime_fn)],
                    "or_filter": False,
                },
            )
        )
        row_count_value = row_count_dict.get(Metrics.ROW_COUNT.name)
    except Exception as exc:
        result = (
            f"Error computing {test_case.name} for {runner.table.__tablename__}: {exc}"
        )
        logger.debug(traceback.format_exc())
        logger.warning(result)
        return build_test_case_result(
            execution_date,
            TestCaseStatus.Aborted,
            result,
            [TestResultValue(name="rowCount", value=None)],
            sample_data=None,
        )

    min_: Union[int, float] = get_test_case_param_value(
        parameter_values,
        "min",
        int,
        float("-inf"),
    )
    max_: Union[int, float] = get_test_case_param_value(
        parameter_values,
        "max",
        int,
        float("inf"),
    )

    status = (
        TestCaseStatus.Success
        if min_ <= row_count_value <= max_
        else TestCaseStatus.Failed
    )
    result = f"Found {row_count_value} rows vs. the expected range [{min_}, {max_}]."
    return build_test_case_result(
        execution_date,
        status,
        result,
        [TestResultValue(name="rowCount", value=str(row_count_value))],
        sample_data=None,
    )


@table_row_inserted_count_to_be_between.register
def _(runner: DataFrame, test_case: TestCase, execution_date: Union[datetime, float]):
    result = "Test is currently not supported for datalake sources."
    return build_test_case_result(
        execution_date,
        TestCaseStatus.Aborted,
        result,
        [TestResultValue(name="rowCount", value=None)],
        sample_data=None,
    )
