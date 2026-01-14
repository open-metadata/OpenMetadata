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
from collections import Counter, defaultdict
from typing import List, Optional, cast

import pandas as pd

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_TOTAL_COUNT_KEY,
    DIMENSION_VALUE_KEY,
)
from metadata.data_quality.validations.column.base.columnValuesToBeUnique import (
    BaseColumnValuesToBeUniqueValidator,
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
from metadata.utils.sqa_like_column import SQALikeColumn

logger = logging.getLogger(__name__)

COUNTER_ACCUMULATOR_KEY = "counter_accumulator"


class ColumnValuesToBeUniqueValidator(
    BaseColumnValuesToBeUniqueValidator, PandasValidatorMixin
):
    """Validator for column values to be unique test case"""

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
        test_params: Optional[dict] = None,
    ) -> List[DimensionResult]:
        """Execute dimensional query with impact scoring and Others aggregation for pandas

        Follows the iterate pattern from the Mean metric's df_fn method to handle
        multiple dataframes efficiently without concatenating them in memory.

        Memory-efficient approach: Instead of concatenating all dataframes (which creates
        a full copy in memory), we iterate over them and accumulate aggregates. This is
        especially important for large parquet files split across many chunks.

        For uniqueness validation, we collect all values across dataframes to accurately
        detect duplicates that may span multiple chunks.

        Args:
            column: The column being validated
            dimension_col: Single SQALikeColumn object corresponding to the dimension column
            metrics_to_compute: Dictionary mapping Metrics enum names to Metrics objects
            test_params: Optional test parameters (not used by uniqueness validator)

        Returns:
            List[DimensionResult]: Top N dimensions by impact score plus "Others"
        """
        dimension_results = []

        try:
            dfs = self.runner if isinstance(self.runner, list) else [self.runner]
            unique_count_impl = Metrics.UNIQUE_COUNT(column).get_pandas_computation()

            dimension_aggregates = defaultdict(
                lambda: {
                    Metrics.UNIQUE_COUNT.name: unique_count_impl.create_accumulator(),
                    Metrics.COUNT.name: 0,
                    DIMENSION_TOTAL_COUNT_KEY: 0,
                }
            )

            for df in dfs:
                df_typed = cast(pd.DataFrame, df)
                grouped = df_typed.groupby(dimension_col.name, dropna=False)

                for dimension_value, group_df in grouped:
                    dimension_value = self.format_dimension_value(dimension_value)

                    unique_count_impl.update_accumulator(
                        dimension_aggregates[dimension_value][
                            Metrics.UNIQUE_COUNT.name
                        ],
                        group_df,
                    )
                    dimension_aggregates[dimension_value][
                        Metrics.COUNT.name
                    ] += Metrics.COUNT(column).df_fn([group_df])
                    dimension_aggregates[dimension_value][
                        DIMENSION_TOTAL_COUNT_KEY
                    ] += len(group_df)

            results_data = []
            for dimension_value, agg in dimension_aggregates.items():
                total_count = agg[Metrics.COUNT.name]
                total_rows = agg[DIMENSION_TOTAL_COUNT_KEY]
                counter_accumulator = agg[Metrics.UNIQUE_COUNT.name]
                unique_count = unique_count_impl.aggregate_accumulator(
                    counter_accumulator
                )
                failed_count = total_count - unique_count

                results_data.append(
                    {
                        DIMENSION_VALUE_KEY: dimension_value,
                        COUNTER_ACCUMULATOR_KEY: counter_accumulator,
                        Metrics.COUNT.name: total_count,
                        Metrics.UNIQUE_COUNT.name: unique_count,
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

                def calculate_unique_count_from_counter(
                    df_aggregated, others_mask, metric_column
                ):
                    result = df_aggregated[metric_column].copy()
                    if others_mask.any():
                        merged_counter = df_aggregated.loc[
                            others_mask, COUNTER_ACCUMULATOR_KEY
                        ].iloc[0]
                        unique_count = sum(1 for v in merged_counter.values() if v == 1)
                        result.loc[others_mask] = unique_count
                    return result

                def calculate_failed_count_from_metrics(
                    df_aggregated, others_mask, metric_column
                ):
                    result = df_aggregated[metric_column].copy()
                    if others_mask.any():
                        count = df_aggregated.loc[others_mask, Metrics.COUNT.name].iloc[
                            0
                        ]
                        unique_count = df_aggregated.loc[
                            others_mask, Metrics.UNIQUE_COUNT.name
                        ].iloc[0]
                        failed_count = count - unique_count
                        result.loc[others_mask] = failed_count
                    return result

                results_df = aggregate_others_statistical_pandas(
                    results_df,
                    dimension_column=DIMENSION_VALUE_KEY,
                    agg_functions={
                        COUNTER_ACCUMULATOR_KEY: lambda counters: sum(
                            counters, Counter()
                        ),
                        Metrics.COUNT.name: "sum",
                        DIMENSION_TOTAL_COUNT_KEY: "sum",
                        DIMENSION_FAILED_COUNT_KEY: "sum",
                    },
                    final_metric_calculators={
                        Metrics.UNIQUE_COUNT.name: calculate_unique_count_from_counter,
                        DIMENSION_FAILED_COUNT_KEY: calculate_failed_count_from_metrics,
                    },
                    exclude_from_final=[COUNTER_ACCUMULATOR_KEY],
                    top_n=DEFAULT_TOP_DIMENSIONS,
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
