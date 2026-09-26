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

from sqlalchemy import Column

from metadata.data_quality.validations import result_messages
from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_TOTAL_COUNT_KEY,
    BaseTestValidator,
    DimensionInfo,
    DimensionResult,
    TestEvaluation,
)
from metadata.data_quality.validations.checkers.between_bounds_checker import (
    BetweenBoundsChecker,
)
from metadata.data_quality.validations.result_messages import SamplingStability
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.orm.registry import is_date_time
from metadata.utils.logger import test_suite_logger
from metadata.utils.sqa_like_column import SQALikeColumn
from metadata.utils.time_utils import convert_timestamp, utc_from_timestamp

logger = test_suite_logger()

MIN = "min"
MAX = "max"


class BaseColumnValuesToBeBetweenValidator(BaseTestValidator):
    """Validator for column values to be between test case"""

    SAMPLING_STABILITY = SamplingStability.BIASED_INWARD

    MIN_BOUND = "minValue"
    MAX_BOUND = "maxValue"

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
            min_res = self._run_results(Metrics.min, column)
            max_res = self._run_results(Metrics.max, column)

            min_res = self._normalize_metric_value(min_res, is_min=True)
            max_res = self._normalize_metric_value(max_res, is_min=False)

            metric_values = {
                Metrics.min.name: min_res,
                Metrics.max.name: max_res,
            }

            if self._needs_violation_count():
                # The counts go under the same two keys a dimension row carries its own under:
                # the verdict and the message are read off `metric_values` by code shared with
                # the dimensional path, which only finds them by those names.
                total_rows, violating_rows = self._run_violation_count(column, test_params)
                metric_values[DIMENSION_TOTAL_COUNT_KEY] = total_rows
                metric_values[DIMENSION_FAILED_COUNT_KEY] = violating_rows
        except (ValueError, RuntimeError) as exc:
            msg = f"Error computing {self.test_case.fullyQualifiedName}: {exc}"  # type: ignore
            logger.debug(traceback.format_exc())
            logger.error(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [
                    TestResultValue(name=MIN, value=None),
                    TestResultValue(name=MAX, value=None),
                ],
            )

        # A row tolerance already counted both, so report the counts the verdict was taken on
        # rather than counting twice: a second scan reads the table again -- or, on a percentage
        # sample, a different set of rows -- and could report rows that contradict the status.
        row_count = metric_values.get(DIMENSION_TOTAL_COUNT_KEY)
        failed_rows = metric_values.get(DIMENSION_FAILED_COUNT_KEY)

        if failed_rows is None and self.test_case.computePassedFailedRowCount:
            row_count, failed_rows = self.compute_row_count(
                column, test_params[self.MIN_BOUND], test_params[self.MAX_BOUND]
            )

        evaluation = self._evaluate_test_condition(metric_values, test_params)
        result_message = self._format_result_message(metric_values, test_params=test_params)
        test_result_values = self._get_test_result_values(metric_values)

        return self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(evaluation["matched"]),
            result_message,
            test_result_values,
            row_count=row_count,
            failed_rows=failed_rows,
            min_bound=test_params[self.MIN_BOUND]
            if not isinstance(test_params[self.MIN_BOUND], (datetime, date))
            else None,
            max_bound=test_params[self.MAX_BOUND]
            if not isinstance(test_params[self.MAX_BOUND], (datetime, date))
            else None,
        )

    def _get_test_parameters(self) -> dict:
        """Get Test Parameters

        The window is left exactly as the test case configured it. This test reads every row,
        so its failure threshold is a row tolerance -- it is spent on how many values may fall
        outside the window, not on widening the window itself. Widening here as well would
        apply the same tolerance twice.
        """
        column = self.get_column()

        if is_date_time(column.type):
            min_bound = self.get_test_case_param_value(
                self.test_case.parameterValues,  # type: ignore
                self.MIN_BOUND,
                type_=utc_from_timestamp,
                default=datetime.min,
                pre_processor=convert_timestamp,
            )

            max_bound = self.get_test_case_param_value(
                self.test_case.parameterValues,  # type: ignore
                self.MAX_BOUND,
                type_=utc_from_timestamp,
                default=datetime.max,
                pre_processor=convert_timestamp,
            )
        else:
            min_bound = self.get_min_bound(self.MIN_BOUND)
            max_bound = self.get_max_bound(self.MAX_BOUND)

        return {
            self.MIN_BOUND: min_bound,
            self.MAX_BOUND: max_bound,
        }

    def _get_metrics_to_compute(self, test_params: dict | None = None) -> dict:
        """Get Metrics needed to compute

        The out-of-range rows a tolerance is counted against are not a registry metric -- there
        is no aggregate that answers "how many values fall outside this window". They are built
        from the bounds by `BetweenBoundsChecker` instead, in `_run_violation_count()` for the
        overall result and in `_execute_dimensional_validation()` for each dimension row.
        """
        return {Metrics.min.name: Metrics.min, Metrics.max.name: Metrics.max}

    def _needs_violation_count(self) -> bool:
        """Whether the rows outside the window have to be counted

        Only a configured tolerance needs the count: with no tolerance, one value outside the
        window and a MIN/MAX outside it are the same verdict, and counting would cost a query
        nobody reads.
        """
        return bool(self.get_failure_threshold().value)

    def _has_violation_count(self, metric_values: dict) -> bool:
        """Whether this result was decided by counting rows rather than by MIN/MAX

        The dimensional query counts violations for every test case, tolerance or not, so the
        count alone does not mean a row tolerance applies. Without one the two agree anyway.
        """
        return self._needs_violation_count() and metric_values.get(DIMENSION_FAILED_COUNT_KEY) is not None

    def _evaluate_test_condition(self, metric_values: dict, test_params: dict) -> TestEvaluation:
        """Evaluate the values-to-be-between test condition

        Without a tolerance the verdict is read off MIN/MAX: both extremes inside the window
        means every value is. That cannot answer "how many rows are out of range", which is
        what a row tolerance is checked against, so a test case that configures one is decided
        on the counted violations instead.

        Args:
            metric_values: Dictionary with keys from Metrics enum names
                            e.g., {"MIN": 10, "MAX": 100}
                            With a row tolerance, and for every dimension row, also includes:
                            - DIMENSION_TOTAL_COUNT_KEY: rows evaluated
                            - DIMENSION_FAILED_COUNT_KEY: rows outside the window
            test_params: Dictionary with 'minValue' and 'maxValue'

        Returns:
            dict with keys:
                - matched: bool - whether test passed
                - passed_rows: Optional[int] - rows inside the window, when counted
                - failed_rows: Optional[int] - rows outside the window, when counted
                - total_rows: Optional[int] - rows evaluated, when counted
        """

        min_value = metric_values[Metrics.min.name]
        max_value = metric_values[Metrics.max.name]
        min_bound = test_params[self.MIN_BOUND]
        max_bound = test_params[self.MAX_BOUND]

        total_rows = metric_values.get(DIMENSION_TOTAL_COUNT_KEY)
        failed_rows = metric_values.get(DIMENSION_FAILED_COUNT_KEY)

        if self._has_violation_count(metric_values):
            matched = self._apply_row_threshold(failed_rows, total_rows)
        else:
            matched = min_value >= min_bound and max_value <= max_bound

        passed_rows = total_rows - failed_rows if (total_rows is not None and failed_rows is not None) else None

        return {
            "matched": matched,
            "passed_rows": passed_rows,
            "failed_rows": failed_rows,
            "total_rows": total_rows,
        }

    def _format_result_message(
        self,
        metric_values: dict,
        dimension_info: DimensionInfo | None = None,
        test_params: dict | None = None,
    ) -> str:
        """Format the result message for values-to-be-between test

        Args:
            metric_values: Dictionary with Metrics enum names as keys
            dimension_info: Optional DimensionInfo with dimension details
            test_params: Test parameters with min/max bounds. Required for this test.

        Returns:
            str: Formatted result message
        """
        if test_params is None:
            raise ValueError("test_params is required for columnValuesToBeBetween._format_result_message")

        min_value = metric_values[Metrics.min.name]
        max_value = metric_values[Metrics.max.name]
        min_bound = test_params[self.MIN_BOUND]
        max_bound = test_params[self.MAX_BOUND]

        matched = self._matched(metric_values, test_params)
        column = self.column_label()

        if self._has_violation_count(metric_values):
            # A row tolerance is a verdict on rows, so the message leads with the count it was
            # checked against and keeps the window and its extremes as context.
            counted = self.format_violation_message(
                violations=metric_values.get(DIMENSION_FAILED_COUNT_KEY),
                population=metric_values.get(DIMENSION_TOTAL_COUNT_KEY),
                violation_noun=f"values in {column} outside the expected range",
                matched=matched,
                dimension_info=dimension_info,
            )
            return (
                f"{counted} Expected {result_messages.bounds_phrase(min_bound, max_bound)}, "
                f"with a minimum of {result_messages.format_value(min_value)} and a maximum of "
                f"{result_messages.format_value(max_value)}."
            )

        # Both extremes are checked against the same window, so the message reports both and
        # states the verdict once, on the pair.
        return self.format_statistic_message(
            f"Minimum of {column} is {result_messages.format_value(min_value)} and its maximum",
            max_value,
            (min_bound, max_bound),
            matched,
            dimension_info,
        )

    def _get_test_result_values(self, metric_values: dict) -> list[TestResultValue]:
        """Get test result values for values-to-be-between test

        Args:
            metric_values: Dictionary with Metrics enum names as keys

        Returns:
            List[TestResultValue]: Test result values for the test case
        """
        return [
            TestResultValue(name=MIN, value=str(metric_values[Metrics.min.name])),
            TestResultValue(name=MAX, value=str(metric_values[Metrics.max.name])),
        ]

    def _get_validation_checker(self, test_params: dict) -> BetweenBoundsChecker:
        """Get the validation checker for this test

        Args:
            test_params: Test parameters including min and max bounds

        Returns:
            BetweenBoundsChecker configured with the test bounds
        """
        return BetweenBoundsChecker(
            min_bound=test_params[self.MIN_BOUND],
            max_bound=test_params[self.MAX_BOUND],
        )

    @abstractmethod
    def _execute_dimensional_validation(
        self,
        column: SQALikeColumn | Column,
        dimension_col: SQALikeColumn | Column,
        metrics_to_compute: dict,
        test_params: dict,
        top_n: int,
    ) -> list[DimensionResult]:
        """Execute dimensional validation query for a single dimension column

        Args:
            column: The column being tested (e.g., revenue)
            dimension_col: The dimension column to group by (e.g., region)
            metrics_to_compute: Dict mapping metric names to Metrics enum values
            test_params: Test parameters including min and max bounds
            top_n: Number of top dimension values before grouping as "Others"

        Returns:
            List of DimensionResult objects for each dimension value
        """
        raise NotImplementedError

    @abstractmethod
    def _run_results(self, metric: Metrics, column: SQALikeColumn | Column):
        raise NotImplementedError

    @abstractmethod
    def _run_violation_count(self, column: SQALikeColumn | Column, test_params: dict) -> tuple[int | None, int | None]:
        """Count the rows read and the ones whose value falls outside the window

        Both halves are built by `BetweenBoundsChecker` so the SQL and the pandas engines
        count the same rows: a NULL is not a violation, and an unset bound excludes nothing.

        Args:
            column: the column under test
            test_params: test parameters including min and max bounds

        Returns:
            tuple[int | None, int | None]: rows evaluated, rows outside the window
        """
        raise NotImplementedError

    @abstractmethod
    def compute_row_count(self, column: SQALikeColumn | Column, min_bound, max_bound):
        """Compute row count for the given column

        Args:
            column (Union[SQALikeColumn, Column]): column to compute row count for
            min_bound (_type_): min bound to filter out rows within the bound
            max_bound (_type_): max bound to filter out rows within the bound

        Raises:
            NotImplementedError:
        """
        raise NotImplementedError

    def get_row_count(self, min_bound, max_bound) -> tuple[int, int]:
        """Get row count

        Args:
            min_bound (_type_): min bound to filter out rows within the bound
            max_bound (_type_): max bound to filter out rows within the bound

        Returns:
            Tuple[int, int]:
        """
        return self.compute_row_count(self.get_column(), min_bound, max_bound)

    def _normalize_metric_value(self, value, is_min: bool):
        """Normalize metric value - convert date to datetime if needed"""
        if type(value) is date:
            return datetime.combine(value, time.min if is_min else time.max)
        return value
