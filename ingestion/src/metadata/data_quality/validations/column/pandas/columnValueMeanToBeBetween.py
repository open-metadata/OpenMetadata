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
Validator for column value mean to be between test case
"""

from collections import defaultdict
from typing import List, Optional, cast

import pandas as pd

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_TOTAL_COUNT_KEY,
    DIMENSION_VALUE_KEY,
)
from metadata.data_quality.validations.column.base.columnValueMeanToBeBetween import (
    BaseColumnValueMeanToBeBetweenValidator,
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


class ColumnValueMeanToBeBetweenValidator(
    BaseColumnValueMeanToBeBetweenValidator, PandasValidatorMixin
):
    """Validator for column value mean to be between test case"""

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
        """Execute dimensional validation for mean with proper weighted aggregation

        Follows the iterate pattern from the Mean metric's df_fn method to handle
        multiple dataframes efficiently without concatenating them in memory.

        Memory-efficient approach: Instead of concatenating all dataframes (which creates
        a full copy in memory), we iterate over them and accumulate aggregates. This is
        especially important for large parquet files split across many chunks.

        For statistical validators like Mean, we need special handling:
        1. Iterate over all dataframes and accumulate sums/counts per dimension
        2. Compute weighted mean across dataframes for each dimension
        3. Determine if mean is within bounds (all rows pass/fail together)
        4. For "Others": recompute weighted mean from aggregated sums/counts

        Args:
            column: The column being validated
            dimension_col: The dimension column to group by
            metrics_to_compute: Dict mapping metric names to Metrics enums
            test_params: Test parameters (min/max bounds)

        Returns:
            List[DimensionResult]: Top N dimensions plus "Others"
        """
        checker = self._get_validation_checker(test_params)
        dimension_results = []

        try:
            dfs = self.runner if isinstance(self.runner, list) else [self.runner]
            mean_impl = Metrics.MEAN(column).get_pandas_computation()

            dimension_aggregates = defaultdict(
                lambda: {
                    Metrics.MEAN.name: mean_impl.create_accumulator(),
                    DIMENSION_TOTAL_COUNT_KEY: 0,
                }
            )

            for df in dfs:
                df_typed = cast(pd.DataFrame, df)
                grouped = df_typed.groupby(dimension_col.name, dropna=False)

                for dimension_value, group_df in grouped:
                    dimension_value = self.format_dimension_value(dimension_value)

                    dimension_aggregates[dimension_value][
                        Metrics.MEAN.name
                    ] = mean_impl.update_accumulator(
                        dimension_aggregates[dimension_value][Metrics.MEAN.name],
                        group_df,
                    )

                    dimension_aggregates[dimension_value][
                        DIMENSION_TOTAL_COUNT_KEY
                    ] += len(group_df)

            results_data = []
            for dimension_value, agg in dimension_aggregates.items():
                mean_value = mean_impl.aggregate_accumulator(agg[Metrics.MEAN.name])

                if mean_value is None:
                    logger.warning(
                        "Skipping '%s=%s' dimension since 'mean' is 'None'",
                        dimension_col.name,
                        dimension_value,
                    )
                    continue

                total_rows = agg[DIMENSION_TOTAL_COUNT_KEY]

                # Statistical validator: when mean fails, ALL rows in dimension fail
                failed_count = (
                    total_rows
                    if checker.violates_pandas({Metrics.MEAN.name: mean_value})
                    else 0
                )

                results_data.append(
                    {
                        DIMENSION_VALUE_KEY: dimension_value,
                        Metrics.MEAN.name: mean_value,
                        Metrics.COUNT.name: agg[Metrics.MEAN.name].count_value,
                        Metrics.SUM.name: agg[Metrics.MEAN.name].sum_value,
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

                def calculate_weighted_mean(df_aggregated, others_mask, metric_column):
                    result = df_aggregated[metric_column].copy()
                    if others_mask.any():
                        others_sum = df_aggregated.loc[
                            others_mask, Metrics.SUM.name
                        ].iloc[0]
                        others_count = df_aggregated.loc[
                            others_mask, Metrics.COUNT.name
                        ].iloc[0]
                        if others_count > 0:
                            result.loc[others_mask] = others_sum / others_count
                    return result

                results_df = aggregate_others_statistical_pandas(
                    results_df,
                    dimension_column=DIMENSION_VALUE_KEY,
                    agg_functions={
                        Metrics.SUM.name: "sum",
                        Metrics.COUNT.name: "sum",
                        DIMENSION_TOTAL_COUNT_KEY: "sum",
                        DIMENSION_FAILED_COUNT_KEY: "sum",
                    },
                    final_metric_calculators={
                        Metrics.MEAN.name: calculate_weighted_mean
                    },
                    exclude_from_final=[Metrics.SUM.name, Metrics.COUNT.name],
                    top_n=DEFAULT_TOP_DIMENSIONS,
                    violation_metrics=[Metrics.MEAN.name],
                    violation_predicate=checker.violates_pandas,
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
