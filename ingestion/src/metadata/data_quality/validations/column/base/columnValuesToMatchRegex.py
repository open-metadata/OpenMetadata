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
Validator for column values to match regex test case
"""

import traceback
from abc import abstractmethod

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

LIKE_COUNT = "likeCount"


class BaseColumnValuesToMatchRegexValidator(BaseTestValidator):
    """Validator for column values to match regex test case"""

    REGEX = "regex"

    def _run_validation(self) -> TestCaseResult:
        """Execute the specific test validation logic

        This method contains the core validation logic that was previously
        in the run_validation method.

        Returns:
            TestCaseResult: The test case result for the overall validation
        """
        test_params = self._get_test_parameters()

        try:
            column: SQALikeColumn | Column = self.get_column()
            count, match_count = self._run_results(
                (Metrics.valuesCount, Metrics.regexCount),
                column,
                expression=test_params[self.REGEX],
            )

            metric_values = {
                Metrics.valuesCount.name: count,
                Metrics.regexCount.name: match_count,
            }

            if self.test_case.computePassedFailedRowCount:
                metric_values[Metrics.rowCount.name] = self.get_row_count()
        except (ValueError, RuntimeError) as exc:
            msg = f"Error computing {self.test_case.fullyQualifiedName}: {exc}"  # type: ignore
            logger.debug(traceback.format_exc())
            logger.error(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [TestResultValue(name=LIKE_COUNT, value=None)],
            )

        evaluation = self._evaluate_test_condition(metric_values, test_params)
        result_message = self._format_result_message(metric_values, test_params=test_params)
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

    def _get_test_parameters(self) -> dict:
        """Extract test-specific parameters from test case

        Returns:
            dict with keys: allowed_values, match_enum
        """

        regex: str = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            self.REGEX,
            str,
        )

        return {
            self.REGEX: regex,
        }

    def _get_metrics_to_compute(self, test_params: dict) -> dict:
        """Define which metrics to compute based on test parameters

        Args:
            test_params: Dictionary with 'allowed_values' and 'match_enum'

        Returns:
            dict: Mapping of Metrics enum names to Metrics enum values
        """
        metrics = {
            Metrics.valuesCount.name: Metrics.valuesCount,
            Metrics.regexCount.name: Metrics.regexCount,
        }

        if self.test_case.computePassedFailedRowCount:
            metrics[Metrics.rowCount.name] = Metrics.rowCount

        return metrics

    def _evaluate_test_condition(self, metric_values: dict, test_params: dict | None = None) -> TestEvaluation:
        """Evaluate the regex match test condition

        Test passes if the values not matching the regex (valuesCount - regexCount) stay
        within the failure threshold. Violations are counted against the non-null values,
        not the table row count: a column that is half NULL and otherwise matches the regex
        must not report half of its rows as failing. With the default threshold, that means
        valuesCount == regexCount.

        Args:
            metric_values: Dictionary with keys from Metrics enum names
                          e.g., {"COUNT": 50, "REGEX_COUNT": 45, "ROW_COUNT": 100}
            test_params: Dictionary with 'regex'. Required for this validator.

        Returns:
            TestEvaluation: TypedDict with keys:
                - matched: bool - whether the non-matching values are within the threshold
                - passed_rows: int - number of values matching the regex
                - failed_rows: int - number of values not matching the regex
                - total_rows: int - total row count for reporting
        """
        if test_params is None:
            raise ValueError("test_params is required for columnValuesToMatchRegex._evaluate_test_condition")
        match_regex_count = metric_values[Metrics.regexCount.name]
        count = metric_values[Metrics.valuesCount.name]
        total_rows = metric_values.get(Metrics.rowCount.name)

        matched = self._apply_row_threshold(count - match_regex_count, count)
        failed_count = count - match_regex_count
        passed_count = match_regex_count

        return {
            "matched": matched,
            "passed_rows": passed_count,
            "failed_rows": failed_count,
            "total_rows": total_rows,
        }

    def _format_result_message(
        self,
        metric_values: dict,
        dimension_info: DimensionInfo | None = None,
        test_params: dict | None = None,
    ) -> str:
        """Format the result message for in-set test

        Args:
            metric_values: Dictionary with Metrics enum names as keys
            dimension_info: Optional DimensionInfo with dimension details
            test_params: Optional test parameters (not used by this validator)

        Returns:
            str: Formatted result message
        """
        match_count = metric_values[Metrics.regexCount.name]
        count = metric_values[Metrics.valuesCount.name]

        if dimension_info:
            return (
                f"Dimension {dimension_info['dimension_name']}={dimension_info['dimension_value']}: "
                f"Found {match_count} value(s) matching regex pattern vs {count} value(s) in the column."
            )
        else:  # noqa: RET505
            return f"Found {match_count} value(s) matching regex pattern vs {count} value(s) in the column."

    def _get_test_result_values(self, metric_values: dict) -> list[TestResultValue]:
        """Get test result values for in-set test

        Args:
            metric_values: Dictionary with Metrics enum names as keys

        Returns:
            List[TestResultValue]: Test result values for the test case
        """
        return [
            TestResultValue(
                name=LIKE_COUNT,
                value=str(metric_values[Metrics.regexCount.name]),
            ),
        ]

    @abstractmethod
    def _run_results(self, metric: Metrics, column: SQALikeColumn | Column, **kwargs):
        raise NotImplementedError

    @abstractmethod
    def compute_row_count(self, column: SQALikeColumn | Column):
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
