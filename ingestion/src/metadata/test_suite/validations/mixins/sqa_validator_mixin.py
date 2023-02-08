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
Validator Mixin for SQA tests cases
"""

from datetime import datetime
import reprlib
from typing import Any, Callable, List, Optional, Union, TypeVar

from sqlalchemy import Column

from metadata.orm_profiler.metrics.core import add_props

from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.testCase import TestCaseParameterValue
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.orm_profiler.profiler.runner import QueryRunner
from metadata.utils.entity_link import get_decoded_column
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()

T = TypeVar("T", bound=Callable)
R = TypeVar("R")

class SQAValidatorMixin:
    """Validatori mixin for SQA test cases"""    
    def get_column_name(self, entity_link: str, columns: List) -> Column:
        """Given a column name get the column object

        Args:
            column_name (str): Column name
        Returns:
            Column: Column object
        """
        column = get_decoded_column(entity_link)
        column_obj = next(
            (col for col in columns if col.name == column),
            None,
        )
        if column_obj is None:
            raise ValueError(
                f"Cannot find column {column}"
            )
        return column_obj

    def get_test_case_result_object(
        self,
        execution_date: Union[datetime, float],
        status: TestCaseStatus,
        result: str,
        test_result_value: List[TestResultValue],
    ) -> TestCaseResult:
        """Returns a TestCaseResult object with the given args

        Args:
            execution_date (Union[datetime, float]): test case execution datetime
            status (TestCaseStatus): failed, success, aborted
            result (str): test case result
            test_result_value (List[TestResultValue]): test result value to display in UI
        Returns:
            TestCaseResult:
        """    
        return TestCaseResult(
            timestamp=execution_date,  # type: ignore
            testCaseStatus=status,
            result=result,
            testResultValue=test_result_value,
            sampleData=None,
        )

    def get_test_case_param_value(
        self,
        test_case_param_vals: list[TestCaseParameterValue],
        name: str,
        type_: T,
        default: Optional[R] = None,
        pre_processor: Optional[Callable] = None,
    ) -> Optional[Union[R,T]]:
        """Give a column and a type return the value with the appropriate type casting for the
        test case definition.

        Args:
            test_case: the test case
            type_ (Union[float, int, str]): type for the value
            name (str): column name
            default (_type_, optional): Default value to return if column is not found
            pre_processor: pre processor function/type to use against the value before casting to type_
        """
        value = next(
            (param.value for param in test_case_param_vals if param.name == name), None
        )

        if not value and default is not None:
            return default

        if not value and default is None:
            return None

        if not pre_processor:
            return type_(value)

        pre_processed_value = pre_processor(value)
        return type_(pre_processed_value)

    def run_query_results(
        self,
        runner: QueryRunner,
        metric: Metrics,
        column: Optional[Column] = None,
        **kwargs: Optional[Any],
    ):
        """Run the metric query agains the column

        Args:
            runner (QueryRunner): runner object witj sqlalchemy session object
            metric (Metrics): metric object
            column (Column): column object
            props_ (Optional[Any], optional): props to pass to metric object at runtime. Defaults to None.

        Raises:
            ValueError: error if no value is returned

        Returns:
            Any: value returned by the metric query
        """
        metric_obj = add_props(**kwargs)(metric.value) if kwargs else metric.value
        metric_fn = metric_obj(column).fn() if column is not None else metric_obj().fn()

        value = dict(
            runner.dispatch_query_select_first(metric_fn)  # type: ignore
        )

        res = value.get(metric.name)
        if res is None:
            raise ValueError(
                f"Query on table/column {column.name if column else ''} returned None"
            )

        return res

    def format_column_list(self, status: TestCaseStatus, cols: List):
        """Format column list based on the test status

        Args:
            cols: list of columns
        """
        if status == TestCaseStatus.Success:
            return reprlib.repr(cols)
        return cols
