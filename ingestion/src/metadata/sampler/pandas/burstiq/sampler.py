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
BurstIQ Sampler.

Fetches records from a BurstIQ chain via TQL, converts them to a
pandas DataFrame, and exposes the standard SamplerInterface contract
so that PandasProfilerInterface can be used without any BurstIQ-specific
profiler code.
"""
from typing import Callable, Iterator, List, Optional

import pandas as pd

from metadata.generated.schema.entity.data.table import (
    DataType,
    ProfileSampleType,
    TableData,
)
from metadata.ingestion.source.database.burstiq.client import BurstIQClient
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.constants import SAMPLE_DATA_DEFAULT_COUNT
from metadata.utils.sqa_like_column import SQALikeColumn

_PAGE_SIZE = 5_000

_NUMERIC_TYPES = {
    DataType.INT,
    DataType.BIGINT,
    DataType.SMALLINT,
    DataType.TINYINT,
    DataType.LONG,
    DataType.FLOAT,
    DataType.DOUBLE,
    DataType.DECIMAL,
    DataType.NUMERIC,
    DataType.NUMBER,
}

_DATETIME_TYPES = {
    DataType.TIMESTAMP,
    DataType.DATETIME,
    DataType.DATE,
    DataType.TIME,
}


class BurstIQSampler(SamplerInterface):
    """
    Sampler for BurstIQ LifeGraph.

    Fetches records via paginated TQL queries and caches them as DataFrame
    chunks so that PandasProfilerInterface can compute all metrics without
    repeated API calls.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.client: BurstIQClient = self.get_client()
        self._cached_frames: Optional[List[pd.DataFrame]] = None

    # ------------------------------------------------------------------
    # SamplerInterface abstract methods
    # ------------------------------------------------------------------

    def get_client(self) -> BurstIQClient:
        """Return the BurstIQClient created by get_ssl_connection in the base __init__."""
        return self.connection

    def _load_frames(self) -> List[pd.DataFrame]:
        """Fetch records from BurstIQ in paginated chunks and cache for reuse across metrics."""
        if self._cached_frames is not None:
            return self._cached_frames

        chain = self.entity.name.root
        sample = self.sample_config.profileSample
        sample_type = self.sample_config.profileSampleType

        if sample and sample_type == ProfileSampleType.ROWS:
            total_limit: Optional[int] = int(sample)
        elif sample and sample_type == ProfileSampleType.PERCENTAGE:
            total = self.client.get_chain_metrics().get(chain, 0)
            total_limit = max(1, int(total * sample / 100))
        else:
            total_limit = None

        frames = []
        skip = 0
        while True:
            page_size = (
                min(_PAGE_SIZE, total_limit - skip) if total_limit else _PAGE_SIZE
            )
            records = self.client.get_records_by_tql(chain, limit=page_size, skip=skip)
            if not records:
                break
            frames.append(self._cast_dataframe(pd.DataFrame(records)))
            skip += len(records)
            if len(records) < page_size:
                break
            if total_limit and skip >= total_limit:
                break

        self._cached_frames = frames if frames else [pd.DataFrame()]
        return self._cached_frames

    @property
    def raw_dataset(self) -> Callable[[], Iterator[pd.DataFrame]]:
        """Return a callable that yields cached DataFrame chunks from BurstIQ."""

        def chunk_generator() -> Iterator[pd.DataFrame]:
            yield from self._load_frames()

        return chunk_generator

    def get_dataset(self, **__) -> Callable[[], Iterator[pd.DataFrame]]:
        """Return the dataset callable (sampling applied via TQL limit)."""
        return self.raw_dataset

    def _rdn_sample_from_user_query(self) -> Callable[[], Iterator[pd.DataFrame]]:
        """BurstIQ does not support custom profiler queries; fall back to full scan."""
        return self.raw_dataset

    def _fetch_sample_data_from_user_query(self) -> TableData:
        """BurstIQ does not support custom profiler queries; fall back to full scan."""
        return self.fetch_sample_data(self.columns)

    def fetch_sample_data(self, columns: Optional[List[SQALikeColumn]]) -> TableData:
        """Return a TableData snapshot for the Data Preview tab in the UI."""
        df = next(self.raw_dataset())
        target_cols = [c.name for c in (columns or self.get_columns())]

        if df.empty:
            return TableData(columns=target_cols, rows=[])

        available = [c for c in target_cols if c in df.columns]
        row_limit = min(self.sample_limit or SAMPLE_DATA_DEFAULT_COUNT, len(df))
        subset = df[available].head(row_limit)

        rows = [
            [self._truncate_cell(str(v)) for v in row]
            for row in subset.itertuples(index=False, name=None)
        ]
        return TableData(columns=available, rows=rows)

    def get_columns(self) -> List[SQALikeColumn]:
        """Return SQALikeColumn list derived from the OM Table entity."""
        return [
            SQALikeColumn(name=c.name.root, type=c.dataType)
            for c in self.entity.columns
        ]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _cast_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Cast DataFrame columns to their declared types from OM entity metadata.

        BurstIQ TQL returns all values as raw JSON types — large integers may arrive
        as scientific-notation strings (e.g. "9.87E+08") and mismatched columns may
        contain strings where metadata declares INT. Using errors='coerce' converts
        unparseable values to NaN instead of raising, so the profiler degrades
        gracefully rather than hard-failing.
        """
        if df.empty or not self.entity.columns:
            return df
        for col in self.entity.columns:
            col_name = col.name.root
            if col_name not in df.columns:
                continue
            if col.dataType in _NUMERIC_TYPES:
                df[col_name] = pd.to_numeric(df[col_name], errors="coerce")
            elif col.dataType in _DATETIME_TYPES:
                df[col_name] = pd.to_datetime(df[col_name], errors="coerce", utc=True)
        return df
