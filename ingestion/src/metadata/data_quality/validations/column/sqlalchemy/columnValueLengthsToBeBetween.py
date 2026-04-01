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
Validator for column value length to be between test case
"""
import math
from typing import List, Optional

from sqlalchemy import Column

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_TOTAL_COUNT_KEY,
)
from metadata.data_quality.validations.column.base.columnValueLengthsToBeBetween import (
    BaseColumnValueLengthsToBeBetweenValidator,
)
from metadata.data_quality.validations.mixins.failed_row_sampler_mixin import (
    SQARowSamplerMixin,
)
from metadata.data_quality.validations.mixins.failed_sample_validator_mixin import (
    FailedSampleValidatorMixin,
)
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.generated.schema.entity.data.table import TableData
from metadata.generated.schema.tests.dimensionResult import DimensionResult
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.orm.functions.length import LenFn
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class ColumnValueLengthsToBeBetweenValidator(
    FailedSampleValidatorMixin,
    BaseColumnValueLengthsToBeBetweenValidator,
    SQAValidatorMixin,
    SQARowSamplerMixin,
):
    """Validator for column value length to be between test case"""

    def _run_results(self, metric: Metrics, column: Column) -> Optional[int]:
        """compute result of the test case

        Args:
            metric: metric for computation
            column: column
        """
        return self.run_query_results(self.runner, metric, column)

    def compute_row_count(self, column: Column, min_bound: int, max_bound: int):
        """Compute row count for the given column

        Args:
            column (Union[SQALikeColumn, Column]): column to compute row count for
            min_bound (_type_): min bound to filter out rows within the bound
            max_bound (_type_): max bound to filter out rows within the bound

        Raises:
            NotImplementedError:
        """
        row_count = self._compute_row_count(self.runner, column)
        filters = []
        if min_bound > -math.inf:
            filters.append((LenFn(column), "lt", min_bound))
        if max_bound < math.inf:
            filters.append((LenFn(column), "gt", max_bound))
        failed_rows = self._compute_row_count_between(
            self.runner,
            column,
            {
                "filters": filters,
                "or_filter": True,
            },
        )

        return row_count, failed_rows

    def _build_dimension_metric_values(self, row, metrics_to_compute, test_params=None):
        min_len_value = row.get(Metrics.minLength.name)
        max_len_value = row.get(Metrics.maxLength.name)
        if min_len_value is None or max_len_value is None:
            return None
        return {
            Metrics.minLength.name: min_len_value,
            Metrics.maxLength.name: max_len_value,
            DIMENSION_TOTAL_COUNT_KEY: row.get(DIMENSION_TOTAL_COUNT_KEY),
            DIMENSION_FAILED_COUNT_KEY: row.get(DIMENSION_FAILED_COUNT_KEY),
        }

    def _execute_dimensional_validation(
        self,
        column: Column,
        dimension_col: Column,
        metrics_to_compute: dict,
        test_params: dict,
        top_n: int,
    ) -> List[DimensionResult]:
        """Execute dimensional validation for max with proper aggregation

        Uses the statistical aggregation helper to:
        1. Compute raw metrics (max) per dimension
        2. Calculate impact score based on whether max is within bounds
        3. Aggregate "Others" using MAX(individual_maxes)

        Args:
            column: The column being validated
            dimension_col: The dimension column to group by
            metrics_to_compute: Dict mapping metric names to Metrics enums
            test_params: Test parameters (min/max bounds)

        Returns:
            List[DimensionResult]: Top N dimensions plus "Others"
        """
        dimension_results = []

        try:
            checker = self._get_validation_checker(test_params)

            metric_expressions = {
                DIMENSION_TOTAL_COUNT_KEY: Metrics.rowCount().fn(),
                Metrics.minLength.name: Metrics.minLength(column).fn(),
                Metrics.maxLength.name: Metrics.maxLength(column).fn(),
                DIMENSION_FAILED_COUNT_KEY: checker.build_row_level_violations_sqa(
                    LenFn(column)
                ),
            }

            normalized_dimension = self._get_normalized_dimension_expression(
                dimension_col
            )

            result_rows = self._run_dimensional_validation_query(
                source=self.runner.dataset,
                dimension_expr=normalized_dimension,
                metric_expressions=metric_expressions,
                top_n=top_n,
            )

            return self._process_dimension_rows(
                result_rows, dimension_col.name, metrics_to_compute, test_params
            )

        except Exception as exc:
            logger.warning(f"Error executing dimensional query: {exc}")
            logger.debug("Full error details: ", exc_info=True)

        return dimension_results

    def filter(self):
        min_bound = self.get_min_bound("minLength")
        max_bound = self.get_max_bound("maxLength")
        filters = []
        if min_bound is not None and min_bound > float("-inf"):
            filters.append((LenFn(self.get_column()), "lt", min_bound))
        if max_bound is not None and max_bound < float("inf"):
            filters.append((LenFn(self.get_column()), "gt", max_bound))
        return {
            "filters": filters,
            "or_filter": True,
        }

    def fetch_failed_rows_sample(self):
        cols, rows = self._get_failed_rows_sample()
        return TableData(columns=cols, rows=rows)
