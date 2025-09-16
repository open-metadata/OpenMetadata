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

from sqlalchemy import Column, inspect

from metadata.data_quality.validations.column.base.columnValuesToBeInSet import (
    BaseColumnValuesToBeInSetValidator,
)
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
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

    def _execute_dimensional_query(
        self, column, dimension_col, metrics_to_compute, test_params
    ):
        """Execute dimensional query for column values to be in set using SQLAlchemy

        This method follows the same pattern as _run_results but executes a GROUP BY query
        for a single dimension column, following the columnValuesToBeUnique pattern.

        Args:
            column: The column being validated
            dimension_col: Single Column object corresponding to the dimension column
            metrics_to_compute: Dictionary mapping metric names to Metrics objects
            test_params: Dictionary with test-specific parameters (allowed_values, match_enum)

        Returns:
            List[DimensionResult]: List of dimension results for this dimension column
        """
        from metadata.data_quality.validations.column.base.columnValuesToBeInSet import (
            ALLOWED_VALUE_COUNT,
        )
        from metadata.generated.schema.tests.basic import TestResultValue

        dimension_results = []

        try:
            # Extract test parameters
            allowed_values = test_params["allowed_values"]
            match_enum = test_params["match_enum"]

            # Build the SELECT clause with dimension column and metrics
            # Following the same pattern as _run_results but with GROUP BY
            select_entities = []

            # Add dimension column first (single Column object)
            select_entities.append(dimension_col)

            # Add metrics - iterate through the metrics passed from the parent
            for metric_name, metric in metrics_to_compute.items():
                metric_instance = metric.value(column)

                if metric_name == "count_in_set":
                    # Add COUNT_IN_SET with allowed values parameter
                    metric_instance.values = allowed_values
                    select_entities.append(metric_instance.fn().label(metric_name))
                else:
                    # Add other metrics (like row_count)
                    select_entities.append(metric_instance.fn().label(metric_name))

            # Execute the dimensional query using GROUP BY
            dimensional_data = self.runner.select_all_from_sample(
                *select_entities,
                query_group_by_=[
                    dimension_col
                ],  # This enables GROUP BY on single dimension column
            )

            # Process results - each row represents a different value of the dimension
            for row in dimensional_data:
                # Extract dimension value (first column is the dimension value)
                dimension_value = str(row[0])

                # Extract metric results - we know the exact order based on select_entities
                count_in_set = row[1]  # count_in_set column

                if match_enum and len(row) > 2:
                    total_count = row[2]  # row_count column
                    matched = total_count - count_in_set == 0
                else:
                    matched = count_in_set > 0
                    total_count = (
                        count_in_set  # For non-enum mode, we only care about matches
                    )

                # Create dimension result using the helper method
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
                )

                # Add to results list
                dimension_results.append(dimension_result)

        except Exception as exc:
            # Use the same error handling pattern as _run_results
            logger.warning(f"Error executing dimensional query: {exc}")
            # Return empty list on error (test continues without dimensions)

        return dimension_results
