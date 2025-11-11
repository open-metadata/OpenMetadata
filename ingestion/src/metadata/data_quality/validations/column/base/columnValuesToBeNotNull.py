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
Validator for column values to be not null test case
"""

import traceback
from abc import abstractmethod
from typing import List, Optional, Union

from sqlalchemy import Column

from metadata.data_quality.validations.base_test_handler import (
    BaseTestValidator,
    DimensionInfo,
    TestEvaluation,
)
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = test_suite_logger()

NULL_COUNT = "nullCount"


class BaseColumnValuesToBeNotNullValidator(BaseTestValidator):
    """Validator for column values to be not null test case"""

    def _run_validation(self) -> TestCaseResult:
        """Execute the specific test validation logic

        This method contains the core validation logic that was previously
        in the run_validation method.

        Returns:
            TestCaseResult: The test case result for the overall validation
        """
        test_params = self._get_test_parameters()

        try:
            column: Union[SQALikeColumn, Column] = self.get_column()
            null_count = self._run_results(Metrics.NULL_COUNT, column)

            metric_values = {
                Metrics.NULL_COUNT.name: null_count,
            }

            if self.test_case.computePassedFailedRowCount:
                metric_values[Metrics.ROW_COUNT.name] = self.get_row_count()
        except (ValueError, RuntimeError) as exc:
            msg = f"Error computing {self.test_case.fullyQualifiedName}: {exc}"  # type: ignore
            logger.debug(traceback.format_exc())
            logger.warning(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [TestResultValue(name=NULL_COUNT, value=None)],
            )

        evaluation = self._evaluate_test_condition(metric_values, test_params)
        result_message = self._format_result_message(
            metric_values, test_params=test_params
        )
        test_result_values = self._get_test_result_values(metric_values)

        return self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(evaluation["matched"]),
            result_message,
            test_result_values,
            row_count=evaluation["total_rows"],
            passed_rows=evaluation["passed_rows"],
            failed_rows=evaluation["failed_rows"],
        )

    def _get_metrics_to_compute(self, test_params: dict) -> dict:
        """Define which metrics to compute based on test parameters

        Args:
            test_params: Dictionary (empty for this validator)

        Returns:
            dict: Mapping of Metrics enum names to Metrics enum values
        """
        metrics = {
            Metrics.NULL_COUNT.name: Metrics.NULL_COUNT,
        }

        if self.test_case.computePassedFailedRowCount:
            metrics[Metrics.ROW_COUNT.name] = Metrics.ROW_COUNT

        return metrics

    def _evaluate_test_condition(
        self, metric_values: dict, test_params: Optional[dict] = None
    ) -> TestEvaluation:
        """Evaluate the not null test condition

        Test passes if null_count == 0 (no null values found)

        Args:
            metric_values: Dictionary with keys from Metrics enum names
                          e.g., {"NULL_COUNT": 0, "ROW_COUNT": 100}
            test_params: Dictionary (not used for this validator)

        Returns:
            TestEvaluation: TypedDict with keys:
                - matched: bool - whether test passed (null_count == 0)
                - passed_rows: int - number of non-null values
                - failed_rows: int - number of null values
                - total_rows: int - total row count for reporting
        """
        null_count = metric_values[Metrics.NULL_COUNT.name]
        total_rows = metric_values.get(Metrics.ROW_COUNT.name)

        matched = null_count == 0
        failed_count = null_count
        passed_count = total_rows - null_count if total_rows else 0

        return {
            "matched": matched,
            "passed_rows": passed_count,
            "failed_rows": failed_count,
            "total_rows": total_rows,
        }

    def _format_result_message(
        self,
        metric_values: dict,
        dimension_info: Optional[DimensionInfo] = None,
        test_params: Optional[dict] = None,
    ) -> str:
        """Format the result message for not null test

        Args:
            metric_values: Dictionary with Metrics enum names as keys
            dimension_info: Optional DimensionInfo with dimension details
            test_params: Optional test parameters (not used by this validator)

        Returns:
            str: Formatted result message
        """
        null_count = metric_values[Metrics.NULL_COUNT.name]

        if dimension_info:
            return (
                f"Dimension {dimension_info['dimension_name']}={dimension_info['dimension_value']}: "
                f"Found nullCount={null_count}. It should be 0"
            )
        else:
            return f"Found nullCount={null_count}. It should be 0"

    def _get_test_result_values(self, metric_values: dict) -> List[TestResultValue]:
        """Get test result values for not null test

        Args:
            metric_values: Dictionary with Metrics enum names as keys

        Returns:
            List[TestResultValue]: Test result values for the test case
        """
        return [
            TestResultValue(
                name=NULL_COUNT,
                value=str(metric_values[Metrics.NULL_COUNT.name]),
            ),
        ]

    @abstractmethod
    def _run_results(self, metric: Metrics, column: Union[SQALikeColumn, Column]):
        raise NotImplementedError

    @abstractmethod
    def compute_row_count(self, column: Union[SQALikeColumn, Column]):
        """Compute row count for the given column

        Args:
            column (Union[SQALikeColumn, Column]): column to compute row count for

        Raises:
            NotImplementedError:
        """
        raise NotImplementedError

    def get_row_count(self) -> int:
        """Get row count

        Returns:
            Tuple[int, int]:
        """
        return self.compute_row_count(self.get_column())
