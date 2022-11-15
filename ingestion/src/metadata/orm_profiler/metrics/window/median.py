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

from sqlalchemy import column

from metadata.orm_profiler.metrics.core import StaticMetric, _label
from metadata.orm_profiler.orm.functions.median import MedianFn
from metadata.orm_profiler.orm.registry import is_quantifiable
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class Median(StaticMetric):
    """
    Median Metric

    Given a column, return the Median value.

    - For a quantifiable value, return the usual Median
    """

    @classmethod
    def name(cls):
        return "median"

    @classmethod
    def is_window_metric(cls):
        return True

    @property
    def metric_type(self):
        return float

    @_label
    def fn(self):
        if is_quantifiable(self.col.type):
            return MedianFn(column(self.col.name), self.col.table.name)

        logger.debug(
            f"Don't know how to process type {self.col.type} when computing Median"
        )
        return None

    @_label
    def dl_fn(self, data_frame=None):
        if is_quantifiable(self.col.datatype):
            return data_frame[self.col.name].median().tolist()
        logger.debug(
            f"Don't know how to process type {self.col.datatype} when computing Median"
        )
        return None
