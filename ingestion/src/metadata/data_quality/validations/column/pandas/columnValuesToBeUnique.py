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

import pandas as pd

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_TOTAL_COUNT_KEY,
)
from metadata.data_quality.validations.column.base.columnValuesToBeUnique import (
    BaseColumnValuesToBeUniqueValidator,
)
from metadata.data_quality.validations.impact_score import (
    DEFAULT_TOP_DIMENSIONS,
    aggregate_others_pandas,
    calculate_impact_score_pandas,
)
from metadata.data_quality.validations.mixins.pandas_validator_mixin import (
    PandasValidatorMixin,
)
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
            return self.get_column_name(
                self.test_case.entityLink.root,
                self.runner,
            )
        else:
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

    def _execute_dimensional_validation(
        self,
        column: SQALikeColumn,
        dimension_col: SQALikeColumn,
        metrics_to_compute: dict,
    ) -> List[DimensionResult]:
        """Execute dimensional query with impact scoring and Others aggregation for pandas

        Args:
            column: The column being validated
            dimension_col: Single SQALikeColumn object corresponding to the dimension column
            metrics_to_compute: Dictionary mapping Metrics enum names to Metrics objects

        Returns:
            List[DimensionResult]: Top N dimensions by impact score plus "Others"
        """
        dimension_results = []

        try:
            dfs = self.runner if isinstance(self.runner, list) else [self.runner]
            df = dfs[0]

            grouped = df.groupby(dimension_col.name, dropna=False)
            results_data = []

            for dimension_value, group_df in grouped:
                dimension_value = self.format_dimension_value(dimension_value)

                total_count = len(group_df)
                unique_count = group_df[column.name].nunique()
                duplicate_count = total_count - unique_count

                # Use enum names as keys
                results_data.append(
                    {
                        "dimension": dimension_value,
                        Metrics.COUNT.name: total_count,
                        Metrics.UNIQUE_COUNT.name: unique_count,
                        DIMENSION_TOTAL_COUNT_KEY: total_count,
                        DIMENSION_FAILED_COUNT_KEY: duplicate_count,
                    }
                )

            results_df = pd.DataFrame(results_data)

            if not results_df.empty:
                results_df = calculate_impact_score_pandas(
                    results_df,
                    failed_column=DIMENSION_FAILED_COUNT_KEY,
                    total_column=DIMENSION_TOTAL_COUNT_KEY,
                )

                results_df = aggregate_others_pandas(
                    results_df,
                    dimension_column="dimension",
                    top_n=DEFAULT_TOP_DIMENSIONS,
                )

                for row_dict in results_df.to_dict("records"):
                    # Rename dimension column to dimension_value for helper methods
                    row_dict["dimension_value"] = row_dict.pop("dimension")

                    # Build metric_values dict using helper method
                    metric_values = self._build_metric_values_from_row(
                        row_dict, metrics_to_compute
                    )

                    # Evaluate test condition
                    evaluation = self._evaluate_test_condition(metric_values)

                    # Create dimension result using helper method
                    dimension_result = self._create_dimension_result(
                        row_dict, dimension_col.name, metric_values, evaluation
                    )

                    dimension_results.append(dimension_result)

        except Exception as exc:
            logger.warning(f"Error executing dimensional query: {exc}")
            logger.debug("Full error details: ", exc_info=True)

        return dimension_results
