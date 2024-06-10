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
Validator for column value length to be between test case
"""

import traceback
from abc import abstractmethod
from typing import Tuple, Union

from sqlalchemy import Column

from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = test_suite_logger()

MIN = "minValueLength"
MAX = "maxValueLength"


class BaseColumnValueLengthsToBeBetweenValidator(BaseTestValidator):
    """Validator for column value length to be between test case"""

    def run_validation(self) -> TestCaseResult:
        """Run validation for the given test case

        Returns:
            TestCaseResult:
        """
        try:
            column: Union[SQALikeColumn, Column] = self._get_column_name()
            max_res = self._run_results(Metrics.MAX_LENGTH, column)
            min_res = self._run_results(Metrics.MIN_LENGTH, column)
        except (ValueError, RuntimeError) as exc:
            msg = f"Error computing {self.test_case.fullyQualifiedName}: {exc}"  # type: ignore
            logger.debug(traceback.format_exc())
            logger.warning(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [
                    TestResultValue(name=MIN, value=None),
                    TestResultValue(name=MAX, value=None),
                ],
            )

        min_bound = self.get_min_bound("minLength")
        max_bound = self.get_max_bound("maxLength")

        if self.test_case.computePassedFailedRowCount:
            row_count, failed_rows = self.compute_row_count(
                column, min_bound, max_bound
            )
        else:
            row_count, failed_rows = None, None

        return self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(min_bound <= min_res and max_bound >= max_res),
            f"Found minLength={min_res}, maxLength={max_res} vs. the expected "
            "minLength={min_bound}, maxLength={max_bound}.",
            [
                TestResultValue(name=MIN, value=str(min_res)),
                TestResultValue(name=MAX, value=str(max_res)),
            ],
            row_count=row_count,
            failed_rows=failed_rows,
            min_bound=min_bound,
            max_bound=max_bound,
        )

    @abstractmethod
    def _get_column_name(self):
        raise NotImplementedError

    @abstractmethod
    def _run_results(self, metric: Metrics, column: Union[SQALikeColumn, Column]):
        raise NotImplementedError

    @abstractmethod
    def compute_row_count(
        self, column: Union[SQALikeColumn, Column], min_bound, max_bound
    ):
        """Compute row count for the given column

        Args:
            column (Union[SQALikeColumn, Column]): column to compute row count for
            min_bound (_type_): min bound to filter out rows within the bound
            max_bound (_type_): max bound to filter out rows within the bound

        Raises:
            NotImplementedError:
        """
        raise NotImplementedError

    def get_row_count(self, min_bound, max_bound) -> Tuple[int, int]:
        """Get row count

        Args:
            min_bound (_type_): min bound to filter out rows within the bound
            max_bound (_type_): max bound to filter out rows within the bound

        Returns:
            Tuple[int, int]:
        """
        return self.compute_row_count(self._get_column_name(), min_bound, max_bound)
