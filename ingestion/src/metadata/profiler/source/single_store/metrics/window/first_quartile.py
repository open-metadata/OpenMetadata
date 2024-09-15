"""Override first quartile metric definition for SingleStore"""

from metadata.profiler.metrics.window.first_quartile import FirstQuartile
from metadata.profiler.source.single_store.functions.median import SingleStoreMedianFn


class SingleStoreFirstQuartile(FirstQuartile):
    def _compute_sqa_fn(self, column, table, percentile):
        """Generic method to compute the quartile using sqlalchemy"""
        return SingleStoreMedianFn(column, table, percentile)
