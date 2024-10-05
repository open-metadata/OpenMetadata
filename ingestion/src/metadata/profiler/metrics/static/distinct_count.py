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

import json

from sqlalchemy import column, distinct, func

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import StaticMetric, _label
from metadata.profiler.orm.functions.count import CountFn
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class DistinctCount(StaticMetric):
    """
    DISTINCT_COUNT Metric

    Given a column, count the number of distinct values
    """

    @classmethod
    def name(cls):
        return MetricType.distinctCount.value

    @property
    def metric_type(self):
        return int

    @_label
    def fn(self):
        """
        Distinct Count metric for Sqlalchemy connectors
        """
        return func.count(distinct(CountFn(column(self.col.name, self.col.type))))

    def df_fn(self, dfs=None):
        """
        Distinct Count metric for Datalake
        """
        # pylint: disable=import-outside-toplevel
        from collections import Counter

        try:
            counter = Counter()
            for df in dfs:
                df_col_value = df[self.col.name].dropna().to_list()
                try:
                    counter.update(df_col_value)
                except TypeError as err:
                    if isinstance(df_col_value, list):
                        for value in df_col_value:
                            counter.update([json.dumps(value)])
                    else:
                        raise err
            return len(counter.keys())
        except Exception as err:
            logger.debug(
                f"Don't know how to process type {self.col.type}"
                f" when computing Distinct Count.\n Error: {err}"
            )
            return 0
