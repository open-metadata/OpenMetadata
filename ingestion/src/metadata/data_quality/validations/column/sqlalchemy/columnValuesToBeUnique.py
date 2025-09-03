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
Validator for column values to be unique test case
"""

import logging
from typing import List, Optional

from sqlalchemy import Column, inspect, literal_column
from sqlalchemy.exc import SQLAlchemyError

from metadata.data_quality.validations.column.base.columnValuesToBeUnique import (
    BaseColumnValuesToBeUniqueValidator,
)
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.generated.schema.tests.basic import DimensionResult, TestResultValue
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.orm.registry import Dialects

logger = logging.getLogger(__name__)


class ColumnValuesToBeUniqueValidator(
    BaseColumnValuesToBeUniqueValidator, SQAValidatorMixin
):
    """Validator for column values to be unique test case"""

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

    def _run_results(self, metric: Metrics, column: Column) -> Optional[int]:
        """compute result of the test case

        Args:
            metric: metric
            column: column
        """
        count = Metrics.COUNT.value(column).fn()
        unique_count = Metrics.UNIQUE_COUNT.value(column).query(
            sample=self.runner.dataset,
            session=self.runner._session,  # pylint: disable=protected-access
        )  # type: ignore

        try:
            if self.runner.dialect == Dialects.Oracle:
                query_group_by_ = [literal_column("2")]
            else:
                query_group_by_ = None

            self.value = dict(
                self.runner.dispatch_query_select_first(
                    count,
                    unique_count.scalar_subquery().label("uniqueCount"),
                    query_group_by_=query_group_by_,
                )
            )  # type: ignore
            res = self.value.get(Metrics.COUNT.name)
        except Exception as exc:
            raise SQLAlchemyError(exc)

        if res is None:
            raise ValueError(
                f"\nQuery on table/column {column.name if column is not None else ''} returned None. Your table might be empty. "
                "If you confirmed your table is not empty and are still seeing this message you can:\n"
                "\t1. check the documentation: https://docs.open-metadata.org/v1.3.x/connectors/ingestion/workflows/data-quality/tests\n"
                "\t2. reach out to the Collate team for support"
            )

        return res

    def _get_unique_count(self, metric: Metrics, column: Column) -> Optional[int]:
        """Get unique count of values"""

        return self.value.get(metric.name)

    def _execute_dimensional_query(
        self, column: Column, dimension_cols: List[Column], metrics_to_compute: dict
    ) -> List[DimensionResult]:
        """Execute dimensional query for column values to be unique using SQLAlchemy

        This method follows the same pattern as _run_results but executes a GROUP BY query
        that returns results for each dimension combination.

        Args:
            column: The column being validated
            dimension_cols: List of Column objects corresponding to dimension columns
            metrics_to_compute: Dictionary mapping metric names to Metrics objects

        Returns:
            List[DimensionResult]: List of dimension-specific test results
        """
        dimension_results = []

        try:
            # Extract dimension column names from the Column objects
            dimension_columns = [col.name for col in dimension_cols]

            # Build the SELECT clause with dimension columns and metrics
            # Following the same pattern as _run_results but with GROUP BY
            select_entities = []

            # Add dimension columns first (already Column objects)
            select_entities.extend(dimension_cols)

            # Add metrics - iterate through the metrics passed from the parent
            # This keeps the flexibility while being driven by the base class
            for metric_name, metric in metrics_to_compute.items():
                select_entities.append(metric.value(column).fn().label(metric_name))

            # Execute the dimensional query using GROUP BY
            # This follows the same pattern as _run_results but uses select_all_from_sample
            # with query_group_by_ parameter for GROUP BY functionality
            dimensional_data = self.runner.select_all_from_sample(
                *select_entities,
                query_group_by_=dimension_cols,  # This enables GROUP BY on dimension columns
            )

            # Process results - each row represents a dimension combination
            for row in dimensional_data:
                # Extract dimension values (first N columns are the dimension values)
                dimension_values = {}
                for i, dim_name in enumerate(dimension_columns):
                    dimension_values[dim_name] = str(row[i])

                # Extract metric results - we know the exact order:
                # [dim1, dim2, ..., count, unique_count]
                metric_start_index = len(dimension_cols)
                total_count = row[metric_start_index]  # count column
                unique_count = row[metric_start_index + 1]  # unique_count column

                # Create dimension result using the helper method (similar to get_test_case_result_object)
                dimension_result = self.get_dimension_result_object(
                    dimension_values=dimension_values,
                    test_case_status=self.get_test_case_status(
                        total_count == unique_count
                    ),
                    result=f"Dimension {dimension_values}: Found valuesCount={total_count} vs. uniqueCount={unique_count}",
                    test_result_value=[
                        TestResultValue(name="valuesCount", value=str(total_count)),
                        TestResultValue(name="uniqueCount", value=str(unique_count)),
                    ],
                    total_rows=total_count,
                    passed_rows=unique_count,
                    # failed_rows will be auto-calculated as (total_count - unique_count)
                )

                dimension_results.append(dimension_result)

        except Exception as exc:
            # Use the same error handling pattern as _run_results
            logger.warning(f"Error executing dimensional query: {exc}")
            # Return empty list on error (test continues without dimensions)

        return dimension_results
