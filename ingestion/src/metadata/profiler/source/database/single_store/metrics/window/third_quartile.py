"""Override first quartile metric definition for SingleStore"""

from metadata.profiler.metrics.window.third_quartile import ThirdQuartile
from metadata.profiler.source.database.single_store.functions.median import (
    SingleStoreMedianFn,
)


class SingleStoreThirdQuartile(ThirdQuartile):
    def _compute_sqa_fn(self, column, table, percentile, dimension_col=None):
        """Generic method to compute the quartile using sqlalchemy"""
        if dimension_col is not None:
            return SingleStoreMedianFn(column, table, percentile, dimension_col)
        return SingleStoreMedianFn(column, table, percentile)
