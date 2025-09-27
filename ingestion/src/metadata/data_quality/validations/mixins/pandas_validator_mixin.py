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
Validator Mixin for Pandas based tests cases
"""

from typing import Any, Dict, List, Optional

from metadata.profiler.metrics.core import add_props
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.datalake.datalake_utils import GenericDataFrameColumnParser
from metadata.utils.entity_link import get_decoded_column
from metadata.utils.sqa_like_column import SQALikeColumn


class PandasValidatorMixin:
    """Validator mixin for Pandas based test cases"""

    def get_column_name(self, entity_link: str, dfs) -> SQALikeColumn:
        # we'll use the first dataframe chunk to get the column name.
        column = dfs[0][get_decoded_column(entity_link)]
        _type = GenericDataFrameColumnParser.fetch_col_types(
            dfs[0], get_decoded_column(entity_link)
        )
        sqa_like_column = SQALikeColumn(
            name=column.name,
            type=_type,
        )
        return sqa_like_column

    def run_dataframe_results(
        self,
        runner,
        metric: Metrics,
        column: Optional[SQALikeColumn] = None,
        **kwargs,
    ) -> Optional[int]:
        """Run the test case on a dataframe

        Args:
            runner (DataFrame): a dataframe
            metric (Metrics): a metric
            column (SQALikeColumn): a column
        """

        metric_obj = add_props(**kwargs)(metric.value) if kwargs else metric.value
        metric_fn = (
            metric_obj(column).df_fn if column is not None else metric_obj().df_fn
        )

        try:
            return metric_fn(runner)
        except Exception as exc:
            raise RuntimeError(exc)

    def run_dataframe_dimensional_results(
        self,
        runner,
        metrics_to_compute: Dict[str, Metrics],
        column: SQALikeColumn,
        dimension_columns: List[str],
        **kwargs,
    ) -> List[Dict[str, Any]]:
        """Run dimensional test case on a dataframe with GROUP BY functionality

        This method follows the same pattern as run_dataframe_results but supports
        dimensional grouping by multiple columns, making it reusable across all
        pandas validators that need dimensional validation.

        Args:
            runner: DataFrame or List[DataFrame] to run the test case against
            metrics_to_compute: Dictionary mapping metric names to Metrics objects
            column: The main column being validated
            dimension_columns: List of column names to group by
            **kwargs: Additional properties for metrics

        Returns:
            List[Dict[str, Any]]: List of results, each containing dimension values and metric results
        """
        try:
            # Get the main dataframe from the runner
            if isinstance(runner, list) and len(runner) > 0:
                df = runner[0]  # Take the first dataframe
            else:
                df = runner

            # Perform groupby operation on the dataframe
            grouped = df.groupby(dimension_columns)

            dimensional_results = []

            # Calculate metrics for each group
            for group_key, group_data in grouped:
                # Pandas groupby always returns tuples for group keys, even for single columns
                # So we can always use the dictionary comprehension approach
                dimension_values = {
                    dim: str(val) for dim, val in zip(dimension_columns, group_key)
                }

                # Calculate each metric for this group using the same pattern as run_dataframe_results
                metric_results = {}
                for metric_name, metric in metrics_to_compute.items():
                    metric_obj = (
                        add_props(**kwargs)(metric.value) if kwargs else metric.value
                    )
                    metric_fn = (
                        metric_obj(column).df_fn
                        if column is not None
                        else metric_obj().df_fn
                    )

                    # Apply the metric function to the group data
                    metric_results[metric_name] = metric_fn(group_data)

                # Combine dimension values with metric results
                result = {
                    "dimension_values": dimension_values,
                    "metrics": metric_results,
                }
                dimensional_results.append(result)

            return dimensional_results

        except Exception as exc:
            raise RuntimeError(f"Error in dimensional validation: {exc}")

    def _compute_row_count(self, runner, column: SQALikeColumn, **kwargs):
        """compute row count

        Args:
            runner (List[DataFrame]): runner to run the test case against)
            column (SQALikeColumn): column to compute row count for
        """
        return self.run_dataframe_results(runner, Metrics.ROW_COUNT, column, **kwargs)
