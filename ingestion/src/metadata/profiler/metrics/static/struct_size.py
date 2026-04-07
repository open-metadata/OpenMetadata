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
Struct size metrics: max, min, and mean number of keys/elements in JSON/Map/Struct columns.
"""
# pylint: disable=duplicate-code

import json
from typing import TYPE_CHECKING, NamedTuple, Optional

from sqlalchemy import column, func

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import StaticMetric, _label
from metadata.profiler.metrics.pandas_metric_protocol import PandasComputation
from metadata.profiler.orm.functions.struct_size import StructSizeFn
from metadata.profiler.orm.registry import is_struct
from metadata.utils.logger import profiler_logger

if TYPE_CHECKING:
    import pandas as pd

    from metadata.profiler.processor.runner import PandasRunner

logger = profiler_logger()


def _struct_key_count(value) -> Optional[int]:
    """Return the number of keys/elements in a struct value, or None if not applicable."""
    if value is None:
        return None
    if isinstance(value, dict):
        return len(value)
    if isinstance(value, list):
        return len(value)
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, (dict, list)):
                return len(parsed)
        except (json.JSONDecodeError, ValueError):
            pass
    return None


class MaxStructSize(StaticMetric):
    """
    MAX_STRUCT_SIZE Metric

    Given a struct/JSON column, return the maximum number of keys or elements.
    """

    schema_metric_type = MetricType.maxStructSize

    @classmethod
    def name(cls):
        return MetricType.maxStructSize.value

    @property
    def metric_type(self):
        return int

    @_label
    def fn(self):
        if is_struct(self.col.type):
            return func.max(StructSizeFn(column(self.col.name, self.col.type)))
        logger.debug(
            f"Column {self.col.name} is not a struct type; skipping MAX_STRUCT_SIZE"
        )
        return None

    def df_fn(self, dfs: Optional["PandasRunner"] = None):
        if dfs is None or not is_struct(self.col.type):
            return None
        computation = self.get_pandas_computation()
        accumulator = computation.create_accumulator()
        for df in dfs:
            try:
                accumulator = computation.update_accumulator(accumulator, df)
            except Exception as err:
                logger.debug(
                    f"Error computing MAX_STRUCT_SIZE for {self.col.name}: {err}"
                )
                return None
        return computation.aggregate_accumulator(accumulator)

    def get_pandas_computation(self) -> PandasComputation:
        return PandasComputation[Optional[int], Optional[int]](
            create_accumulator=lambda: None,
            update_accumulator=lambda acc, df: MaxStructSize._update(acc, df, self.col),
            aggregate_accumulator=lambda acc: acc,
        )

    @staticmethod
    def _update(current_max: Optional[int], df: "pd.DataFrame", col) -> Optional[int]:
        # pylint: disable=import-outside-toplevel
        import pandas as pd

        sizes = df[col.name].dropna().apply(_struct_key_count).dropna()
        if sizes.empty:
            return current_max
        chunk_max = int(sizes.max())
        if pd.isnull(chunk_max):
            return current_max
        return chunk_max if current_max is None else max(current_max, chunk_max)


class MinStructSize(StaticMetric):
    """
    MIN_STRUCT_SIZE Metric

    Given a struct/JSON column, return the minimum number of keys or elements.
    """

    schema_metric_type = MetricType.minStructSize

    @classmethod
    def name(cls):
        return MetricType.minStructSize.value

    @property
    def metric_type(self):
        return int

    @_label
    def fn(self):
        if is_struct(self.col.type):
            return func.min(StructSizeFn(column(self.col.name, self.col.type)))
        logger.debug(
            f"Column {self.col.name} is not a struct type; skipping MIN_STRUCT_SIZE"
        )
        return None

    def df_fn(self, dfs: Optional["PandasRunner"] = None):
        if dfs is None or not is_struct(self.col.type):
            return None
        computation = self.get_pandas_computation()
        accumulator = computation.create_accumulator()
        for df in dfs:
            try:
                accumulator = computation.update_accumulator(accumulator, df)
            except Exception as err:
                logger.debug(
                    f"Error computing MIN_STRUCT_SIZE for {self.col.name}: {err}"
                )
                return None
        return computation.aggregate_accumulator(accumulator)

    def get_pandas_computation(self) -> PandasComputation:
        return PandasComputation[Optional[int], Optional[int]](
            create_accumulator=lambda: None,
            update_accumulator=lambda acc, df: MinStructSize._update(acc, df, self.col),
            aggregate_accumulator=lambda acc: acc,
        )

    @staticmethod
    def _update(current_min: Optional[int], df: "pd.DataFrame", col) -> Optional[int]:
        # pylint: disable=import-outside-toplevel
        import pandas as pd

        sizes = df[col.name].dropna().apply(_struct_key_count).dropna()
        if sizes.empty:
            return current_min
        chunk_min = int(sizes.min())
        if pd.isnull(chunk_min):
            return current_min
        return chunk_min if current_min is None else min(current_min, chunk_min)


class SumAndCountStruct(NamedTuple):
    sum_value: float
    count_value: int


class MeanStructSize(StaticMetric):
    """
    MEAN_STRUCT_SIZE Metric

    Given a struct/JSON column, return the average number of keys or elements.
    """

    schema_metric_type = MetricType.meanStructSize

    @classmethod
    def name(cls):
        return MetricType.meanStructSize.value

    @property
    def metric_type(self):
        return float

    @_label
    def fn(self):
        if is_struct(self.col.type):
            return func.avg(StructSizeFn(column(self.col.name, self.col.type)))
        logger.debug(
            f"Column {self.col.name} is not a struct type; skipping MEAN_STRUCT_SIZE"
        )
        return None

    def df_fn(self, dfs: Optional["PandasRunner"] = None):
        if dfs is None or not is_struct(self.col.type):
            return None
        computation = self.get_pandas_computation()
        accumulator = computation.create_accumulator()
        for df in dfs:
            try:
                accumulator = computation.update_accumulator(accumulator, df)
            except Exception as err:
                logger.debug(
                    f"Error computing MEAN_STRUCT_SIZE for {self.col.name}: {err}"
                )
                return None
        return computation.aggregate_accumulator(accumulator)

    def get_pandas_computation(self) -> PandasComputation:
        return PandasComputation[SumAndCountStruct, Optional[float]](
            create_accumulator=lambda: SumAndCountStruct(0.0, 0),
            update_accumulator=lambda acc, df: MeanStructSize._update(
                acc, df, self.col
            ),
            aggregate_accumulator=MeanStructSize._aggregate,
        )

    @staticmethod
    def _update(acc: SumAndCountStruct, df: "pd.DataFrame", col) -> SumAndCountStruct:
        sizes = df[col.name].dropna().apply(_struct_key_count).dropna()
        if sizes.empty:
            return acc
        return SumAndCountStruct(
            sum_value=acc.sum_value + float(sizes.sum()),
            count_value=acc.count_value + len(sizes),
        )

    @staticmethod
    def _aggregate(acc: SumAndCountStruct) -> Optional[float]:
        if acc.count_value == 0:
            return None
        return acc.sum_value / acc.count_value
