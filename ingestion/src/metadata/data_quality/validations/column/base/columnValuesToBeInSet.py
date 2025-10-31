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
Validator for column value to be in set test case
"""

import traceback
from abc import abstractmethod
from ast import literal_eval
from typing import List, Optional, Union

from sqlalchemy import Column

from metadata.data_quality.validations import utils
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
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = test_suite_logger()

ALLOWED_VALUE_COUNT = "allowedValueCount"


class BaseColumnValuesToBeInSetValidator(BaseTestValidator):
    """Validator for column value to be in set test case"""

    def _get_test_parameters(self) -> dict:
        """Extract test-specific parameters from test case

        Returns:
            dict with keys: allowed_values, match_enum
        """
        allowed_values = self.get_test_case_param_value(
            self.test_case.parameterValues,
            "allowedValues",
            literal_eval,
        )
        match_enum = utils.get_bool_test_case_param(
            self.test_case.parameterValues, "matchEnum"
        )

        return {
            "allowed_values": allowed_values,
            "match_enum": match_enum,
        }

    def _get_metrics_to_compute(self, test_params: dict) -> dict:
        """Define which metrics to compute based on test parameters

        Args:
            test_params: Dictionary with 'allowed_values' and 'match_enum'

        Returns:
            dict: Mapping of Metrics enum names to Metrics enum values
        """
        metrics = {
            Metrics.COUNT_IN_SET.name: Metrics.COUNT_IN_SET,
        }

        if test_params["match_enum"]:
            metrics[Metrics.ROW_COUNT.name] = Metrics.ROW_COUNT

        return metrics

    def _evaluate_test_condition(
        self, metric_values: dict, test_params: Optional[dict] = None
    ) -> TestEvaluation:
        """Evaluate the in-set test condition

        For in-set test, behavior depends on match_enum flag:
        - match_enum=False: Pass if at least one value is in the set (count_in_set > 0)
        - match_enum=True: Pass if ALL values are in the set (row_count - count_in_set == 0)

        Args:
            metric_values: Dictionary with keys from Metrics enum names
                          e.g., {"COUNT_IN_SET": 50, "ROW_COUNT": 100}
            test_params: Dictionary with 'allowed_values' and 'match_enum'.
                        Required for this validator.

        Returns:
            TestEvaluation: TypedDict with keys:
                - matched: bool - whether test passed
                - passed_rows: int - number of values in set
                - failed_rows: int - number of values not in set (0 if not match_enum)
                - total_rows: int - total row count for reporting
        """
        if test_params is None:
            raise ValueError(
                "test_params is required for columnValuesToBeInSet._evaluate_test_condition"
            )
        count_in_set = metric_values[Metrics.COUNT_IN_SET.name]
        match_enum = test_params["match_enum"]

        if match_enum:
            row_count = metric_values.get(Metrics.ROW_COUNT.name, 0)
            failed_count = row_count - count_in_set
            matched = failed_count == 0
            total_rows = row_count
        else:
            matched = count_in_set > 0
            failed_count = 0
            total_rows = count_in_set

        return {
            "matched": matched,
            "passed_rows": count_in_set,
            "failed_rows": failed_count,
            "total_rows": total_rows,
        }

    def _format_result_message(
        self,
        metric_values: dict,
        dimension_info: Optional[DimensionInfo] = None,
        test_params: Optional[dict] = None,
    ) -> str:
        """Format the result message for in-set test

        Args:
            metric_values: Dictionary with Metrics enum names as keys
            dimension_info: Optional DimensionInfo with dimension details
            test_params: Optional test parameters (not used by this validator)

        Returns:
            str: Formatted result message
        """
        count_in_set = metric_values[Metrics.COUNT_IN_SET.name]

        if dimension_info:
            return (
                f"Dimension {dimension_info['dimension_name']}={dimension_info['dimension_value']}: "
                f"Found countInSet={count_in_set}"
            )
        else:
            return f"Found countInSet={count_in_set}."

    def _get_test_result_values(self, metric_values: dict) -> List[TestResultValue]:
        """Get test result values for in-set test

        Args:
            metric_values: Dictionary with Metrics enum names as keys

        Returns:
            List[TestResultValue]: Test result values for the test case
        """
        return [
            TestResultValue(
                name=ALLOWED_VALUE_COUNT,
                value=str(metric_values[Metrics.COUNT_IN_SET.name]),
            ),
        ]

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
            count_in_set = self._run_results(
                Metrics.COUNT_IN_SET, column, values=test_params["allowed_values"]
            )

            metric_values = {
                Metrics.COUNT_IN_SET.name: count_in_set,
            }

            if test_params["match_enum"]:
                row_count = self._run_results(
                    Metrics.ROW_COUNT, column, values=test_params["allowed_values"]
                )
                metric_values[Metrics.ROW_COUNT.name] = row_count

        except (ValueError, RuntimeError) as exc:
            msg = f"Error computing {self.test_case.fullyQualifiedName}: {exc}"  # type: ignore
            logger.debug(traceback.format_exc())
            logger.warning(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [TestResultValue(name=ALLOWED_VALUE_COUNT, value=None)],
            )

        evaluation = self._evaluate_test_condition(metric_values, test_params)
        result_message = self._format_result_message(
            metric_values, test_params=test_params
        )
        test_result_values = self._get_test_result_values(metric_values)

        if self.test_case.computePassedFailedRowCount:
            row_count = self.get_row_count()
        else:
            row_count = None

        return self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(evaluation["matched"]),
            result_message,
            test_result_values,
            row_count=row_count,
            passed_rows=evaluation["passed_rows"],
        )

    def _create_dimension_result(
        self,
        row: dict,
        dimension_col_name: str,
        metric_values: dict,
        evaluation: TestEvaluation,
        test_params: Optional[dict] = None,
    ) -> DimensionResult:
        """Override to handle match_enum-specific impact score logic

        For columnValuesToBeInSet test, impact score is only meaningful in enum mode
        (match_enum=True) where we validate that ALL values are in the set. In non-enum
        mode (match_enum=False), we only check if AT LEAST ONE value is in the set, so
        impact scoring doesn't apply.

        Args:
            row: Result row from dimensional query
            dimension_col_name: Name of the dimension column
            metric_values: Computed metric values
            evaluation: Test evaluation result from _evaluate_test_condition
            test_params: Test parameters including match_enum flag

        Returns:
            DimensionResult: Formatted dimension result with correct impact score
        """
        # Call parent implementation to create the dimension result
        dimension_result = super()._create_dimension_result(
            row, dimension_col_name, metric_values, evaluation, test_params
        )

        # Apply test-specific logic: non-enum mode doesn't have meaningful impact score
        if test_params and not test_params.get("match_enum", True):
            dimension_result.impactScore = None

        return dimension_result

    @abstractmethod
    def _execute_dimensional_validation(
        self,
        column: Union[SQALikeColumn, Column],
        dimension_col: Union[SQALikeColumn, Column],
        metrics_to_compute: dict,
        test_params: dict,
    ) -> List[DimensionResult]:
        """Execute dimensional query for column values to be in set

        Args:
            column: The main column being validated
            dimension_col: Single dimension column object
            metrics_to_compute: Dictionary mapping Metrics enum names to Metrics objects
                              e.g., {"COUNT_IN_SET": Metrics.COUNT_IN_SET}
            test_params: Dictionary with test-specific parameters (allowed_values, match_enum)

        Returns:
            List[DimensionResult]: List of dimension results for this dimension column
        """
        raise NotImplementedError

    @abstractmethod
    def _run_results(
        self, metric: Metrics, column: Union[SQALikeColumn, Column], **kwargs
    ):
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
