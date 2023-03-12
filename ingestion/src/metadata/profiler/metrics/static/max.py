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
Max Metric definition
"""
# pylint: disable=duplicate-code

from typing import cast

from sqlalchemy import column, func

from metadata.profiler.metrics.core import StaticMetric, _label
from metadata.profiler.orm.registry import is_date_time, is_quantifiable


class Max(StaticMetric):
    """
    MAX Metric

    Given a column, return the max value.
    """

    @classmethod
    def name(cls):
        return "max"

    @_label
    def fn(self):
        """sqlalchemy function"""
        if (not is_quantifiable(self.col.type)) and (not is_date_time(self.col.type)):
            return None
        return func.max(column(self.col.name))

    # pylint: disable=import-outside-toplevel
    def df_fn(self, df=None):
        """pandas function"""
        from pandas import DataFrame

        df = cast(DataFrame, df)

        if is_quantifiable(self.col.type) or is_date_time(self.col.type):
            return (
                df[self.col.name].max()
                if not isinstance(df[self.col.name].max(), list)
                else df[self.col.name].apply(max).max()
            )
        return 0
