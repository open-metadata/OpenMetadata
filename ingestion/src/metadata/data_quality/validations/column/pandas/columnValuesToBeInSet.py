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

from collections import defaultdict
from typing import List, Optional, cast

import pandas as pd

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_TOTAL_COUNT_KEY,
    DIMENSION_VALUE_KEY,
)
from metadata.data_quality.validations.column.base.columnValuesToBeInSet import (
    BaseColumnValuesToBeInSetValidator,
)
from metadata.data_quality.validations.impact_score import (
    DEFAULT_TOP_DIMENSIONS,
    calculate_impact_score_pandas,
)
from metadata.data_quality.validations.mixins.pandas_validator_mixin import (
    PandasValidatorMixin,
    aggregate_others_pandas,
)
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.core import add_props
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = test_suite_logger()


class ColumnValuesToBeInSetValidator(
    BaseColumnValuesToBeInSetValidator, PandasValidatorMixin
):
    """Validator for column value to be in set test case"""

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

        For in-set validation, we accumulate counts across dataframes to accurately
        track how many values are in the allowed set per dimension.

        Args:
            column: The column being validated
            dimension_col: Single SQALikeColumn object corresponding to the dimension column
            metrics_to_compute: Dictionary mapping Metrics enum names to Metrics objects
            test_params: Dictionary with test-specific parameters (allowed_values, match_enum)

        Returns:
            List[DimensionResult]: Top N dimensions by impact score plus "Others"
        """
        dimension_results = []

        try:
            allowed_values = test_params[
                BaseColumnValuesToBeInSetValidator.ALLOWED_VALUES
            ]
            match_enum = test_params[BaseColumnValuesToBeInSetValidator.MATCH_ENUM]

            dfs = self.runner if isinstance(self.runner, list) else [self.runner]
            count_in_set_impl = add_props(values=allowed_values)(
                Metrics.COUNT_IN_SET.value
            )(column).get_pandas_computation()
            row_count_impl = Metrics.ROW_COUNT().get_pandas_computation()

            dimension_aggregates = defaultdict(
                lambda: {
                    Metrics.COUNT_IN_SET.name: count_in_set_impl.create_accumulator(),
                    Metrics.ROW_COUNT.name: row_count_impl.create_accumulator(),
                }
            )

            for df in dfs:
                df_typed = cast(pd.DataFrame, df)
                grouped = df_typed.groupby(dimension_col.name, dropna=False)

                for dimension_value, group_df in grouped:
                    dimension_value = self.format_dimension_value(dimension_value)

                    dimension_aggregates[dimension_value][
                        Metrics.COUNT_IN_SET.name
                    ] = count_in_set_impl.update_accumulator(
                        dimension_aggregates[dimension_value][
                            Metrics.COUNT_IN_SET.name
                        ],
                        group_df,
                    )
                    dimension_aggregates[dimension_value][
                        Metrics.ROW_COUNT.name
                    ] = row_count_impl.update_accumulator(
                        dimension_aggregates[dimension_value][Metrics.ROW_COUNT.name],
                        group_df,
                    )

            results_data = []
            for dimension_value, agg in dimension_aggregates.items():
                count_in_set = count_in_set_impl.aggregate_accumulator(
                    agg[Metrics.COUNT_IN_SET.name]
                )
                row_count = row_count_impl.aggregate_accumulator(
                    agg[Metrics.ROW_COUNT.name]
                )

                if match_enum:
                    failed_count = row_count - count_in_set

                    results_data.append(
                        {
                            DIMENSION_VALUE_KEY: dimension_value,
                            Metrics.COUNT_IN_SET.name: count_in_set,
                            Metrics.ROW_COUNT.name: row_count,
                            DIMENSION_TOTAL_COUNT_KEY: row_count,
                            DIMENSION_FAILED_COUNT_KEY: failed_count,
                        }
                    )
                else:
                    results_data.append(
                        {
                            DIMENSION_VALUE_KEY: dimension_value,
                            Metrics.COUNT_IN_SET.name: count_in_set,
                            Metrics.ROW_COUNT.name: count_in_set,
                            DIMENSION_TOTAL_COUNT_KEY: row_count,
                            DIMENSION_FAILED_COUNT_KEY: 0,
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
                    dimension_column=DIMENSION_VALUE_KEY,
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

    def compute_row_count(self, column: SQALikeColumn):
        """Compute row count for the given column

        Args:
            column (Union[SQALikeColumn, Column]): column to compute row count for

        Raises:
            NotImplementedError:
        """
        return self._compute_row_count(self.runner, column)
