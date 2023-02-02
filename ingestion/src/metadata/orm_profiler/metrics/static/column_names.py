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
Table Column Count Metric definition
"""
# pylint: disable=duplicate-code

import sqlalchemy
from sqlalchemy import inspect, literal
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import DeclarativeMeta
from sqlalchemy.sql.functions import FunctionElement

from metadata.orm_profiler.metrics.core import CACHE, StaticMetric, _label
from metadata.orm_profiler.orm.registry import Dialects


class ColunNameFn(FunctionElement):
    name = __qualname__
    inherit_cache = CACHE


@compiles(ColunNameFn)
def _(element, compiler, **kw):
    return compiler.process(element.clauses, **kw)


@compiles(ColunNameFn, Dialects.IbmDbSa)
@compiles(ColunNameFn, Dialects.Db2)
def _(element, compiler, **kw):
    """Returns column names for db2 database and handles casting variables.
    If casting is not provided for variables, db2 throws error.
    """
    proc = compiler.process(element.clauses, **kw)
    return f"CAST({proc} AS VARCHAR)"


class ColumnNames(StaticMetric):
    """
    COLUMN_NAMES Metric

    Returns all column names in the table

    This Metric needs to be initialised passing the Table
    information:
    add_props(table=table)(Metrics.COLUMN_NAMES.value)
    """

    table: DeclarativeMeta

    @classmethod
    def name(cls):
        return "columnNames"

    @classmethod
    def is_col_metric(cls) -> bool:
        """
        Mark the class as a Table Metric
        """
        return False

    @property
    def metric_type(self):
        return list

    @_label
    def fn(self):
        if not hasattr(self, "table"):
            raise AttributeError(
                "Column Count requires a table to be set: add_props(table=...)(Metrics.COLUMN_COUNT)"
            )

        col_names = ",".join(inspect(self.table).c.keys())
        return ColunNameFn(literal(col_names, type_=sqlalchemy.types.String))

    @_label
    def dl_fn(self, data_frame=None):
        return data_frame.columns.values.tolist()
