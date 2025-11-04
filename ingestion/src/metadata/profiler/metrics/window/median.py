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
Median Metric definition
"""
# pylint: disable=duplicate-code

from typing import TYPE_CHECKING, List, NamedTuple, Optional

from sqlalchemy import column

from metadata.generated.schema.configuration.profilerConfiguration import MetricType
from metadata.profiler.metrics.core import StaticMetric, _label
from metadata.profiler.metrics.pandas_metric_protocol import PandasComputation
from metadata.profiler.metrics.window.percentille_mixin import PercentilMixin
from metadata.profiler.orm.functions.length import LenFn
from metadata.profiler.orm.registry import is_concatenable, is_quantifiable
from metadata.utils.logger import profiler_logger

logger = profiler_logger()

if TYPE_CHECKING:
    import numpy as np
    import pandas as pd


class MedianAccumulator(NamedTuple):
    """Accumulator holding chunked NumPy arrays for fast median computation."""

    arrays: List["np.ndarray"]
    count_value: int


class Median(StaticMetric, PercentilMixin):
    """
    Median Metric

    Given a column, return the Median value.

    - For a quantifiable value, return the usual Median
    """

    @classmethod
    def name(cls):
        return MetricType.median.value

    @classmethod
    def is_window_metric(cls):
        return True

    @property
    def metric_type(self):
        return float

    @_label
    def fn(self):
        """sqlalchemy function

        Supports optional dimension_col property for GROUP BY correlation.
        Set via: add_props(dimension_col=col.name)(Metrics.MEDIAN.value)
        """
        # Get optional dimension_col property (for dimensionality validation)
        # Expected to be a string column name, not a Column object
        dimension_col = getattr(self, "dimension_col", None)

        if is_quantifiable(self.col.type):
            # col fullname is only needed for MySQL and SQLite
            return self._compute_sqa_fn(
                column(self.col.name, self.col.type),
                self.col.table.name if self.col.table is not None else None,
                0.5,
                dimension_col,
            )

        if is_concatenable(self.col.type):
            return self._compute_sqa_fn(
                LenFn(column(self.col.name, self.col.type)),
                self.col.table.name if self.col.table is not None else None,
                0.5,
                dimension_col,
            )

        logger.debug(
            f"Don't know how to process type {self.col.type} when computing Median"
        )
        return None

    def df_fn(self, dfs=None):
        """Dataframe function"""
        computation = self.get_pandas_computation()
        accumulator = computation.create_accumulator()
        for df in dfs:
            try:
                accumulator = computation.update_accumulator(accumulator, df)
            except MemoryError:
                logger.error(
                    f"Unable to compute Median for {self.col.name} due to memory constraints."
                    f"We recommend using a smaller sample size or partitioning."
                )
                return None
            except Exception as err:
                logger.debug(
                    f"Error while computing Median for column {self.col.name}: {err}"
                )
                return None
        median = computation.aggregate_accumulator(accumulator)

        if median is None:
            logger.warning(
                f"Don't know how to process type {self.col.type} when computing MEDIAN"
            )
            return None
        return median

    def get_pandas_computation(self) -> PandasComputation:
        return PandasComputation[MedianAccumulator, Optional[float]](
            create_accumulator=lambda: MedianAccumulator([], 0),
            update_accumulator=lambda acc, df: Median.update_accumulator(
                acc, df, self.col
            ),
            aggregate_accumulator=Median.aggregate_accumulator,
        )

    @staticmethod
    def update_accumulator(
        acc: MedianAccumulator, df: "pd.DataFrame", column
    ) -> MedianAccumulator:
        import numpy as np  # pylint: disable=import-outside-toplevel
        import pandas as pd  # pylint: disable=import-outside-toplevel

        series = df[column.name].dropna()
        if series.empty:
            return acc

        arr: Optional["np.ndarray"] = None

        if is_quantifiable(column.type):
            try:
                arr = series.to_numpy(dtype=float, copy=False)
            except Exception:  # noqa: BLE001
                arr = series.astype(float).to_numpy(copy=False)
        else:
            logger.debug(
                f"Don't know how to process type {column.type} when computing Median"
            )

        if arr is None or arr.size == 0:
            return acc

        acc.arrays.append(arr)
        return MedianAccumulator(acc.arrays, acc.count_value + int(arr.size))

    @staticmethod
    def aggregate_accumulator(acc: MedianAccumulator) -> Optional[float]:
        import numpy as np  # pylint: disable=import-outside-toplevel

        if acc.count_value == 0:
            return None

        if len(acc.arrays) == 1:
            data = acc.arrays[0]
        else:
            data = np.concatenate(acc.arrays, axis=0)

        median_val = np.median(data)

        if np.isnan(median_val):
            return None
        return float(median_val)
