"""Override first quartile metric definition for SingleStore"""

from metadata.profiler.metrics.window.third_quartile import ThirdQuartile
from metadata.profiler.source.single_store.functions.median import SingleStoreMedianFn


class SingleStoreThirdQuartile(ThirdQuartile):
    def _compute_sqa_fn(self, column, table, percentile):
        """Generic method to compute the quartile using sqlalchemy"""
        return SingleStoreMedianFn(column, table, percentile)
