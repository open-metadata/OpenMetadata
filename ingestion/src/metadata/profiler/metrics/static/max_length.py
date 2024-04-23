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
MAX_LENGTH Metric definition
"""
# pylint: disable=duplicate-code


from sqlalchemy import column, func

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import StaticMetric, _label
from metadata.profiler.orm.functions.length import LenFn
from metadata.profiler.orm.registry import is_concatenable
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class MaxLength(StaticMetric):
    """
    MAX_LENGTH Metric

    Given a column, return the MIN LENGTH value.

    Only works for concatenable types
    """

    @classmethod
    def name(cls):
        return MetricType.maxLength.value

    @property
    def metric_type(self):
        return int

    def _is_concatenable(self):
        return is_concatenable(self.col.type)

    @_label
    def fn(self):
        """sqlalchemy function"""
        if self._is_concatenable():
            return func.max(LenFn(column(self.col.name, self.col.type)))

        logger.debug(
            f"Don't know how to process type {self.col.type} when computing MAX_LENGTH"
        )
        return None

    # pylint: disable=import-outside-toplevel
    def df_fn(self, dfs=None):
        """dataframe function"""
        from numpy import vectorize

        length_vectorize_func = vectorize(len)
        if self._is_concatenable():
            max_length_list = []

            for df in dfs:
                if any(df[self.col.name].dropna()):
                    max_length_list.append(
                        length_vectorize_func(
                            df[self.col.name].dropna().astype(str)
                        ).max()
                    )
            if max_length_list:
                return max(max_length_list)
        logger.debug(
            f"Don't know how to process type {self.col.type} when computing MAX_LENGTH"
        )
        return None
