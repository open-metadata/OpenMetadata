"""Override first quartile metric definition for MariaDB"""

from metadata.profiler.metrics.window.third_quartile import ThirdQuartile
from metadata.profiler.source.database.mariadb.functions.median import MariaDBMedianFn


class MariaDBThirdQuartile(ThirdQuartile):
    def _compute_sqa_fn(self, column, table, percentile, dimension_col=None):
        """Generic method to compute the quartile using sqlalchemy"""
        if dimension_col is not None:
            return MariaDBMedianFn(column, table, percentile, dimension_col)
        return MariaDBMedianFn(column, table, percentile)
