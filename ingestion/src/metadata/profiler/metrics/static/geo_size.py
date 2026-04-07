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
Geo size metrics: max, min, and mean number of points in geography/geometry columns.
"""

# pylint: disable=duplicate-code

from typing import TYPE_CHECKING, NamedTuple, Optional

from sqlalchemy import column, func

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import StaticMetric, _label
from metadata.profiler.metrics.pandas_metric_protocol import PandasComputation
from metadata.profiler.orm.functions.geo_size import GeoSizeFn
from metadata.profiler.orm.registry import is_complex
from metadata.utils.logger import profiler_logger

if TYPE_CHECKING:
    import pandas as pd

    from metadata.profiler.processor.runner import PandasRunner

logger = profiler_logger()


def _geo_point_count(value) -> Optional[int]:
    """Return the number of points in a geometry value, or None if not applicable."""
    if value is None:
        return None
    if hasattr(value, "__geo_interface__"):
        coords = value.__geo_interface__.get("coordinates", [])
        if isinstance(coords, list):
            return len(coords)
    if hasattr(value, "__len__"):
        return len(value)
    return None


class MaxGeoSize(StaticMetric):
    """
    MAX_GEO_SIZE Metric

    Given a geography/geometry column, return the maximum number of points.
    """

    schema_metric_type = MetricType.maxGeoSize

    @classmethod
    def name(cls):
        return MetricType.maxGeoSize.value

    @property
    def metric_type(self):
        return int

    @_label
    def fn(self):
        if is_complex(self.col.type):
            return func.max(GeoSizeFn(column(self.col.name, self.col.type)))
        logger.debug(f"Column {self.col.name} is not a geo type; skipping MAX_GEO_SIZE")
        return None

    def df_fn(self, dfs: Optional["PandasRunner"] = None):
        if dfs is None or not is_complex(self.col.type):
            return None
        computation = self.get_pandas_computation()
        accumulator = computation.create_accumulator()
        for df in dfs:
            try:
                accumulator = computation.update_accumulator(accumulator, df)
            except Exception as err:
                logger.debug(f"Error computing MAX_GEO_SIZE for {self.col.name}: {err}")
                return None
        return computation.aggregate_accumulator(accumulator)

    def get_pandas_computation(self) -> PandasComputation:
        return PandasComputation[Optional[int], Optional[int]](
            create_accumulator=lambda: None,
            update_accumulator=lambda acc, df: MaxGeoSize._update(acc, df, self.col),
            aggregate_accumulator=lambda acc: acc,
        )

    @staticmethod
    def _update(current_max: Optional[int], df: "pd.DataFrame", col) -> Optional[int]:
        import pandas as pd

        sizes = df[col.name].dropna().apply(_geo_point_count).dropna()
        if sizes.empty:
            return current_max
        chunk_max = int(sizes.max())
        if pd.isnull(chunk_max):
            return current_max
        return chunk_max if current_max is None else max(current_max, chunk_max)


class MinGeoSize(StaticMetric):
    """
    MIN_GEO_SIZE Metric

    Given a geography/geometry column, return the minimum number of points.
    """

    schema_metric_type = MetricType.minGeoSize

    @classmethod
    def name(cls):
        return MetricType.minGeoSize.value

    @property
    def metric_type(self):
        return int

    @_label
    def fn(self):
        if is_complex(self.col.type):
            return func.min(GeoSizeFn(column(self.col.name, self.col.type)))
        logger.debug(f"Column {self.col.name} is not a geo type; skipping MIN_GEO_SIZE")
        return None

    def df_fn(self, dfs: Optional["PandasRunner"] = None):
        if dfs is None or not is_complex(self.col.type):
            return None
        computation = self.get_pandas_computation()
        accumulator = computation.create_accumulator()
        for df in dfs:
            try:
                accumulator = computation.update_accumulator(accumulator, df)
            except Exception as err:
                logger.debug(f"Error computing MIN_GEO_SIZE for {self.col.name}: {err}")
                return None
        return computation.aggregate_accumulator(accumulator)

    def get_pandas_computation(self) -> PandasComputation:
        return PandasComputation[Optional[int], Optional[int]](
            create_accumulator=lambda: None,
            update_accumulator=lambda acc, df: MinGeoSize._update(acc, df, self.col),
            aggregate_accumulator=lambda acc: acc,
        )

    @staticmethod
    def _update(current_min: Optional[int], df: "pd.DataFrame", col) -> Optional[int]:
        import pandas as pd

        sizes = df[col.name].dropna().apply(_geo_point_count).dropna()
        if sizes.empty:
            return current_min
        chunk_min = int(sizes.min())
        if pd.isnull(chunk_min):
            return current_min
        return chunk_min if current_min is None else min(current_min, chunk_min)


class SumAndCountGeo(NamedTuple):
    sum_value: float
    count_value: int


class MeanGeoSize(StaticMetric):
    """
    MEAN_GEO_SIZE Metric

    Given a geography/geometry column, return the average number of points.
    """

    schema_metric_type = MetricType.meanGeoSize

    @classmethod
    def name(cls):
        return MetricType.meanGeoSize.value

    @property
    def metric_type(self):
        return float

    @_label
    def fn(self):
        if is_complex(self.col.type):
            return func.avg(GeoSizeFn(column(self.col.name, self.col.type)))
        logger.debug(
            f"Column {self.col.name} is not a geo type; skipping MEAN_GEO_SIZE"
        )
        return None

    def df_fn(self, dfs: Optional["PandasRunner"] = None):
        if dfs is None or not is_complex(self.col.type):
            return None
        computation = self.get_pandas_computation()
        accumulator = computation.create_accumulator()
        for df in dfs:
            try:
                accumulator = computation.update_accumulator(accumulator, df)
            except Exception as err:
                logger.debug(
                    f"Error computing MEAN_GEO_SIZE for {self.col.name}: {err}"
                )
                return None
        return computation.aggregate_accumulator(accumulator)

    def get_pandas_computation(self) -> PandasComputation:
        return PandasComputation[SumAndCountGeo, Optional[float]](
            create_accumulator=lambda: SumAndCountGeo(0.0, 0),
            update_accumulator=lambda acc, df: MeanGeoSize._update(acc, df, self.col),
            aggregate_accumulator=MeanGeoSize._aggregate,
        )

    @staticmethod
    def _update(acc: SumAndCountGeo, df: "pd.DataFrame", col) -> SumAndCountGeo:
        sizes = df[col.name].dropna().apply(_geo_point_count).dropna()
        if sizes.empty:
            return acc
        return SumAndCountGeo(
            sum_value=acc.sum_value + float(sizes.sum()),
            count_value=acc.count_value + len(sizes),
        )

    @staticmethod
    def _aggregate(acc: SumAndCountGeo) -> Optional[float]:
        if acc.count_value == 0:
            return None
        return acc.sum_value / acc.count_value
