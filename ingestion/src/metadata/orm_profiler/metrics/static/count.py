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
Count Metric definition
"""
# pylint: disable=duplicate-code

from sqlalchemy import column, func

from metadata.orm_profiler.metrics.core import StaticMetric, _label
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class Count(StaticMetric):
    """
    COUNT Metric

    Given a column, return the count. Ignores NULL values
    """

    @classmethod
    def name(cls):
        return "valuesCount"

    @property
    def metric_type(self):
        return int

    @_label
    def fn(self):
        return func.count(column(self.col.name))

    @_label
    def dl_fn(self, data_frame=None):
        try:
            return len(data_frame[self.col.name])
        except Exception as err:
            logger.debug(
                f"Don't know how to process type {self.col.datatype} when computing MEAN"
            )
            logger.error(err)
            return 0
