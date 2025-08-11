#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
SUM Metric definition
"""
from functools import partial
from typing import Callable, Optional

from sqlalchemy import column

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.generated.schema.entity.data.table import Table
from metadata.profiler.adaptors.nosql_adaptor import NoSQLAdaptor
from metadata.profiler.metrics.core import StaticMetric, T, _label
from metadata.profiler.orm.functions.length import LenFn
from metadata.profiler.orm.functions.sum import SumFn
from metadata.profiler.orm.registry import is_concatenable, is_quantifiable

# pylint: disable=duplicate-code


class Sum(StaticMetric):
    """
    SUM Metric

    Given a column, return the sum of its values.

    Only works for quantifiable types
    """

    @classmethod
    def name(cls):
        return MetricType.sum.value

    @_label
    def fn(self):
        """sqlalchemy function"""
        if is_quantifiable(self.col.type):
            return SumFn(column(self.col.name, self.col.type))

        if is_concatenable(self.col.type):
            return SumFn(LenFn(column(self.col.name, self.col.type)))

        return None

    def df_fn(self, dfs=None):
        """pandas function"""

        if is_quantifiable(self.col.type):
            try:
                return sum(df[self.col.name].sum() for df in dfs)
            except (TypeError, ValueError):
                try:
                    return sum(df[self.col.name].astype(float).sum() for df in dfs)
                except Exception:
                    return None
        return None

    def nosql_fn(self, adaptor: NoSQLAdaptor) -> Callable[[Table], Optional[T]]:
        """nosql function"""
        if is_quantifiable(self.col.type):
            return partial(adaptor.sum, column=self.col)
        return lambda table: None
