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
Validator for column value stddev to be between test case
"""

from collections import defaultdict
from typing import List, Optional, cast

import pandas as pd

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_TOTAL_COUNT_KEY,
    DIMENSION_VALUE_KEY,
)
from metadata.data_quality.validations.column.base.columnValueStdDevToBeBetween import (
    BaseColumnValueStdDevToBeBetweenValidator,
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
from metadata.profiler.metrics.static.stddev import StdDev, SumSumSquaresCount
from metadata.utils.logger import test_suite_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = test_suite_logger()

SUM_SQUARES_KEY = "SUM_SQUARES"


class ColumnValueStdDevToBeBetweenValidator(
    BaseColumnValueStdDevToBeBetweenValidator, PandasValidatorMixin
):
    """Validator for column value stddev to be between test case"""

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
        """Execute dimensional validation for stddev with proper weighted aggregation

        Follows the iterate pattern from the StdDev metric's df_fn method to handle
        multiple dataframes efficiently without concatenating them in memory.

        Memory-efficient approach: Instead of concatenating all dataframes (which creates
        a full copy in memory), we iterate over them and accumulate aggregates. This is
        especially important for large parquet files split across many chunks.

        For statistical validators like StdDev, we need special handling:
        1. Iterate over all dataframes and accumulate sum/sum_squares/counts per dimension
        2. Compute weighted stddev across dataframes for each dimension
        3. Determine if stddev is within bounds (all rows pass/fail together)
        4. For "Others": recompute weighted stddev from aggregated sum/sum_squares/counts

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
            stddev_impl = Metrics.STDDEV(column).get_pandas_computation()
            row_count_impl = Metrics.ROW_COUNT().get_pandas_computation()

            dimension_aggregates = defaultdict(
                lambda: {
                    Metrics.STDDEV.name: stddev_impl.create_accumulator(),
                    DIMENSION_TOTAL_COUNT_KEY: row_count_impl.create_accumulator(),
                }
            )

            for df in dfs:
                df_typed = cast(pd.DataFrame, df)
                grouped = df_typed.groupby(dimension_col.name, dropna=False)

                for dimension_value, group_df in grouped:
                    dimension_value = self.format_dimension_value(dimension_value)

                    dimension_aggregates[dimension_value][
                        Metrics.STDDEV.name
                    ] = stddev_impl.update_accumulator(
                        dimension_aggregates[dimension_value][Metrics.STDDEV.name],
                        group_df,
                    )

                    dimension_aggregates[dimension_value][
                        DIMENSION_TOTAL_COUNT_KEY
                    ] += row_count_impl.update_accumulator(
                        dimension_aggregates[dimension_value][
                            DIMENSION_TOTAL_COUNT_KEY
                        ],
                        group_df,
                    )

            results_data = []
            for dimension_value, agg in dimension_aggregates.items():
                stddev_value = stddev_impl.aggregate_accumulator(
                    agg[Metrics.STDDEV.name]
                )
                total_rows = row_count_impl.aggregate_accumulator(
                    agg[DIMENSION_TOTAL_COUNT_KEY]
                )

                if stddev_value is None:
                    logger.warning(
                        "Skipping '%s=%s' dimension since 'stddev' is 'None'",
                        dimension_col.name,
                        dimension_value,
                    )
                    continue

                # Statistical validator: when stddev fails, ALL rows in dimension fail
                failed_count = (
                    total_rows
                    if checker.violates_pandas({Metrics.STDDEV.name: stddev_value})
                    else 0
                )

                results_data.append(
                    {
                        DIMENSION_VALUE_KEY: dimension_value,
                        Metrics.STDDEV.name: stddev_value,
                        Metrics.COUNT.name: agg[Metrics.STDDEV.name].count_value,
                        Metrics.SUM.name: agg[Metrics.STDDEV.name].sum_value,
                        SUM_SQUARES_KEY: agg[Metrics.STDDEV.name].sum_squares_value,
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

                def calculate_weighted_stddev(
                    df_aggregated, others_mask, metric_column
                ):
                    """Calculate weighted stddev for Others using StdDev accumulator

                    For "Others" group, we recompute stddev from aggregated statistics
                    by constructing an accumulator and using the exact same aggregation
                    logic as the StdDev metric (ensuring consistency and DRY principle).

                    For top N dimensions, we use the pre-computed stddev.
                    """
                    result = df_aggregated[metric_column].copy()
                    if others_mask.any():
                        others_sum = df_aggregated.loc[
                            others_mask, Metrics.SUM.name
                        ].iloc[0]
                        others_count = df_aggregated.loc[
                            others_mask, Metrics.COUNT.name
                        ].iloc[0]
                        others_sum_squares = df_aggregated.loc[
                            others_mask, SUM_SQUARES_KEY
                        ].iloc[0]

                        accumulator = SumSumSquaresCount(
                            sum_value=others_sum,
                            sum_squares_value=others_sum_squares,
                            count_value=others_count,
                        )

                        others_stddev = StdDev.aggregate_accumulator(accumulator)

                        if others_stddev is not None:
                            result.loc[others_mask] = others_stddev

                    return result

                results_df = aggregate_others_statistical_pandas(
                    results_df,
                    dimension_column=DIMENSION_VALUE_KEY,
                    agg_functions={
                        Metrics.SUM.name: "sum",
                        Metrics.COUNT.name: "sum",
                        SUM_SQUARES_KEY: "sum",
                        DIMENSION_TOTAL_COUNT_KEY: "sum",
                        DIMENSION_FAILED_COUNT_KEY: "sum",
                    },
                    final_metric_calculators={
                        Metrics.STDDEV.name: calculate_weighted_stddev
                    },
                    exclude_from_final=[
                        Metrics.SUM.name,
                        Metrics.COUNT.name,
                        SUM_SQUARES_KEY,
                    ],
                    top_n=DEFAULT_TOP_DIMENSIONS,
                    violation_metrics=[Metrics.STDDEV.name],
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
