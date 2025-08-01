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
Table Column Count Metric definition
"""
# pylint: disable=duplicate-code

from typing import cast

from sqlalchemy import inspect, literal
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import DeclarativeMeta
from sqlalchemy.sql.functions import FunctionElement

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import CACHE, StaticMetric, _label
from metadata.profiler.orm.registry import Dialects


class ColumnCountFn(FunctionElement):
    name = __qualname__
    inherit_cache = CACHE


@compiles(ColumnCountFn)
def _(element, compiler, **kw):
    return compiler.process(element.clauses, **kw)


@compiles(ColumnCountFn, Dialects.IbmDbSa)
@compiles(ColumnCountFn, Dialects.Db2)
def _(element, compiler, **kw):
    """Returns column count for db2 database and handles casting variables.
    If casting is not provided for variables, db2 throws error.
    """
    proc = compiler.process(element.clauses, **kw)
    return f"CAST({proc} AS BIGINT)"


class ColumnCount(StaticMetric):
    """
    COLUMN_COUNT Metric

    Count all columns on a table.

    This Metric needs to be initialised passing the Table
    information:
    add_props(table=table)(Metrics.COLUMN_COUNT.value)
    """

    table: DeclarativeMeta

    @classmethod
    def name(cls):
        return MetricType.columnCount.value

    @classmethod
    def is_col_metric(cls) -> bool:
        """
        Mark the class as a Table Metric
        """
        return False

    @property
    def metric_type(self):
        return int

    @_label
    def fn(self):
        """sqlalchemy function"""
        if not hasattr(self, "table"):
            raise AttributeError(
                "Column Count requires a table to be set: add_props(table=...)(Metrics.COLUMN_COUNT)"
            )
        return ColumnCountFn(literal(len(inspect(self.table).c)))

    def df_fn(self, dfs=None):
        """dataframe function"""
        from pandas import DataFrame  # pylint: disable=import-outside-toplevel

        return len(cast(DataFrame, dfs[0]).columns)
