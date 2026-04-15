"""Override first quartile metric definition for SingleStore"""

from metadata.profiler.metrics.window.first_quartile import FirstQuartile
from metadata.profiler.source.database.single_store.functions.median import (
    SingleStoreMedianFn,
)


class SingleStoreFirstQuartile(FirstQuartile):
    def _compute_sqa_fn(self, column, table, percentile, dimension_col=None):
        """Generic method to compute the quartile using sqlalchemy"""
        if dimension_col is not None:
            return SingleStoreMedianFn(column, table, percentile, dimension_col)
        return SingleStoreMedianFn(column, table, percentile)
