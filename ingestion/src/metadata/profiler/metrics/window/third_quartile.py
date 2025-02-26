#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Median Metric definition
"""
# pylint: disable=duplicate-code

from typing import List, cast

from sqlalchemy import column

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import StaticMetric, _label
from metadata.profiler.metrics.window.percentille_mixin import PercentilMixin
from metadata.profiler.orm.functions.length import LenFn
from metadata.profiler.orm.registry import is_concatenable, is_quantifiable
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class ThirdQuartile(StaticMetric, PercentilMixin):
    """
    Third Quartile Metric

    Given a column, return the third quartile value.

    - For a quantifiable value, return third quartile value
    """

    @classmethod
    def name(cls):
        return MetricType.thirdQuartile.value

    @classmethod
    def is_window_metric(cls):
        return True

    @property
    def metric_type(self):
        return float

    @_label
    def fn(self):
        """sqlalchemy function"""
        if is_quantifiable(self.col.type):
            # col fullname is only needed for MySQL and SQLite
            return self._compute_sqa_fn(
                column(self.col.name, self.col.type),
                self.col.table.name if self.col.table is not None else None,
                0.75,
            )

        if is_concatenable(self.col.type):
            return self._compute_sqa_fn(
                LenFn(column(self.col.name, self.col.type)),
                self.col.table.name if self.col.table is not None else None,
                0.75,
            )

        logger.debug(
            f"Don't know how to process type {self.col.type} when computing Third Quartile"
        )
        return None

    def df_fn(self, dfs=None):
        """Dataframe function"""
        # pylint: disable=import-outside-toplevel
        import pandas as pd

        df = cast(List[pd.DataFrame], dfs)

        if is_quantifiable(self.col.type):
            # we can't compute the median unless we have
            # the entire set. Median of Medians could be used
            # though it would required set to be sorted before hand
            try:
                df = pd.concat([df[self.col.name] for df in dfs])
            except MemoryError:
                logger.error(
                    f"Unable to compute Median for {self.col.name} due to memory constraints."
                    f"We recommend using a smaller sample size or partitioning."
                )
                return None
            # check if nan
            third_quartile = df.quantile(0.75, interpolation="midpoint")
            return None if pd.isnull(third_quartile) else third_quartile
        logger.debug(
            f"Don't know how to process type {self.col.type} when computing Third Quartile"
        )
        return None
