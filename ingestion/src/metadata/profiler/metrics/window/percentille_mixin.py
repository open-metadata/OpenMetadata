"""function calls shared across all percentile metrics"""

from metadata.profiler.orm.functions.median import MedianFn


class PercentilMixin:
    def _compute_sqa_fn(self, column, table, percentile):
        """Generic method to compute the quartile using sqlalchemy"""
        return MedianFn(column, table, percentile)
