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
Validator for column values to be between test case
"""

from collections import defaultdict
from datetime import datetime
from typing import List, Optional, cast

import pandas as pd

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_TOTAL_COUNT_KEY,
    DIMENSION_VALUE_KEY,
)
from metadata.data_quality.validations.column.base.columnValuesToBeBetween import (
    BaseColumnValuesToBeBetweenValidator,
)
from metadata.data_quality.validations.impact_score import calculate_impact_score_pandas
from metadata.data_quality.validations.mixins.failed_row_sampler_mixin import (
    PandasFailedRowSamplerMixin,
)
from metadata.data_quality.validations.mixins.failed_sample_validator_mixin import (
    FailedSampleValidatorMixin,
)
from metadata.data_quality.validations.mixins.pandas_validator_mixin import (
    PandasValidatorMixin,
    aggregate_others_statistical_pandas,
)
from metadata.generated.schema.entity.data.table import TableData
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.orm.registry import is_date_time
from metadata.utils.logger import test_suite_logger
from metadata.utils.sqa_like_column import SQALikeColumn
from metadata.utils.time_utils import convert_timestamp

logger = test_suite_logger()


class ColumnValuesToBeBetweenValidator(
    FailedSampleValidatorMixin,
    BaseColumnValuesToBeBetweenValidator,
    PandasValidatorMixin,
    PandasFailedRowSamplerMixin,
):
    """Validator for column values to be between test case"""

    def _run_results(self, metric: Metrics, column: SQALikeColumn) -> Optional[int]:
        """compute result of the test case

        Args:
            metric: metric
            column: column
        """
        return self.run_dataframe_results(self.runner, metric, column)

    def _build_dimension_metric_values(self, row, metrics_to_compute, test_params=None):
        metric_values = self._build_metric_values_from_row(
            row, metrics_to_compute, test_params
        )
        metric_values[DIMENSION_TOTAL_COUNT_KEY] = row.get(DIMENSION_TOTAL_COUNT_KEY)
        metric_values[DIMENSION_FAILED_COUNT_KEY] = row.get(DIMENSION_FAILED_COUNT_KEY)
        return metric_values

    def _execute_dimensional_validation(
        self,
        column: SQALikeColumn,
        dimension_col: SQALikeColumn,
        metrics_to_compute: dict,
        test_params: dict,
        top_n: int,
    ) -> List[DimensionResult]:
        """Execute dimensional validation for values to be between with proper aggregation

        Follows the iterate pattern from the Mean metric's df_fn method to handle
        multiple dataframes efficiently without concatenating them in memory.

        Memory-efficient approach: Instead of concatenating all dataframes (which creates
        a full copy in memory), we iterate over them and accumulate aggregates. This is
        especially important for large parquet files split across many chunks.

        For values to be between validator, we accumulate min and max values across dataframes
        to accurately compute the overall min and max values per dimension. MIN and MAX aggregates
        naturally: min(min1, min2, ...) = overall_min, max(max1, max2, ...) = overall_max.

        Args:
            column: The column being validated
            dimension_col: Single SQALikeColumn object corresponding to the dimension column
            metrics_to_compute: Dictionary mapping Metrics enum names to Metrics objects
            test_params: Dictionary with test-specific parameters (min/max bounds)

        Returns:
            List[DimensionResult]: Top N dimensions by impact score plus "Others"
        """
        checker = self._get_validation_checker(test_params)
        dimension_results = []

        try:
            dfs = self.runner
            min_impl = Metrics.min(column).get_pandas_computation()
            max_impl = Metrics.max(column).get_pandas_computation()
            row_count_impl = Metrics.rowCount().get_pandas_computation()

            dimension_aggregates = defaultdict(
                lambda: {
                    Metrics.min.name: min_impl.create_accumulator(),
                    Metrics.max.name: max_impl.create_accumulator(),
                    DIMENSION_TOTAL_COUNT_KEY: row_count_impl.create_accumulator(),
                    DIMENSION_FAILED_COUNT_KEY: 0,
                }
            )

            for df in dfs:
                df_typed = cast(pd.DataFrame, df)
                grouped = df_typed.groupby(dimension_col.name, dropna=False)

                for dimension_value, group_df in grouped:
                    dimension_value = self.format_dimension_value(dimension_value)

                    dimension_aggregates[dimension_value][
                        Metrics.min.name
                    ] = min_impl.update_accumulator(
                        dimension_aggregates[dimension_value][Metrics.min.name],
                        group_df,
                    )
                    dimension_aggregates[dimension_value][
                        Metrics.max.name
                    ] = max_impl.update_accumulator(
                        dimension_aggregates[dimension_value][Metrics.max.name],
                        group_df,
                    )

                    dimension_aggregates[dimension_value][
                        DIMENSION_TOTAL_COUNT_KEY
                    ] = row_count_impl.update_accumulator(
                        dimension_aggregates[dimension_value][
                            DIMENSION_TOTAL_COUNT_KEY
                        ],
                        group_df,
                    )

                    # Count row-level violations using checker's unified logic
                    col_values = group_df[column.name]
                    violations_mask = checker.get_violations_mask(col_values)
                    dimension_aggregates[dimension_value][
                        DIMENSION_FAILED_COUNT_KEY
                    ] += violations_mask.sum()

            results_data = []
            for dimension_value, agg in dimension_aggregates.items():
                min_value = min_impl.aggregate_accumulator(agg[Metrics.min.name])
                max_value = max_impl.aggregate_accumulator(agg[Metrics.max.name])
                total_rows = row_count_impl.aggregate_accumulator(
                    agg[DIMENSION_TOTAL_COUNT_KEY]
                )
                failed_count = agg[DIMENSION_FAILED_COUNT_KEY]

                if min_value is None or max_value is None:
                    logger.warning(
                        "Skipping '%s=%s' dimension since 'min' or 'max' are 'None'",
                        dimension_col.name,
                        dimension_value,
                    )
                    continue

                # Normalize values (convert date to datetime if needed)
                min_value = self._normalize_metric_value(min_value, is_min=True)
                max_value = self._normalize_metric_value(max_value, is_min=False)

                results_data.append(
                    {
                        DIMENSION_VALUE_KEY: dimension_value,
                        Metrics.min.name: min_value,
                        Metrics.max.name: max_value,
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
                    agg_functions={
                        Metrics.min.name: "min",
                        Metrics.max.name: "max",
                        DIMENSION_TOTAL_COUNT_KEY: "sum",
                        DIMENSION_FAILED_COUNT_KEY: "sum",
                    },
                    top_n=top_n,
                    violation_metrics=[
                        Metrics.min.name,
                        Metrics.max.name,
                    ],
                    violation_predicate=checker.violates_pandas,
                )

                dimension_results = self._process_dimension_rows(
                    results_df.to_dict("records"),
                    dimension_col.name,
                    metrics_to_compute,
                    test_params,
                )

        except Exception as exc:
            logger.warning(f"Error executing dimensional query: {exc}")
            logger.debug("Full error details: ", exc_info=True)

        return dimension_results

    def compute_row_count(self, column: SQALikeColumn, min_bound: int, max_bound: int):
        """Compute row count for the given column

        Args:
            column (Union[SQALikeColumn, Column]): column to compute row count for
            min_bound (_type_): min bound to filter out rows within the bound
            max_bound (_type_): max bound to filter out rows within the bound

        Raises:
            NotImplementedError:
        """
        row_count = self._compute_row_count(self.runner, column)
        failed_rows = sum(
            len(
                runner.query(
                    f"`{column.name}` > {max_bound} or `{column.name}` < {min_bound}"
                )
            )
            for runner in self.runner  # type: ignore
        )

        return row_count, failed_rows

    def filter(self):
        column = self.get_column()
        if is_date_time(column.type):
            min_bound = self.get_test_case_param_value(
                self.test_case.parameterValues,
                "minValue",
                type_=datetime.fromtimestamp,
                default=datetime.min,
                pre_processor=convert_timestamp,
            )
            max_bound = self.get_test_case_param_value(
                self.test_case.parameterValues,
                "maxValue",
                type_=datetime.fromtimestamp,
                default=datetime.max,
                pre_processor=convert_timestamp,
            )
        else:
            min_bound = self.get_min_bound("minValue")
            max_bound = self.get_max_bound("maxValue")
        filters = []
        if min_bound is not None:
            filters.append(f"{column.name} < {min_bound}")
        if max_bound is not None:
            filters.append(f"{column.name} > {max_bound}")
        return " or ".join(filters)

    def fetch_failed_rows_sample(self):
        cols, rows = self._get_failed_rows_sample()
        return TableData(columns=cols, rows=rows)
