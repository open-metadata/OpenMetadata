#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Validator for column values to be between test case
"""

import traceback
from abc import abstractmethod
from datetime import date, datetime, time
from typing import Tuple, Union

from sqlalchemy import Column

from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.orm.registry import is_date_time
from metadata.utils.logger import test_suite_logger
from metadata.utils.sqa_like_column import SQALikeColumn
from metadata.utils.time_utils import convert_timestamp

logger = test_suite_logger()

MIN = "min"
MAX = "max"


class BaseColumnValuesToBeBetweenValidator(BaseTestValidator):
    """Validator for column values to be between test case"""

    def _convert_date_to_datetime(
        self, date_object: date, time_converter: time
    ) -> datetime:
        """Convert date object to datetime object

        Args:
            date_object (date): date object
            time_converter (time): time converter to use one of time.min or time.max

        Returns:
            datetime:
        """
        return datetime.combine(date_object, time_converter)

    def run_validation(self) -> TestCaseResult:
        """Run validation for the given test case

        Returns:
            TestCaseResult:
        """
        try:
            column: Union[SQALikeColumn, Column] = self._get_column_name()
            min_res = self._run_results(Metrics.MIN, column)
            max_res = self._run_results(Metrics.MAX, column)
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

        if type(min_res) is date:  # pylint: disable=unidiomatic-typecheck
            min_res = self._convert_date_to_datetime(min_res, time.min)
        if type(max_res) is date:  # pylint: disable=unidiomatic-typecheck
            max_res = self._convert_date_to_datetime(max_res, time.max)

        if is_date_time(column.type):
            min_bound = self.get_test_case_param_value(
                self.test_case.parameterValues,  # type: ignore
                "minValue",
                type_=datetime.fromtimestamp,
                default=datetime.min,
                pre_processor=convert_timestamp,
            )

            max_bound = self.get_test_case_param_value(
                self.test_case.parameterValues,  # type: ignore
                "maxValue",
                type_=datetime.fromtimestamp,
                default=datetime.max,
                pre_processor=convert_timestamp,
            )
        else:
            min_bound = self.get_min_bound("minValue")
            max_bound = self.get_max_bound("maxValue")

        if self.test_case.computePassedFailedRowCount:
            row_count, failed_rows = self.get_row_count(min_bound, max_bound)
        else:
            row_count, failed_rows = None, None

        return self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(min_res >= min_bound and max_res <= max_bound),
            f"Found min={min_res}, max={max_res} vs. the expected min={min_bound}, max={max_bound}.",
            [
                TestResultValue(name=MIN, value=str(min_res)),
                TestResultValue(name=MAX, value=str(max_res)),
            ],
            row_count=row_count,
            failed_rows=failed_rows,
            min_bound=min_bound
            if not isinstance(min_bound, (datetime, date))
            else None,
            max_bound=max_bound
            if not isinstance(min_bound, (datetime, date))
            else None,
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
