"""function calls shared across all percentile metrics"""

from metadata.profiler.orm.functions.median import MedianFn


class PercentilMixin:
    def _compute_sqa_fn(self, column, table, percentile, dimension_col=None):
        """Generic method to compute the quartile using sqlalchemy

        Args:
            column: The column to compute percentile on
            table: The table name
            percentile: The percentile value (0.25 for Q1, 0.5 for median, 0.75 for Q3)
            dimension_col: Optional dimension column name (string) for GROUP BY correlation
                          If provided, median is computed per dimension value
                          If None, median is computed across entire table

        Returns:
            MedianFn expression
        """
        if dimension_col is not None:
            return MedianFn(column, table, percentile, dimension_col)
        return MedianFn(column, table, percentile)
