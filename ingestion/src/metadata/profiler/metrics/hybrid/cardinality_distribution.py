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
Cardinality Distribution Metric definition
"""
from typing import Any, Dict, Optional

from sqlalchemy import case, column, func
from sqlalchemy.orm import DeclarativeMeta, Session

from metadata.profiler.metrics.core import HybridMetric
from metadata.profiler.metrics.static.count import Count
from metadata.profiler.metrics.static.distinct_count import DistinctCount
from metadata.profiler.orm.registry import is_concatenable, is_enum
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class CardinalityDistribution(HybridMetric):
    """
    CARDINALITY_DISTRIBUTION Metric

    Given a column, return the cardinality distribution showing top categories
    with an "Others" bucket. Only works for concatenable types (strings, enums).
    """

    threshold_percentage: float = 0.02  # 2% threshold for "Others" bucket
    min_buckets: int = 5  # Minimum number of top categories to show

    @classmethod
    def name(cls):
        return "cardinalityDistribution"

    @property
    def metric_type(self):
        return dict

    def fn(
        self,
        sample: Optional[DeclarativeMeta],
        res: Dict[str, Any],
        session: Optional[Session] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Build the Cardinality Distribution metric query
        """
        if not session:
            raise AttributeError(
                "We are missing the session attribute to compute the CardinalityDistribution."
            )

        if self.col is None:
            raise AttributeError(
                "We are missing the column attribute to compute the CardinalityDistribution."
            )

        if not (is_concatenable(self.col.type) or is_enum(self.col.type)):
            logger.debug(
                f"CardinalityDistribution not applicable for {self.col.name} because type {self.col.type} is not supported."
            )
            return None

        # Get total count from other metrics if available, otherwise compute it
        total_count = res.get(Count.name())
        distinct_count = res.get(DistinctCount.name())

        if not total_count or total_count == 0:
            return None

        if total_count == distinct_count:
            logger.debug(
                f"CardinalityDistribution not applicable for {self.col.name} because all values are distinct."
            )
            return None

        col = column(self.col.name, self.col.type)
        threshold = self.threshold_percentage * total_count

        # Build an efficient single query using CTEs to avoid duplicate aggregations
        # This approach is similar to what's used in median.py for Impala dialect

        # Use a CTE-based approach for better readability and performance
        value_counts_cte = (
            session.query(  # type: ignore
                col.label("category"), func.count(col).label("category_count")
            )
            .select_from(sample)
            .group_by(col)
            .cte("value_counts")
        )

        # Get top N categories using a CTE
        top_categories_cte = (
            session.query(value_counts_cte.c.category)  # type: ignore
            .select_from(value_counts_cte)
            .order_by(value_counts_cte.c.category_count.desc())
            .limit(self.min_buckets)
            .cte("top_categories")
        )

        # Create a categorization CTE to avoid complex CASE in GROUP BY
        categorized_cte = (
            session.query(  # type: ignore
                case(
                    (
                        value_counts_cte.c.category.in_(
                            session.query(top_categories_cte.c.category)
                        ),
                        value_counts_cte.c.category,
                    ),
                    (
                        value_counts_cte.c.category_count >= threshold,
                        value_counts_cte.c.category,
                    ),
                    else_="Others",
                ).label("category_group"),
                value_counts_cte.c.category_count,
            )
            .select_from(value_counts_cte)
            .cte("categorized")
        )

        # Final aggregation
        query = (
            session.query(  # type: ignore
                categorized_cte.c.category_group,
                func.sum(categorized_cte.c.category_count).label("total_count"),
            )
            .select_from(categorized_cte)
            .group_by(categorized_cte.c.category_group)
            .order_by(func.sum(categorized_cte.c.category_count).desc())
        )

        rows = query.all()

        if rows:
            return {
                "categories": [row[0] for row in rows],
                "counts": [int(row[1]) for row in rows],
                "percentages": [round((row[1] / total_count) * 100, 2) for row in rows],
            }
        return None

    def df_fn(self, res: Dict[str, Any], dfs=None):
        """
        Pandas implementation for dataframes
        """
        # pylint: disable=import-outside-toplevel
        import pandas as pd

        if self.col is None:
            return None

        if not (is_concatenable(self.col.type) or is_enum(self.col.type)):
            logger.debug(
                f"CardinalityDistribution not applicable for {self.col.name} because type {self.col.type} is not supported."
            )
            return None

        # Get total count and distinct count from other metrics
        total_count = res.get(Count.name())
        distinct_count = res.get(DistinctCount.name())

        if not total_count or total_count == 0:
            return None

        if total_count == distinct_count:
            logger.debug(
                f"CardinalityDistribution not applicable for {self.col.name} because all values are distinct."
            )
            return None

        try:
            if dfs is None:
                return None

            # Calculate threshold
            threshold = self.threshold_percentage * total_count

            # Use pandas value_counts() for efficient processing - much faster for large datasets
            combined_value_counts = pd.Series(dtype="object")

            for df in dfs:
                # Use value_counts() directly on the column - much more memory efficient
                df_value_counts = df[self.col.name].value_counts()
                combined_value_counts = combined_value_counts.add(
                    df_value_counts, fill_value=0
                )

            # Get top categories that meet the threshold OR are in the top N
            top_categories = {}
            others_count = 0

            # Get the top N categories by count
            top_n_categories = set(combined_value_counts.head(self.min_buckets).index)

            # Process in descending order of frequency
            for category, count in combined_value_counts.items():
                # First check if it's in top N, then check threshold
                if category in top_n_categories or count >= threshold:
                    top_categories[category] = count
                else:
                    others_count += count

            # Build result
            categories = []
            counts = []
            percentages = []

            for category, count in top_categories.items():
                categories.append(str(category))
                counts.append(int(count))
                percentages.append(round((count / total_count) * 100, 2))

            if others_count > 0:
                categories.append("Others")
                counts.append(int(others_count))
                percentages.append(round((others_count / total_count) * 100, 2))

            return {
                "categories": categories,
                "counts": counts,
                "percentages": percentages,
            }

        except Exception as err:
            logger.debug(
                f"Error computing CardinalityDistribution for {self.col.name}: {err}"
            )
            return None
