"""Override first quartile metric definition for MariaDB"""

from metadata.profiler.metrics.window.third_quartile import ThirdQuartile
from metadata.profiler.source.mariadb.functions.median import MariaDBMedianFn


class MariaDBThirdQuartile(ThirdQuartile):
    def _compute_sqa_fn(self, column, table, percentile):
        """Generic method to compute the quartile using sqlalchemy"""
        return MariaDBMedianFn(column, table, percentile)
