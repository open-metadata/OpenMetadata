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

from typing import Optional

import pandas as pd

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_FAILED_COUNT_KEY,
    DIMENSION_NULL_LABEL,
    DIMENSION_TOTAL_COUNT_KEY,
)
from metadata.data_quality.validations.column.base.columnValuesToBeInSet import (
    ALLOWED_VALUE_COUNT,
    BaseColumnValuesToBeInSetValidator,
)
from metadata.data_quality.validations.impact_score import (
    DEFAULT_TOP_DIMENSIONS,
    aggregate_others_pandas,
    calculate_impact_score_pandas,
)
from metadata.data_quality.validations.mixins.pandas_validator_mixin import (
    PandasValidatorMixin,
)
from metadata.generated.schema.tests.basic import TestResultValue
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.logger import test_suite_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = test_suite_logger()


class ColumnValuesToBeInSetValidator(
    BaseColumnValuesToBeInSetValidator, PandasValidatorMixin
):
    """Validator for column value to be in set test case"""

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

    def _run_results(
        self, metric: Metrics, column: SQALikeColumn, **kwargs
    ) -> Optional[int]:
        """compute result of the test case

        Args:
            metric: metric
            column: column
        """
        return self.run_dataframe_results(self.runner, metric, column, **kwargs)

    def compute_row_count(self, column: SQALikeColumn):
        """Compute row count for the given column

        Args:
            column (Union[SQALikeColumn, Column]): column to compute row count for

        Raises:
            NotImplementedError:
        """
        return self._compute_row_count(self.runner, column)

    def _execute_dimensional_query(
        self, column, dimension_col, metrics_to_compute, test_params
    ):
        """Execute dimensional query with impact scoring and Others aggregation for pandas

        Args:
            column: The column being validated
            dimension_col: Single SQALikeColumn object corresponding to the dimension column
            metrics_to_compute: Dictionary mapping metric names to Metrics objects
            test_params: Dictionary with test-specific parameters (allowed_values, match_enum)

        Returns:
            List[DimensionResult]: Top N dimensions by impact score plus "Others"
        """
        dimension_results = []

        try:
            # Extract test parameters
            allowed_values = test_params["allowed_values"]
            match_enum = test_params["match_enum"]

            # Get the dataframe
            dfs = self.runner if isinstance(self.runner, list) else [self.runner]
            df = dfs[0]

            # Group by dimension column
            grouped = df.groupby(dimension_col.name, dropna=False)

            # Prepare results dataframe
            results_data = []

            for dimension_value, group_df in grouped:
                # Handle NULL values
                if pd.isna(dimension_value):
                    dimension_value = DIMENSION_NULL_LABEL
                else:
                    dimension_value = str(dimension_value)

                # Calculate metrics for this group
                count_in_set = group_df[column.name].isin(allowed_values).sum()

                if match_enum:
                    row_count = len(group_df)
                    failed_count = row_count - count_in_set

                    results_data.append(
                        {
                            "dimension": dimension_value,
                            "count_in_set": count_in_set,
                            "row_count": row_count,
                            DIMENSION_TOTAL_COUNT_KEY: row_count,
                            DIMENSION_FAILED_COUNT_KEY: failed_count,
                        }
                    )
                else:
                    # Non-enum mode
                    results_data.append(
                        {
                            "dimension": dimension_value,
                            "count_in_set": count_in_set,
                            DIMENSION_TOTAL_COUNT_KEY: count_in_set,
                            DIMENSION_FAILED_COUNT_KEY: 0,
                        }
                    )

            # Create DataFrame with results
            results_df = pd.DataFrame(results_data)

            if not results_df.empty:
                # Calculate impact scores
                results_df = calculate_impact_score_pandas(
                    results_df,
                    failed_column=DIMENSION_FAILED_COUNT_KEY,
                    total_column=DIMENSION_TOTAL_COUNT_KEY,
                )

                # Aggregate Others
                results_df = aggregate_others_pandas(
                    results_df,
                    dimension_column="dimension",
                    top_n=DEFAULT_TOP_DIMENSIONS,
                )

                # Process results into DimensionResult objects
                for _, row in results_df.iterrows():
                    dimension_value = row["dimension"]

                    # Extract metric values
                    count_in_set = int(row.get("count_in_set", 0))

                    if match_enum:
                        total_count = int(row.get("row_count", 0))
                        failed_count = int(row.get(DIMENSION_FAILED_COUNT_KEY, 0))
                        matched = total_count - count_in_set == 0
                    else:
                        total_count = count_in_set
                        failed_count = 0
                        matched = count_in_set > 0

                    impact_score = float(row.get("impact_score", 0.0))

                    # Create dimension result
                    dimension_result = self.get_dimension_result_object(
                        dimension_values={dimension_col.name: dimension_value},
                        test_case_status=self.get_test_case_status(matched),
                        result=f"Dimension {dimension_col.name}={dimension_value}: Found countInSet={count_in_set}",
                        test_result_value=[
                            TestResultValue(
                                name=ALLOWED_VALUE_COUNT, value=str(count_in_set)
                            ),
                        ],
                        total_rows=total_count,
                        passed_rows=count_in_set,
                        failed_rows=failed_count if match_enum else None,
                        impact_score=impact_score if match_enum else None,
                    )

                    dimension_results.append(dimension_result)

        except Exception as exc:
            logger.warning(f"Error executing dimensional query: {exc}")
            logger.debug("Full error details: ", exc_info=True)

        return dimension_results
