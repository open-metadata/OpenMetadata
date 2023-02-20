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
Distinct Count Metric definition
"""
# pylint: disable=duplicate-code

from typing import cast

from sqlalchemy import column, distinct, func

from metadata.orm_profiler.metrics.core import StaticMetric, _label
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class DistinctCount(StaticMetric):
    """
    DISTINCT_COUNT Metric

    Given a column, count the number of distinct values
    """

    @classmethod
    def name(cls):
        return "distinctCount"

    @property
    def metric_type(self):
        return int

    @_label
    def fn(self):
        return func.count(distinct(column(self.col.name)))

    @_label
    def df_fn(self, df=None):  # pylint: disable=invalid-name
        from pandas import DataFrame  # pylint: disable=import-outside-toplevel

        df = cast(DataFrame, df)

        try:
            return len(set(df[self.col.name].values.tolist()))
        except Exception as err:
            logger.debug(
                f"Don't know how to process type {self.col.type} "
                f"when computing Distinct Count.\n Error: {err}"
            )
            return 0
