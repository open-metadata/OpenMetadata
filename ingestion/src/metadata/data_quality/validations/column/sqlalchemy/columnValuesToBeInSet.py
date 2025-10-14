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

from typing import Optional

from sqlalchemy import Column, func, inspect

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_NULL_LABEL,
    DIMENSION_TOTAL_COUNT_KEY,
)
from metadata.data_quality.validations.column.base.columnValuesToBeInSet import (
    ALLOWED_VALUE_COUNT,
    BaseColumnValuesToBeInSetValidator,
)
from metadata.data_quality.validations.impact_score import DEFAULT_TOP_DIMENSIONS
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.generated.schema.tests.basic import TestResultValue
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class ColumnValuesToBeInSetValidator(
    BaseColumnValuesToBeInSetValidator, SQAValidatorMixin
):
    """Validator for column value to be in set test case"""

    def _get_column_name(self, column_name: Optional[str] = None) -> Column:
        """Get column object for the given column name

        If column_name is None, returns the main column being validated.
        If column_name is provided, returns the column object for that specific column.

        Args:
            column_name: Optional column name. If None, returns the main validation column.

        Returns:
            Column: Column object
        """
        if column_name is None:
            # Get the main column being validated (original behavior)
            return self.get_column_name(
                self.test_case.entityLink.root,
                inspect(self.runner.dataset).c,
            )
        else:
            # Get a specific column by name (for dimension columns)
            return self.get_column_name(
                column_name,
                inspect(self.runner.dataset).c,
            )

    def _run_results(self, metric: Metrics, column: Column, **kwargs) -> Optional[int]:
        """compute result of the test case

        Args:
            metric: metric
            column: column
        """
        return self.run_query_results(self.runner, metric, column, **kwargs)

    def compute_row_count(self, column: Column):
        """Compute row count for the given column

        Args:
            column (Union[SQALikeColumn, Column]): column to compute row count for

        Raises:
            NotImplementedError:
        """
        return self._compute_row_count(self.runner, column)

    def _execute_dimensional_validation(
        self, column, dimension_col, metrics_to_compute, test_params
    ):
        """Execute dimensional query with impact scoring and Others aggregation

        Calculates impact scores for all dimension values and aggregates
        low-impact dimensions into "Others" category using CTEs.

        Args:
            column: The column being validated
            dimension_col: Single Column object corresponding to the dimension column
            metrics_to_compute: Dictionary mapping metric names to Metrics objects
            test_params: Dictionary with test-specific parameters (allowed_values, match_enum)

        Returns:
            List[DimensionResult]: Top N dimensions by impact score plus "Others"
        """
        dimension_results = []

        try:
            allowed_values = test_params["allowed_values"]
            match_enum = test_params["match_enum"]

            metric_expressions = {}
            for metric_name, metric in metrics_to_compute.items():
                metric_instance = metric.value(column)
                if metric_name == "count_in_set":
                    metric_instance.values = allowed_values
                metric_expressions[metric_name] = metric_instance.fn()

            if match_enum and "row_count" in metric_expressions:
                # Enum mode: failed = total - matched
                metric_expressions[DIMENSION_TOTAL_COUNT_KEY] = metric_expressions[
                    "row_count"
                ]
                metric_expressions[DIMENSION_FAILED_COUNT_KEY] = (
                    metric_expressions["row_count"] - metric_expressions["count_in_set"]
                )
            else:
                # Non-enum mode: no real concept of failure, use count_in_set for ordering
                metric_expressions[DIMENSION_TOTAL_COUNT_KEY] = metric_expressions[
                    "count_in_set"
                ]
                metric_expressions[DIMENSION_FAILED_COUNT_KEY] = func.literal(0)

            result_rows = self._execute_with_others_aggregation(
                dimension_col, metric_expressions, DEFAULT_TOP_DIMENSIONS
            )

            for row in result_rows:
                dimension_value = (
                    str(row["dimension_value"])
                    if row["dimension_value"] is not None
                    else DIMENSION_NULL_LABEL
                )

                count_in_set = row.get("count_in_set", 0) or 0

                # PRESERVE ORIGINAL LOGIC: match_enum determines how we get total_count
                if match_enum and "row_count" in row:
                    total_count = row.get("row_count", 0) or 0
                    failed_count = total_count - count_in_set
                    matched = (
                        total_count - count_in_set == 0
                    )  # All must be in set for enum
                else:
                    # Non-enum mode: we only care about matches
                    matched = count_in_set > 0
                    total_count = count_in_set  # Original behavior preserved
                    failed_count = 0  # In non-enum mode, we don't track failures

                impact_score = row.get("impact_score", 0.0)

                dimension_result = self.get_dimension_result_object(
                    dimension_values={dimension_col.name: dimension_value},
                    test_case_status=self.get_test_case_status(matched),
                    result=f"Dimension {dimension_col.name}={dimension_value}: Found countInSet={count_in_set}",
                    test_result_value=[
                        TestResultValue(
                            name=ALLOWED_VALUE_COUNT, value=str(count_in_set)
                        ),
                    ],
                    total_rows=total_count,
                    passed_rows=count_in_set,
                    failed_rows=failed_count if match_enum else None,
                    impact_score=impact_score if match_enum else None,
                )

                dimension_results.append(dimension_result)

        except Exception as exc:
            logger.warning(f"Error executing dimensional query: {exc}")
            logger.debug("Full error details: ", exc_info=True)

        return dimension_results
