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

from typing import Any, Callable, Dict, List, Mapping, Optional, Union, cast

import numpy as np
import pandas as pd

from metadata.data_quality.validations.base_test_handler import (
    DIMENSION_NULL_LABEL,
    DIMENSION_OTHERS_LABEL,
)
from metadata.data_quality.validations.impact_score import (
    DEFAULT_NORMALIZATION_FACTOR,
    DEFAULT_SAMPLE_WEIGHT_THRESHOLD,
    DEFAULT_TOP_DIMENSIONS,
    get_volume_factor,
)
from metadata.data_quality.validations.mixins.protocols import HasValidatorContext
from metadata.profiler.metrics.core import add_props
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.datalake.datalake_utils import GenericDataFrameColumnParser
from metadata.utils.entity_link import get_decoded_column
from metadata.utils.sqa_like_column import SQALikeColumn


class PandasValidatorMixin:
    """Validator mixin for Pandas based test cases"""

    def get_column(
        self: HasValidatorContext, column_name: Optional[str] = None
    ) -> SQALikeColumn:
        """Get column object for the given column name

        If column_name is None, returns the main column being validated.
        If column_name is provided, returns the column object for that specific column.

        Args:
            column_name: Optional column name. If None, returns the main validation column.

        Returns:
            SQALikeColumn: Column object
        """
        if column_name is None:
            return PandasValidatorMixin.get_column_from_list(
                self.test_case.entityLink.root,
                cast(List[pd.DataFrame], self.runner),
            )
        else:
            return PandasValidatorMixin.get_column_from_list(
                column_name,
                cast(List[pd.DataFrame], self.runner),
            )

    @staticmethod
    def get_column_from_list(entity_link: str, dfs) -> SQALikeColumn:
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

    def _compute_row_count(self, runner, column: SQALikeColumn, **kwargs):
        """compute row count

        Args:
            runner (List[DataFrame]): runner to run the test case against)
            column (SQALikeColumn): column to compute row count for
        """
        return self.run_dataframe_results(runner, Metrics.ROW_COUNT, column, **kwargs)

    @staticmethod
    def format_dimension_value(value) -> str:
        """Format a dimension value, handling NULL/NA values consistently

        Args:
            value: Raw dimension value from pandas groupby

        Returns:
            str: Formatted dimension value ("NULL" for NA/None values, str() for others)
        """
        if pd.isna(value):
            return DIMENSION_NULL_LABEL
        return str(value)


def aggregate_others_pandas(
    df,
    dimension_column: str,
    top_n: int = DEFAULT_TOP_DIMENSIONS,
    impact_column: str = "impact_score",
    others_label: str = DIMENSION_OTHERS_LABEL,
):
    """
    Aggregate low-impact dimensions into an "Others" category for pandas DataFrames.

    Similar to the cardinality distribution pattern, this keeps the top N
    dimensions by impact score and groups the rest into "Others".

    Args:
        df: DataFrame with dimension results and impact scores
        dimension_column: Name of the dimension column
        top_n: Number of top dimensions to keep (default: 5)
        impact_column: Name of the impact score column
        others_label: Label for aggregated dimensions (default: "Others")

    Returns:
        DataFrame with top N dimensions plus "Others"

    Example:
        >>> df = pd.DataFrame({
        ...     'country': ['USA', 'UK', 'FR', 'DE', 'IT', 'ES', 'PT'],
        ...     'failed_count': [9000, 800, 700, 50, 30, 20, 10],
        ...     'total_count': [10000, 1000, 1000, 100, 100, 100, 100],
        ...     'impact_score': [0.81, 0.32, 0.25, 0.03, 0.01, 0.004, 0.001]
        ... })
        >>> result = aggregate_others_pandas(df, 'country', top_n=3)
        >>> print(result)
           country  failed_count  total_count  impact_score
        0      USA          9000        10000         0.810
        1       UK           800         1000         0.320
        2       FR           700         1000         0.250
        3   Others           110          400         0.007
    """
    # Sort by impact score descending
    df_sorted = df.sort_values(by=impact_column, ascending=False)

    # Get top N dimensions
    top_dimensions = df_sorted.head(top_n)[dimension_column].tolist()

    # Create a new column for grouping
    df["dimension_group"] = np.where(
        df[dimension_column].isin(top_dimensions), df[dimension_column], others_label
    )

    # Aggregate by dimension_group
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    agg_dict = {col: "sum" for col in numeric_cols if col != impact_column}

    df_aggregated = df.groupby("dimension_group", as_index=False).agg(agg_dict)

    # Recalculate impact score for "Others"
    if others_label in df_aggregated["dimension_group"].values:
        others_mask = df_aggregated["dimension_group"] == others_label
        if (
            "failed_count" in df_aggregated.columns
            and "total_count" in df_aggregated.columns
        ):
            others_row = df_aggregated[others_mask]
            if not others_row.empty:
                # Recalculate impact score using the pandas formula
                failed = others_row["failed_count"].values[0]
                total = others_row["total_count"].values[0]

                if total > 0:
                    failure_rate = failed / total
                    failure_severity = failure_rate**2
                    volume_factor = get_volume_factor(total)
                    sample_weight = min(1.0, total / DEFAULT_SAMPLE_WEIGHT_THRESHOLD)
                    raw_impact = failure_severity * volume_factor * sample_weight
                    normalized_impact = raw_impact / DEFAULT_NORMALIZATION_FACTOR
                    impact_score = min(1.0, max(0.0, normalized_impact))
                else:
                    impact_score = 0.0

                df_aggregated.loc[others_mask, impact_column] = impact_score

    # For non-Others rows, take the max impact score from original
    for dim in top_dimensions:
        dim_mask = df_aggregated["dimension_group"] == dim
        if dim_mask.any():
            original_score = df[df[dimension_column] == dim][impact_column].max()
            df_aggregated.loc[dim_mask, impact_column] = original_score

    # Sort by impact score again
    df_aggregated = df_aggregated.sort_values(by=impact_column, ascending=False)

    # Rename dimension_group back to original column name
    df_aggregated.rename(columns={"dimension_group": dimension_column}, inplace=True)

    return df_aggregated


def aggregate_others_statistical_pandas(
    df,
    dimension_column: str,
    final_metric_calculators: Optional[
        Dict[str, Callable[["pd.DataFrame", "pd.Series", str], "pd.Series"]]
    ] = None,
    top_n: int = DEFAULT_TOP_DIMENSIONS,
    impact_column: str = "impact_score",
    others_label: str = DIMENSION_OTHERS_LABEL,
    exclude_from_final: Optional[List[str]] = None,
    agg_functions: Optional[Dict[str, Union[str, Callable]]] = None,
    violation_metrics: Optional[List[str]] = None,
    violation_predicate: Optional[Callable[[Mapping[str, Any]], bool]] = None,
):
    """
    Aggregate low-impact dimensions into "Others" using function-based statistical aggregation.

    This function provides a flexible interface for statistical aggregation by using
    function parameters, similar to the SQA version but for pandas DataFrames.

    Args:
        df: DataFrame with dimension results
        dimension_column: Name of the dimension column
        final_metric_calculators: Optional dict mapping metric names to functions that calculate
            final metrics after aggregation (for derived metrics like weighted mean from sum/count).
            Only needed when metric requires multiple columns (e.g., mean = sum/count).
        top_n: Number of top dimensions to keep (default: 5)
        impact_column: Name of the impact score column
        others_label: Label for aggregated dimensions (default: "Others")
        exclude_from_final: Optional list of metric names to exclude from final output
        agg_functions: Optional dict mapping column names to pandas aggregation functions
            (e.g., {"MAX": "max", "MIN": "min"}). Defaults to "sum" for unspecified columns.
            Use this for simple metrics that aggregate correctly (max, min, median).
            Use final_metric_calculators for derived metrics (mean = sum/count).

    Returns:
        DataFrame with top N dimensions plus "Others"

    Example:
        >>> def calculate_failed_count(df_grouped):
        ...     within_bounds = (df_grouped["mean"] >= 10.0) & (df_grouped["mean"] <= 100.0)
        ...     return np.where(within_bounds, 0, df_grouped["total_count"])
        >>>
        >>> def calculate_weighted_mean(df_aggregated, others_mask, metric_column):
        ...     result = df_aggregated[metric_column].copy()
        ...     if others_mask.any():
        ...         others_sum = df_aggregated.loc[others_mask, "sum_value"].iloc[0]
        ...         others_count = df_aggregated.loc[others_mask, "total_count"].iloc[0]
        ...         if others_count > 0:
        ...             result.loc[others_mask] = others_sum / others_count
        ...     return result
        >>>
        >>> result = aggregate_others_statistical_pandas(
        ...     df, 'country', calculate_failed_count,
        ...     {"mean": calculate_weighted_mean}, exclude_from_final=["sum_value"]
        ... )
    """
    exclude_from_final = exclude_from_final or []
    agg_functions = agg_functions or {}
    final_metric_calculators = final_metric_calculators or {}
    violation_metrics = violation_metrics or []

    # Sort by impact score descending
    df_sorted = df.sort_values(by=impact_column, ascending=False)
    top_dimensions = df_sorted.head(top_n)[dimension_column].tolist()

    # Create dimension grouping
    df["dimension_group"] = np.where(
        df[dimension_column].isin(top_dimensions),
        df[dimension_column],
        others_label,
    )

    # Aggregate by dimension_group
    df_aggregated = df.groupby("dimension_group", as_index=False).agg(agg_functions)

    # For top dimensions, preserve their original metric values
    # NOTE: While top dimensions are single-row groups (aggregation doesn't change them),
    # we explicitly restore original values for clarity and defensive programming
    for metric_name, calculator in final_metric_calculators.items():
        if metric_name in df.columns:
            # For top dimensions, keep original values
            for top_dim in top_dimensions:
                top_mask = df_aggregated["dimension_group"] == top_dim
                if top_mask.any():
                    original_value = df[df[dimension_column] == top_dim][
                        metric_name
                    ].iloc[0]
                    df_aggregated.loc[top_mask, metric_name] = original_value

    # Apply final metric calculators for "Others"
    if others_label in df_aggregated["dimension_group"].values:
        others_mask = df_aggregated["dimension_group"] == others_label

        for metric_name, calculator in final_metric_calculators.items():
            if metric_name in df_aggregated.columns:
                df_aggregated.loc[others_mask, metric_name] = calculator(
                    df_aggregated, others_mask, metric_name
                )

        # Recompute failed_count for Others if violation condition provided
        if (
            violation_predicate is not None
            and "failed_count" in df_aggregated.columns
            and all(name in df_aggregated.columns for name in violation_metrics)
        ):
            metrics_df = df_aggregated.loc[others_mask, violation_metrics]
            total_series = df_aggregated.loc[others_mask, "total_count"]
            violation_mask = metrics_df.apply(
                lambda row: violation_predicate(
                    {name: row[name] for name in violation_metrics}
                ),
                axis=1,
            )
            df_aggregated.loc[others_mask, "failed_count"] = np.where(
                violation_mask, total_series, 0
            )

    # Recalculate impact score for "Others" (based on final failed_count and total_count)
    if others_label in df_aggregated["dimension_group"].values:
        others_mask = df_aggregated["dimension_group"] == others_label
        if (
            "failed_count" in df_aggregated.columns
            and "total_count" in df_aggregated.columns
        ):
            others_row = df_aggregated[others_mask]
            if not others_row.empty:
                # Recalculate impact score using the pandas formula
                failed = others_row["failed_count"].values[0]
                total = others_row["total_count"].values[0]

                if total > 0:
                    failure_rate = failed / total
                    failure_severity = failure_rate**2
                    volume_factor = get_volume_factor(total)
                    sample_weight = min(1.0, total / DEFAULT_SAMPLE_WEIGHT_THRESHOLD)
                    raw_impact = failure_severity * volume_factor * sample_weight
                    normalized_impact = raw_impact / DEFAULT_NORMALIZATION_FACTOR
                    impact_score = min(1.0, max(0.0, normalized_impact))
                else:
                    impact_score = 0.0

                df_aggregated.loc[others_mask, impact_column] = impact_score

    # For non-Others rows, take the max impact score from original
    for dim in top_dimensions:
        dim_mask = df_aggregated["dimension_group"] == dim
        if dim_mask.any():
            original_score = df[df[dimension_column] == dim][impact_column].max()
            df_aggregated.loc[dim_mask, impact_column] = original_score

    # Sort by impact score again
    df_aggregated = df_aggregated.sort_values(by=impact_column, ascending=False)

    # Rename dimension_group back to original column name
    df_aggregated.rename(columns={"dimension_group": dimension_column}, inplace=True)

    # Clean up excluded columns
    for col in exclude_from_final:
        if col in df_aggregated.columns:
            df_aggregated = df_aggregated.drop(columns=[col])

    return df_aggregated.sort_values(by=impact_column, ascending=False)
