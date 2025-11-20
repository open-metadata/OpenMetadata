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
Validator for column value missing count to be equal test case
"""

import traceback
from abc import abstractmethod
from ast import literal_eval
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


class BaseColumnValuesMissingCountValidator(BaseTestValidator):
    """Validator for column value missing count to be equal test case"""

    MISSING_VALUE_MATCH = "missingValueMatch"
    MISSING_COUNT_VALUE = "missingCountValue"
    TOTAL_MISSING_COUNT = "total_missing_count"

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
            null_missing_count = self._run_results(
                Metrics.NULL_MISSING_COUNT,
                column,
            )

            metric_values = {
                Metrics.NULL_MISSING_COUNT.name: null_missing_count,
            }

            if test_params.get(self.MISSING_VALUE_MATCH):
                # if user supplies missing values, we need to compute the count of missing values
                # in addition to the count of null values
                count_in_set = self._run_results(
                    Metrics.COUNT_IN_SET,
                    column,
                    values=test_params[self.MISSING_VALUE_MATCH],
                )
                metric_values[Metrics.COUNT_IN_SET.name] = count_in_set
                metric_values[self.TOTAL_MISSING_COUNT] = (
                    null_missing_count + count_in_set
                )
            else:
                metric_values[self.TOTAL_MISSING_COUNT] = null_missing_count

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
        )

    def _get_test_parameters(self) -> dict:
        """Extract test-specific parameters from test case

        Returns:
            dict with keys: MISSING_VALUE_MATCH, MISSING_COUNT_VALUE
        """
        missing_values = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            self.MISSING_VALUE_MATCH,
            literal_eval,
        )

        missing_count_value = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            self.MISSING_COUNT_VALUE,
            literal_eval,
        )

        return {
            self.MISSING_VALUE_MATCH: missing_values,
            self.MISSING_COUNT_VALUE: missing_count_value,
        }

    def _get_metrics_to_compute(self, test_params: dict) -> dict:
        """Define which metrics to compute based on test parameters

        Args:
            test_params: Dictionary with MISSING_VALUE_MATCH and MISSING_COUNT_VALUE

        Returns:
            dict: Mapping of Metrics enum names to Metrics enum values
        """
        metrics = {
            Metrics.NULL_MISSING_COUNT.name: Metrics.NULL_MISSING_COUNT,
        }

        if test_params.get(self.MISSING_VALUE_MATCH):
            metrics[Metrics.COUNT_IN_SET.name] = Metrics.COUNT_IN_SET

        return metrics

    def _evaluate_test_condition(
        self, metric_values: dict, test_params: Optional[dict] = None
    ) -> TestEvaluation:
        """Evaluate the missing count test condition

        Test passes if total_missing_count == expected missing_count_value

        Args:
            metric_values: Dictionary with keys from Metrics enum names
                          e.g., {"NULL_MISSING_COUNT": 5, "COUNT_IN_SET": 3}
            test_params: Dictionary with MISSING_VALUE_MATCH and MISSING_COUNT_VALUE

        Returns:
            TestEvaluation: TypedDict with keys:
                - matched: bool - whether test passed
                - passed_rows: None - not computed for this validator
                - failed_rows: None - not computed for this validator
                - total_rows: None - not computed for this validator
        """
        if test_params is None:
            raise ValueError(
                "test_params is required for columnValuesMissingCount._evaluate_test_condition"
            )

        total_missing_count = metric_values[self.TOTAL_MISSING_COUNT]
        expected_missing_count = test_params[self.MISSING_COUNT_VALUE]

        matched = total_missing_count == expected_missing_count

        return {
            "matched": matched,
            "passed_rows": None,
            "failed_rows": None,
            "total_rows": None,
        }

    def _format_result_message(
        self,
        metric_values: dict,
        dimension_info: Optional[DimensionInfo] = None,
        test_params: Optional[dict] = None,
    ) -> str:
        """Format the result message for missing count test

        Args:
            metric_values: Dictionary with Metrics enum names as keys
            dimension_info: Optional DimensionInfo with dimension details
            test_params: Optional test parameters with expected MISSING_COUNT_VALUE

        Returns:
            str: Formatted result message
        """
        if test_params is None:
            raise ValueError(
                "test_params is required for columnValuesMissingCount._format_result_message"
            )

        total_missing_count = metric_values[self.TOTAL_MISSING_COUNT]
        expected_missing_count = test_params[self.MISSING_COUNT_VALUE]

        if dimension_info:
            return (
                f"Dimension {dimension_info['dimension_name']}={dimension_info['dimension_value']}: "
                f"Found nullCount={total_missing_count} vs. the expected nullCount={expected_missing_count}."
            )
        else:
            return f"Found nullCount={total_missing_count} vs. the expected nullCount={expected_missing_count}."

    def _get_test_result_values(self, metric_values: dict) -> List[TestResultValue]:
        """Get test result values for missing count test

        Args:
            metric_values: Dictionary with Metrics enum names as keys

        Returns:
            List[TestResultValue]: Test result values for the test case
        """
        return [
            TestResultValue(
                name=NULL_COUNT,
                value=str(metric_values[self.TOTAL_MISSING_COUNT]),
            ),
        ]

    @abstractmethod
    def _run_results(
        self, metric: Metrics, column: Union[SQALikeColumn, Column], **kwargs
    ):
        raise NotImplementedError
