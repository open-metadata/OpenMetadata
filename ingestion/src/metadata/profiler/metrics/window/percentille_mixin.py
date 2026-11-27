"""function calls shared across all percentile metrics"""

from sqlalchemy import type_coerce

from metadata.profiler.orm.functions.median import MedianFn
from metadata.profiler.orm.registry import CustomTypes


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
        fn = (
            MedianFn(column, table, percentile, dimension_col)
            if dimension_col is not None
            else MedianFn(column, table, percentile)
        )
        if isinstance(column.type, CustomTypes.LARGEINT.value):
            return type_coerce(fn, column.type)
        return fn
