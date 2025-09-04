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
from typing import Dict, Optional

from metadata.data_quality.validations.column.base.columnValuesToBeUnique import (
    BaseColumnValuesToBeUniqueValidator,
)
from metadata.data_quality.validations.mixins.pandas_validator_mixin import (
    PandasValidatorMixin,
)
from metadata.generated.schema.tests.basic import TestResultValue
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.sqa_like_column import SQALikeColumn

logger = logging.getLogger(__name__)


class ColumnValuesToBeUniqueValidator(
    BaseColumnValuesToBeUniqueValidator, PandasValidatorMixin
):
    """Validator for column values to be unique test case"""

    def _get_column_name(self, column_name: Optional[str] = None) -> SQALikeColumn:
        """Get column name from the test case entity link

        If column_name is None, returns the main column being validated.
        If column_name is provided, returns the column object for that specific column.

        Args:
            column_name: Optional column name. If None, returns the main validation column.

        Returns:
            SQALikeColumn: column
        """
        if column_name is None:
            # Get the main column being validated (original behavior)
            return self.get_column_name(
                self.test_case.entityLink.root,
                self.runner,
            )
        else:
            # Get a specific column by name (for dimension columns)
            return self.get_column_name(
                column_name,
                self.runner,
            )

    def _run_results(self, metric: Metrics, column: SQALikeColumn) -> Optional[int]:
        """compute result of the test case

        Args:
            metric: metric
            column: column
        """
        return self.run_dataframe_results(self.runner, metric, column)

    def _get_unique_count(
        self, metric: Metrics, column: SQALikeColumn
    ) -> Optional[int]:
        """Get unique count of values"""
        return self._run_results(metric, column)

    def _execute_dimensional_query(
        self,
        column: SQALikeColumn,
        dimension_col: SQALikeColumn,
        metrics_to_compute: dict,
    ) -> Dict[str, DimensionResult]:
        """Execute dimensional query for column values to be unique using Pandas

        This method now uses the pandas mixin's dimensional results method for a single dimension,
        following the same pattern as _run_results for consistency and reusability.

        Args:
            column: The column being validated
            dimension_col: Single SQALikeColumn object corresponding to the dimension column
            metrics_to_compute: Dictionary mapping metric names to Metrics objects

        Returns:
            Dict[str, DimensionResult]: Dictionary mapping dimension values to results
        """
        dimension_results = {}

        try:
            # Use the mixin's dimensional results method for a single dimension
            dimensional_data = self.run_dataframe_single_dimensional_results(
                runner=self.runner,
                metrics_to_compute=metrics_to_compute,
                column=column,
                dimension_column=dimension_col.name,
            )

            # Process results - each item contains dimension_value and metrics for single dimension
            for dimension_value, metrics in dimensional_data.items():
                # Extract the specific metrics we need for uniqueness test
                total_count = metrics.get("count", 0)
                unique_count = metrics.get("unique_count", 0)

                # Create dimension result using the helper method
                dimension_result = self.get_dimension_result_object(
                    dimension_values={dimension_col.name: dimension_value},
                    test_case_status=self.get_test_case_status(
                        total_count == unique_count
                    ),
                    result=f"Dimension {dimension_col.name}={dimension_value}: Found valuesCount={total_count} vs. uniqueCount={unique_count}",
                    test_result_value=[
                        TestResultValue(name="valuesCount", value=str(total_count)),
                        TestResultValue(name="uniqueCount", value=str(unique_count)),
                    ],
                    total_rows=total_count,
                    passed_rows=unique_count,
                    # failed_rows will be auto-calculated as (total_count - unique_count)
                )

                # Add to results dictionary with dimension value as key
                dimension_results[dimension_value] = dimension_result

        except Exception as exc:
            # Use the same error handling pattern as _run_results
            logger.warning(f"Error executing dimensional query: {exc}")
            # Return empty dict on error (test continues without dimensions)

        return dimension_results
