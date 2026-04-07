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
Collection size metrics: max, min, and mean number of elements in array/list columns.
"""
# pylint: disable=duplicate-code

from typing import TYPE_CHECKING, NamedTuple, Optional

from sqlalchemy import column, func

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import StaticMetric, _label
from metadata.profiler.metrics.pandas_metric_protocol import PandasComputation
from metadata.profiler.orm.functions.collection_size import CollectionSizeFn
from metadata.profiler.orm.registry import is_collection
from metadata.utils.logger import profiler_logger

if TYPE_CHECKING:
    import pandas as pd

    from metadata.profiler.processor.runner import PandasRunner

logger = profiler_logger()


def _collection_element_count(value) -> Optional[int]:
    """Return the number of elements in a collection value, or None if not applicable."""
    if value is None:
        return None
    if hasattr(value, "__len__"):
        return len(value)
    return None


class MaxCollectionSize(StaticMetric):
    """
    MAX_COLLECTION_SIZE Metric

    Given a collection (array/list) column, return the maximum number of elements.
    """

    schema_metric_type = MetricType.maxCollectionSize

    @classmethod
    def name(cls):
        return MetricType.maxCollectionSize.value

    @property
    def metric_type(self):
        return int

    @_label
    def fn(self):
        if is_collection(self.col.type):
            return func.max(CollectionSizeFn(column(self.col.name, self.col.type)))
        logger.debug(
            f"Column {self.col.name} is not a collection type; skipping MAX_COLLECTION_SIZE"
        )
        return None

    def df_fn(self, dfs: Optional["PandasRunner"] = None):
        if dfs is None or not is_collection(self.col.type):
            return None
        computation = self.get_pandas_computation()
        accumulator = computation.create_accumulator()
        for df in dfs:
            try:
                accumulator = computation.update_accumulator(accumulator, df)
            except Exception as err:
                logger.debug(
                    f"Error computing MAX_COLLECTION_SIZE for {self.col.name}: {err}"
                )
                return None
        return computation.aggregate_accumulator(accumulator)

    def get_pandas_computation(self) -> PandasComputation:
        return PandasComputation[Optional[int], Optional[int]](
            create_accumulator=lambda: None,
            update_accumulator=lambda acc, df: MaxCollectionSize._update(
                acc, df, self.col
            ),
            aggregate_accumulator=lambda acc: acc,
        )

    @staticmethod
    def _update(current_max: Optional[int], df: "pd.DataFrame", col) -> Optional[int]:
        # pylint: disable=import-outside-toplevel
        import pandas as pd

        sizes = df[col.name].dropna().apply(_collection_element_count).dropna()
        if sizes.empty:
            return current_max
        chunk_max = int(sizes.max())
        if pd.isnull(chunk_max):
            return current_max
        return chunk_max if current_max is None else max(current_max, chunk_max)


class MinCollectionSize(StaticMetric):
    """
    MIN_COLLECTION_SIZE Metric

    Given a collection (array/list) column, return the minimum number of elements.
    """

    schema_metric_type = MetricType.minCollectionSize

    @classmethod
    def name(cls):
        return MetricType.minCollectionSize.value

    @property
    def metric_type(self):
        return int

    @_label
    def fn(self):
        if is_collection(self.col.type):
            return func.min(CollectionSizeFn(column(self.col.name, self.col.type)))
        logger.debug(
            f"Column {self.col.name} is not a collection type; skipping MIN_COLLECTION_SIZE"
        )
        return None

    def df_fn(self, dfs: Optional["PandasRunner"] = None):
        if dfs is None or not is_collection(self.col.type):
            return None
        computation = self.get_pandas_computation()
        accumulator = computation.create_accumulator()
        for df in dfs:
            try:
                accumulator = computation.update_accumulator(accumulator, df)
            except Exception as err:
                logger.debug(
                    f"Error computing MIN_COLLECTION_SIZE for {self.col.name}: {err}"
                )
                return None
        return computation.aggregate_accumulator(accumulator)

    def get_pandas_computation(self) -> PandasComputation:
        return PandasComputation[Optional[int], Optional[int]](
            create_accumulator=lambda: None,
            update_accumulator=lambda acc, df: MinCollectionSize._update(
                acc, df, self.col
            ),
            aggregate_accumulator=lambda acc: acc,
        )

    @staticmethod
    def _update(current_min: Optional[int], df: "pd.DataFrame", col) -> Optional[int]:
        # pylint: disable=import-outside-toplevel
        import pandas as pd

        sizes = df[col.name].dropna().apply(_collection_element_count).dropna()
        if sizes.empty:
            return current_min
        chunk_min = int(sizes.min())
        if pd.isnull(chunk_min):
            return current_min
        return chunk_min if current_min is None else min(current_min, chunk_min)


class SumAndCountCollection(NamedTuple):
    sum_value: float
    count_value: int


class MeanCollectionSize(StaticMetric):
    """
    MEAN_COLLECTION_SIZE Metric

    Given a collection (array/list) column, return the average number of elements.
    """

    schema_metric_type = MetricType.meanCollectionSize

    @classmethod
    def name(cls):
        return MetricType.meanCollectionSize.value

    @property
    def metric_type(self):
        return float

    @_label
    def fn(self):
        if is_collection(self.col.type):
            return func.avg(CollectionSizeFn(column(self.col.name, self.col.type)))
        logger.debug(
            f"Column {self.col.name} is not a collection type; skipping MEAN_COLLECTION_SIZE"
        )
        return None

    def df_fn(self, dfs: Optional["PandasRunner"] = None):
        if dfs is None or not is_collection(self.col.type):
            return None
        computation = self.get_pandas_computation()
        accumulator = computation.create_accumulator()
        for df in dfs:
            try:
                accumulator = computation.update_accumulator(accumulator, df)
            except Exception as err:
                logger.debug(
                    f"Error computing MEAN_COLLECTION_SIZE for {self.col.name}: {err}"
                )
                return None
        return computation.aggregate_accumulator(accumulator)

    def get_pandas_computation(self) -> PandasComputation:
        return PandasComputation[SumAndCountCollection, Optional[float]](
            create_accumulator=lambda: SumAndCountCollection(0.0, 0),
            update_accumulator=lambda acc, df: MeanCollectionSize._update(
                acc, df, self.col
            ),
            aggregate_accumulator=MeanCollectionSize._aggregate,
        )

    @staticmethod
    def _update(
        acc: SumAndCountCollection, df: "pd.DataFrame", col
    ) -> SumAndCountCollection:
        sizes = df[col.name].dropna().apply(_collection_element_count).dropna()
        if sizes.empty:
            return acc
        return SumAndCountCollection(
            sum_value=acc.sum_value + float(sizes.sum()),
            count_value=acc.count_value + len(sizes),
        )

    @staticmethod
    def _aggregate(acc: SumAndCountCollection) -> Optional[float]:
        if acc.count_value == 0:
            return None
        return acc.sum_value / acc.count_value
