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
Impact Score Calculation for Dimensional Test Results

This module provides SQLAlchemy expressions for calculating impact scores in dimensional
data quality queries. The impact score identifies which dimensions reveal the most
significant data quality issues by combining failure rate severity with data volume.

Impact Score Formula:
    impact = failure_rate² × volume_factor × sample_weight / 1.5

Formula Components Explained:

    1. failure_rate² (Quadratic Severity):
       - Squares the failure rate to emphasize high failure percentages
       - 10% failure → 0.01, 50% failure → 0.25, 90% failure → 0.81
       - Makes high failure rates disproportionately important

    2. volume_factor (Tiered Linear Scaling):
       - Uses conditional tiers instead of logarithm for database compatibility
       - SQLite and other databases may not have log functions available by default
       - Approximates logarithmic behavior with diminishing returns:
         * < 10 rows → 0.25
         * < 100 rows → 0.50
         * < 1,000 rows → 0.75
         * < 10,000 rows → 1.00
         * < 100,000 rows → 1.25
         * ≥ 100,000 rows → 1.50

    3. sample_weight = min(1.0, total/100) (Sample Size Credibility):
       - Reduces impact for very small samples that may not be statistically significant
       - Ramps from 0 to 1 as sample size grows to 100 rows
       - Prevents single-row outliers from having high impact scores

    4. Division by 1.5 (Normalization):
       - Normalizes scores to approximately 0-1 range
       - Based on maximum realistic values: 1.0 × 1.5 × 1.0 = 1.5

Why This Formula:
    - Balances failure severity with data volume to find truly impactful issues
    - Prevents both tiny samples and massive datasets from skewing results
    - Provides intuitive scoring where higher scores mean more urgent issues
    - Works consistently across tables of different sizes

Example Scores:
    - 1 row, 1 failed (100%): 0.025 (low - unreliable single sample)
    - 100 rows, 90 failed (90%): 0.405 (medium - concerning pattern)
    - 10,000 rows, 9,000 failed (90%): 0.810 (high - major issue at scale)
    - 10,000 rows, 1,000 failed (10%): 0.010 (low - minor issue despite volume)
"""

from typing import TYPE_CHECKING, Callable, Dict, List, Optional

from sqlalchemy import Float, case, func
from sqlalchemy.sql.expression import ClauseElement

from metadata.data_quality.validations.base_test_handler import DIMENSION_OTHERS_LABEL
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()

if TYPE_CHECKING:
    import pandas as pd

# Configuration constants
DEFAULT_SAMPLE_WEIGHT_THRESHOLD = 100.0  # Samples needed for full weight
DEFAULT_NORMALIZATION_FACTOR = 1.5  # Divisor to normalize scores to ~0-1 range
DEFAULT_TOP_DIMENSIONS = (
    5  # Number of top dimensions to show before grouping as "Others"
)

# Volume factor tiers for the impact score formula
VOLUME_FACTOR_TIERS = [
    (10, 0.25),  # < 10 rows
    (100, 0.50),  # < 100 rows
    (1000, 0.75),  # < 1,000 rows
    (10000, 1.00),  # < 10,000 rows
    (100000, 1.25),  # < 100,000 rows
]
VOLUME_FACTOR_MAX = 1.50  # >= 100,000 rows


def get_volume_factor(total_count: float) -> float:
    """
    Calculate the volume factor for a given row count.

    This function returns the appropriate volume factor based on
    the tiered thresholds defined in VOLUME_FACTOR_TIERS.

    Args:
        total_count: Number of total rows

    Returns:
        float: Volume factor value between 0.25 and 1.50
    """
    for threshold, factor in VOLUME_FACTOR_TIERS:
        if total_count < threshold:
            return factor
    return VOLUME_FACTOR_MAX


def get_volume_factor_expression(total_count: ClauseElement) -> ClauseElement:
    """
    Generate SQLAlchemy expression for volume factor calculation.

    Creates a CASE statement that implements the tiered volume factor.

    Args:
        total_count: SQLAlchemy expression for total row count

    Returns:
        SQLAlchemy CASE expression for volume factor
    """
    conditions = []
    for threshold, factor in VOLUME_FACTOR_TIERS:
        conditions.append((total_count < threshold, factor))

    return case(conditions, else_=VOLUME_FACTOR_MAX)


def get_impact_score_expression(
    failed_count: ClauseElement,
    total_count: ClauseElement,
    sample_weight_threshold: float = DEFAULT_SAMPLE_WEIGHT_THRESHOLD,
    normalization_factor: float = DEFAULT_NORMALIZATION_FACTOR,
) -> ClauseElement:
    """
    Generate SQLAlchemy expression for calculating impact score in dimensional queries.

    The impact score identifies dimensions with high variance in data quality by
    combining failure rate severity with data volume. SQLAlchemy handles database-specific
    function translations (e.g., LEAST/MIN, LOG/LN).

    Args:
        failed_count: SQLAlchemy expression for number of failed rows
        total_count: SQLAlchemy expression for total number of rows
        sample_weight_threshold: Number of samples needed for full weight (default: 100)
        normalization_factor: Divisor to normalize scores to 0-1 range (default: 1.5)

    Returns:
        SQLAlchemy expression that calculates impact score (0-1 range)

    Example SQL:
        CASE
            WHEN (failure_rate² * volume_factor * sample_weight / 1.5) > 1.0 THEN 1.0
            WHEN (failure_rate² * volume_factor * sample_weight / 1.5) < 0.0 THEN 0.0
            ELSE (failure_rate² * volume_factor * sample_weight / 1.5)
        END

    Where volume_factor is a tiered value based on total rows for database compatibility
    """
    # Calculate failure rate with safe division
    failure_rate = case(
        [(total_count > 0, func.cast(failed_count, Float) / total_count)], else_=0.0
    )

    # Square the failure rate to emphasize high failure percentages
    # 50% failure -> 0.25, 90% failure -> 0.81
    failure_severity = failure_rate * failure_rate

    # Volume factor using tiered linear scaling
    # Approximates logarithmic behavior without requiring database log functions
    # This ensures compatibility with all databases including SQLite
    volume_factor = get_volume_factor_expression(total_count)

    # Sample weight to reduce noise from tiny samples
    # Ramps from 0 to 1 as sample size goes from 0 to threshold
    # Using case instead of least for database compatibility
    sample_weight_raw = func.cast(total_count, Float) / sample_weight_threshold
    sample_weight = case([(sample_weight_raw < 1.0, sample_weight_raw)], else_=1.0)

    # Combine all factors
    raw_impact = failure_severity * volume_factor * sample_weight

    # Normalize to approximately 0-1 range
    # Max theoretical value is 1.0 * log10(large_number) * 1.0
    # For 10K rows: 1.0 * 4 * 1.0 = 4, so we divide by 4
    normalized_impact = raw_impact / normalization_factor

    # Ensure final score is between 0 and 1 using case expressions for compatibility
    return case(
        [(normalized_impact < 0.0, 0.0), (normalized_impact > 1.0, 1.0)],
        else_=normalized_impact,
    )


def calculate_impact_score_pandas(
    df_grouped,
    failed_column: str = "failed_count",
    total_column: str = "total_count",
    sample_weight_threshold: float = DEFAULT_SAMPLE_WEIGHT_THRESHOLD,
    normalization_factor: float = DEFAULT_NORMALIZATION_FACTOR,
):
    """
    Calculate impact scores for a pandas DataFrame with grouped dimension results.

    This function adds an 'impact_score' column to a DataFrame that contains
    aggregated results by dimension. It uses the same formula as the SQLAlchemy
    version but with pandas/numpy operations.

    Args:
        df_grouped: Pandas DataFrame with dimension results
        failed_column: Name of column containing failed counts
        total_column: Name of column containing total counts
        sample_weight_threshold: Threshold for full sample weight
        normalization_factor: Normalization divisor

    Returns:
        DataFrame with added 'impact_score' column

    Example:
        >>> import pandas as pd
        >>> import numpy as np
        >>> df = pd.DataFrame({
        ...     'dimension': ['USA', 'EU', 'Asia'],
        ...     'failed_count': [9000, 500, 10],
        ...     'total_count': [10000, 1000, 100]
        ... })
        >>> df_with_scores = calculate_impact_score_pandas(df)
        >>> print(df_with_scores[['dimension', 'impact_score']])
           dimension  impact_score
        0        USA         0.810
        1         EU         0.188
        2       Asia         0.005
    """
    import numpy as np

    # Create a copy to avoid modifying original
    df = df_grouped.copy()

    # Calculate failure rate
    df["failure_rate"] = np.where(
        df[total_column] > 0, df[failed_column] / df[total_column], 0.0
    )

    # Square the failure rate
    df["failure_severity"] = df["failure_rate"] ** 2

    # Tiered volume factor using the helper function
    df["volume_factor"] = df[total_column].apply(get_volume_factor)

    # Sample weight
    df["sample_weight"] = np.minimum(1.0, df[total_column] / sample_weight_threshold)

    # Calculate raw impact
    df["raw_impact"] = (
        df["failure_severity"] * df["volume_factor"] * df["sample_weight"]
    )

    # Normalize to 0-1 range
    df["impact_score"] = np.minimum(
        1.0, np.maximum(0.0, df["raw_impact"] / normalization_factor)
    )

    # Clean up intermediate columns
    df.drop(
        columns=[
            "failure_rate",
            "failure_severity",
            "volume_factor",
            "sample_weight",
            "raw_impact",
        ],
        inplace=True,
        errors="ignore",
    )

    return df


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
    import numpy as np

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
                    volume_factor = get_volume_factor(total)  # Use the helper function
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
    final_metric_calculators: Dict[
        str, Callable[["pd.DataFrame", "pd.Series", str], "pd.Series"]
    ],
    top_n: int = DEFAULT_TOP_DIMENSIONS,
    impact_column: str = "impact_score",
    others_label: str = DIMENSION_OTHERS_LABEL,
    exclude_from_final: Optional[List[str]] = None,
):
    """
    Aggregate low-impact dimensions into "Others" using function-based statistical aggregation.

    This function provides a flexible interface for statistical aggregation by using
    function parameters, similar to the SQA version but for pandas DataFrames.

    Args:
        df: DataFrame with dimension results
        dimension_column: Name of the dimension column
        final_metric_calculators: Dict mapping metric names to functions that calculate final metrics
        top_n: Number of top dimensions to keep (default: 5)
        impact_column: Name of the impact score column
        others_label: Label for aggregated dimensions (default: "Others")
        exclude_from_final: Optional list of metric names to exclude from final output

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
    import numpy as np

    exclude_from_final = exclude_from_final or []

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
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    agg_dict = {
        col: "sum"
        for col in numeric_cols
        if col not in [impact_column, "calculated_failed_count"]
    }

    # Aggregate by dimension_group
    df_aggregated = df.groupby("dimension_group", as_index=False).agg(agg_dict)

    # For top dimensions, preserve their original metric values
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

    # Clean up excluded columns
    for col in exclude_from_final:
        if col in df_aggregated.columns:
            df_aggregated = df_aggregated.drop(columns=[col])

    return df_aggregated.sort_values(by=impact_column, ascending=False)
