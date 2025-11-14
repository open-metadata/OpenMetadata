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
Validator for column value missing count to be equal test case
"""
from collections import defaultdict
from typing import List, Optional, cast

import pandas as pd

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_TOTAL_COUNT_KEY,
    DIMENSION_VALUE_KEY,
)
from metadata.data_quality.validations.column.base.columnValuesMissingCount import (
    BaseColumnValuesMissingCountValidator,
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
from metadata.profiler.metrics.core import add_props
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = test_suite_logger()


class ColumnValuesMissingCountValidator(
    BaseColumnValuesMissingCountValidator, PandasValidatorMixin
):
    """Validator for column value missing count to be equal test case"""

    def _run_results(
        self, metric: Metrics, column: SQALikeColumn, **kwargs
    ) -> Optional[int]:
        """compute result of the test case

        Args:
            metric: metric
            column: column
        """
        return self.run_dataframe_results(self.runner, metric, column, **kwargs)

    def _execute_dimensional_validation(
        self,
        column: SQALikeColumn,
        dimension_col: SQALikeColumn,
        metrics_to_compute: dict,
        test_params: dict,
    ) -> List[DimensionResult]:
        """Execute dimensional query with impact scoring and Others aggregation for pandas

        Follows the iterate pattern from the Mean metric's df_fn method to handle
        multiple dataframes efficiently without concatenating them in memory.

        Memory-efficient approach: Instead of concatenating all dataframes (which creates
        a full copy in memory), we iterate over them and accumulate aggregates. This is
        especially important for large parquet files split across many chunks.

        For missing count validation, we accumulate null/missing counts across dataframes
        to accurately track how many missing values exist per dimension.

        Args:
            column: The column being validated
            dimension_col: Single SQALikeColumn object corresponding to the dimension column
            metrics_to_compute: Dictionary mapping Metrics enum names to Metrics objects
            test_params: Dictionary with test-specific parameters (MISSING_VALUE_MATCH, MISSING_COUNT_VALUE)

        Returns:
            List[DimensionResult]: Top N dimensions by impact score plus "Others"
        """
        dimension_results = []

        try:
            dfs = self.runner if isinstance(self.runner, list) else [self.runner]

            metric_expressions = {
                Metrics.NULL_MISSING_COUNT.name: Metrics.NULL_MISSING_COUNT(
                    column
                ).get_pandas_computation(),
                Metrics.ROW_COUNT.name: Metrics.ROW_COUNT().get_pandas_computation(),
            }

            missing_values = test_params.get(self.MISSING_VALUE_MATCH)
            missing_values_expected_count = test_params.get(self.MISSING_COUNT_VALUE, 0)

            if missing_values:
                metric_expressions[Metrics.COUNT_IN_SET.name] = add_props(
                    values=missing_values
                )(Metrics.COUNT_IN_SET.value)(column).get_pandas_computation()

            dimension_aggregates = defaultdict(
                lambda: {
                    metric_name: metric.create_accumulator()
                    for metric_name, metric in metric_expressions.items()
                }
            )

            for df in dfs:
                df_typed = cast(pd.DataFrame, df)
                grouped = df_typed.groupby(dimension_col.name, dropna=False)

                for dimension_value, group_df in grouped:
                    dimension_value = self.format_dimension_value(dimension_value)
                    for metric_name, metric in metric_expressions.items():
                        dimension_aggregates[dimension_value][
                            metric_name
                        ] = metric.update_accumulator(
                            dimension_aggregates[dimension_value][metric_name], group_df
                        )

            results_data = []

            for dimension_value, agg in dimension_aggregates.items():
                total_missing_count = sum(
                    metric.aggregate_accumulator(agg[metric_name])
                    for metric_name, metric in metric_expressions.items()
                    if metric_name != Metrics.ROW_COUNT.name
                )
                total_rows = metric_expressions[
                    Metrics.ROW_COUNT.name
                ].aggregate_accumulator(agg[Metrics.ROW_COUNT.name])

                # Calculate initial deviation (will be recalculated for "Others")
                deviation = abs(total_missing_count - missing_values_expected_count)

                results_data.append(
                    {
                        DIMENSION_VALUE_KEY: dimension_value,
                        self.TOTAL_MISSING_COUNT: total_missing_count,
                        DIMENSION_TOTAL_COUNT_KEY: total_rows,
                        DIMENSION_FAILED_COUNT_KEY: deviation,
                    }
                )

            results_df = pd.DataFrame(results_data)

            if not results_df.empty:
                # Define recalculation function for deviation after aggregation
                def recalculate_failed_count(df_aggregated, others_mask, metric_column):
                    """Recalculate failed_count (deviation) for 'Others' from aggregated total_missing_count"""
                    result = df_aggregated[metric_column].copy()
                    if others_mask.any():
                        others_total = df_aggregated.loc[
                            others_mask, self.TOTAL_MISSING_COUNT
                        ].iloc[0]
                        # Deviation is the failed_count
                        result.loc[others_mask] = abs(
                            others_total - missing_values_expected_count
                        )
                    return result

                results_df = calculate_impact_score_pandas(
                    results_df,
                    failed_column=DIMENSION_FAILED_COUNT_KEY,
                    total_column=DIMENSION_TOTAL_COUNT_KEY,
                )

                results_df = aggregate_others_statistical_pandas(
                    results_df,
                    dimension_column=DIMENSION_VALUE_KEY,
                    top_n=DEFAULT_TOP_DIMENSIONS,
                    agg_functions={
                        self.TOTAL_MISSING_COUNT: "sum",  # Sum actual missing counts
                        DIMENSION_TOTAL_COUNT_KEY: "sum",
                        DIMENSION_FAILED_COUNT_KEY: "sum",  # This will be recalculated for Others
                    },
                    final_metric_calculators={
                        DIMENSION_FAILED_COUNT_KEY: recalculate_failed_count,  # Recalculate deviation for Others
                    },
                    # No violation_predicate needed - deviation IS the failed_count
                )

                for row_dict in results_df.to_dict("records"):
                    metric_values = self._build_metric_values_from_row(
                        row_dict, metrics_to_compute, test_params
                    )

                    # Need to add the calculated metric here.
                    metric_values[self.TOTAL_MISSING_COUNT] = row_dict.get(
                        self.TOTAL_MISSING_COUNT
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
