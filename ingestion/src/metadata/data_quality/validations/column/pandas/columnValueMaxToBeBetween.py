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
Validator for column value max to be between test case
"""

from collections import defaultdict
from typing import List, Optional, cast

import pandas as pd

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_TOTAL_COUNT_KEY,
    DIMENSION_VALUE_KEY,
)
from metadata.data_quality.validations.column.base.columnValueMaxToBeBetween import (
    BaseColumnValueMaxToBeBetweenValidator,
)
from metadata.data_quality.validations.impact_score import (
    DEFAULT_TOP_DIMENSIONS,
    calculate_impact_score_pandas,
)
from metadata.data_quality.validations.mixins.pandas_validator_mixin import (
    PandasValidatorMixin,
    aggregate_others_statistical_pandas,
)
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = test_suite_logger()


class ColumnValueMaxToBeBetweenValidator(
    BaseColumnValueMaxToBeBetweenValidator, PandasValidatorMixin
):
    """Validator for column value max to be between test case"""

    def _get_column_name(self, column_name: Optional[str] = None) -> SQALikeColumn:
        """Get column object for the given column name

        If column_name is None, returns the main column being validated.
        If column_name is provided, returns the column object for that specific column.

        Args:
            column_name: Optional column name. If None, returns the main validation column.

        Returns:
            SQALikeColumn: Column object
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

    def _execute_dimensional_validation(
        self,
        column: SQALikeColumn,
        dimension_col: SQALikeColumn,
        metrics_to_compute: dict,
        test_params: dict,
    ) -> List[DimensionResult]:
        """Execute dimensional validation for max with proper aggregation

        Follows the iterate pattern from the Mean metric's df_fn method to handle
        multiple dataframes efficiently without concatenating them in memory.

        Memory-efficient approach: Instead of concatenating all dataframes (which creates
        a full copy in memory), we iterate over them and accumulate aggregates. This is
        especially important for large parquet files split across many chunks.

        For max validator, we accumulate max values across dataframes to accurately
        compute the overall max per dimension. MAX aggregates naturally: max(max1, max2, ...) = overall_max.

        Args:
            column: The column being validated
            dimension_col: Single SQALikeColumn object corresponding to the dimension column
            metrics_to_compute: Dictionary mapping Metrics enum names to Metrics objects
            test_params: Dictionary with test-specific parameters (min/max bounds)

        Returns:
            List[DimensionResult]: Top N dimensions by impact score plus "Others"
        """
        dimension_results = []

        try:
            min_bound = test_params["minValueForMaxInCol"]
            max_bound = test_params["maxValueForMaxInCol"]

            def is_violation_max(value: object) -> bool:
                return not (min_bound <= value <= max_bound)

            dfs = self.runner if isinstance(self.runner, list) else [self.runner]

            dimension_aggregates = defaultdict(
                lambda: {Metrics.MAX.name: [], DIMENSION_TOTAL_COUNT_KEY: []}
            )

            for df in dfs:
                df_typed = cast(pd.DataFrame, df)
                grouped = df_typed.groupby(dimension_col.name, dropna=False)

                for dimension_value, group_df in grouped:
                    dimension_value = self.format_dimension_value(dimension_value)

                    dimension_aggregates[dimension_value][Metrics.MAX.name].append(
                        Metrics.MAX(column).df_fn([group_df])
                    )
                    dimension_aggregates[dimension_value][
                        DIMENSION_TOTAL_COUNT_KEY
                    ].append(len(group_df))

            results_data = []
            for dimension_value, agg in dimension_aggregates.items():
                maxes_list = [m for m in agg[Metrics.MAX.name] if pd.notna(m)]
                total_rows = sum(agg[DIMENSION_TOTAL_COUNT_KEY])

                if not maxes_list:
                    continue

                max_value = max(maxes_list)

                failed_count = total_rows if is_violation_max(max_value) else 0

                results_data.append(
                    {
                        DIMENSION_VALUE_KEY: dimension_value,
                        Metrics.MAX.name: max_value,
                        DIMENSION_TOTAL_COUNT_KEY: total_rows,
                        DIMENSION_FAILED_COUNT_KEY: failed_count,
                    }
                )

            results_df = pd.DataFrame(results_data)

            if not results_df.empty:
                results_df = calculate_impact_score_pandas(
                    results_df,
                    failed_column=DIMENSION_FAILED_COUNT_KEY,
                    total_column=DIMENSION_TOTAL_COUNT_KEY,
                )

                results_df = aggregate_others_statistical_pandas(
                    results_df,
                    dimension_column=DIMENSION_VALUE_KEY,
                    agg_functions={Metrics.MAX.name: "max"},
                    top_n=DEFAULT_TOP_DIMENSIONS,
                    violation_metric=Metrics.MAX.name,
                    violation_predicate=lambda v: is_violation_max(v),
                )

                for row_dict in results_df.to_dict("records"):
                    metric_values = self._build_metric_values_from_row(
                        row_dict, metrics_to_compute, test_params
                    )

                    evaluation = self._evaluate_test_condition(
                        metric_values, test_params
                    )

                    dimension_result = self._create_dimension_result(
                        row_dict,
                        dimension_col.name,
                        metric_values,
                        evaluation,
                        test_params,
                    )

                    dimension_results.append(dimension_result)

        except Exception as exc:
            logger.warning(f"Error executing dimensional query: {exc}")
            logger.debug("Full error details: ", exc_info=True)

        return dimension_results
