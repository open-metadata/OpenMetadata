"""Override first quartile metric definition for MariaDB"""

from metadata.profiler.metrics.window.median import Median
from metadata.profiler.source.mariadb.functions.median import MariaDBMedianFn


class MariaDBMedian(Median):
    def _compute_sqa_fn(self, column, table, percentile):
        """Generic method to compute the quartile using sqlalchemy"""
        return MariaDBMedianFn(column, table, percentile)
