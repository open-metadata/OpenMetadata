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
Null Count Metric definition
"""
# pylint: disable=duplicate-code

from typing import TYPE_CHECKING, Optional

from sqlalchemy import ARRAY, JSON, Boolean, Interval, case, column
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.types import TypeEngine

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import StaticMetric, _label
from metadata.profiler.metrics.pandas_metric_protocol import PandasComputation
from metadata.profiler.orm.functions.sum import SumFn
from metadata.profiler.orm.registry import is_date_time, is_quantifiable
from metadata.profiler.orm.types.custom_array import CustomArray
from metadata.profiler.orm.types.custom_ip import CustomIP
from metadata.profiler.orm.types.custom_time import CustomTime
from metadata.profiler.orm.types.uuid import UUIDString
from metadata.utils.logger import profiler_logger

if TYPE_CHECKING:
    import pandas as pd
    from sqlalchemy.sql.elements import ColumnElement

    from metadata.profiler.processor.runner import PandasRunner

logger = profiler_logger()


# Types that cannot hold '', beyond the quantifiable/date-time families. Postgres
# and ClickHouse raise on the comparison; MySQL/MariaDB coerce instead and count
# real values as missing ('' matches 0, false and, on MariaDB TIME, '00:00:00').
# CustomTime is listed here rather than in registry.is_date_time because that
# helper also drives min/max/mean/stddev and columnValuesToBeBetween, which we are
# not changing here. TODO(#21482): close that registry gap separately.
#
# JSON and ARRAY are containers rather than scalars, and both are declared
# supported by columnValuesMissingCount. Postgres has no `json = text` operator and
# rejects '' as malformed input for jsonb. Arrays fail worse than an error:
# SQLAlchemy's ARRAY bind processor iterates the '' and binds an empty sequence, so
# `col = ''` is sent as `col = ARRAY[]` and quietly counts empty arrays as missing.
# CustomArray has to be named explicitly — it is a TypeDecorator, so
# isinstance(CustomArray(...), ARRAY) is False.
NON_EMPTY_STRING_TYPES = (
    Boolean,
    UUIDString,
    CustomIP,
    CustomTime,
    Interval,
    SqlEnum,
    JSON,
    ARRAY,
    CustomArray,
)


def can_hold_empty_string(col_type: TypeEngine) -> bool:
    """Whether comparing a column of this type against '' is meaningful.

    Types we don't recognize fall through to True so dialect-specific string types
    keep counting empty values.
    """
    if is_quantifiable(col_type) or is_date_time(col_type):
        return False
    return not isinstance(col_type, NON_EMPTY_STRING_TYPES)


class NullMissingCount(StaticMetric):
    """
    NULL + Empty COUNT Metric

    Given a column, return the null count.

    We are building a CASE WHEN structure:
    ```
    SUM(
        CASE is not null THEN 1
        ELSE 0
    )
    ```
    """

    schema_metric_type = MetricType.nullMissingCount

    @classmethod
    def name(cls):
        """
        Returns the name of the metric.
        """
        return MetricType.nullCount.value

    @property
    def metric_type(self):
        """
        Returns the type of the metric.
        """
        return int

    @_label
    def fn(self):
        """
        Returns the SQLAlchemy function for calculating the metric.
        """
        if self.col is None:
            return None

        col = column(self.col.name, self.col.type)
        conditions: list[tuple[ColumnElement[bool], int]] = [(col.is_(None), 1)]

        if can_hold_empty_string(self.col.type):
            conditions.append((col.__eq__(""), 1))

        return SumFn(case(*conditions, else_=0))

    def df_fn(self, dfs: Optional["PandasRunner"] = None):
        """pandas function"""
        if dfs is None:
            return None
        computation = self.get_pandas_computation()
        accumulator = computation.create_accumulator()
        for df in dfs:
            try:
                accumulator = computation.update_accumulator(accumulator, df)
            except Exception as err:
                logger.debug(f"Error while computing 'Null Missing Count' for column '{self.col.name}': {err}")
                return None
        return computation.aggregate_accumulator(accumulator)

    def get_pandas_computation(self) -> PandasComputation:
        """Returns the logic to compute this metrics using Pandas"""
        return PandasComputation[int, int](
            create_accumulator=lambda: 0,
            update_accumulator=lambda acc, df: NullMissingCount.update_accumulator(acc, df, self.col),
            aggregate_accumulator=lambda acc: acc,
        )

    @staticmethod
    def update_accumulator(current_count: int, df: "pd.DataFrame", column) -> int:
        """Computes one DataFrame chunk and updates the running null/missing count

        Maintains a single count value. Adds chunk's null and empty string count
        to the current total and returns the sum.

        Unlike the SQL path this needs no type guard: pandas comparisons never
        coerce, so `== ""` is simply False on a numeric/temporal column. It also
        stays correct for an object-dtype datalake column that OM typed as INT but
        which really does carry "" for missing values.
        """
        chunk_null_count = df[column.name].isnull().sum()
        chunk_empty_count = (df[column.name] == "").sum()
        return current_count + chunk_null_count + chunk_empty_count
