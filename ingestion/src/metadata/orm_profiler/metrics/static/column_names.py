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
from sqlalchemy.orm import DeclarativeMeta

from metadata.orm_profiler.metrics.core import StaticMetric, _label


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
        return literal(col_names, type_=sqlalchemy.types.String)
