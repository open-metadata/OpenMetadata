"""Override first quartile metric definition for SingleStore"""

from metadata.profiler.metrics.window.median import Median
from metadata.profiler.source.database.single_store.functions.median import (
    SingleStoreMedianFn,
)


class SingleStoreMedian(Median):
    def _compute_sqa_fn(self, column, table, percentile):
        """Generic method to compute the quartile using sqlalchemy"""
        return SingleStoreMedianFn(column, table, percentile)
