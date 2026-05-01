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

from typing import TYPE_CHECKING, Iterator, cast  # noqa: UP035

import pandas as pd

from metadata.generated.schema.entity.data.table import DataType
from metadata.sampler.pandas.sampler import DatalakeSampler
from metadata.utils.datalake.datalake_utils import DatalakeColumnWrapper

if TYPE_CHECKING:
    from metadata.ingestion.source.database.burstiq.client import BurstIQClient

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


class BurstIQSampler(DatalakeSampler):
    """
    Sampler for BurstIQ LifeGraph.

    Fetches records via paginated TQL queries and caches them as DataFrame
    chunks so that PandasProfilerInterface can compute all metrics without
    repeated API calls.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.client: BurstIQClient = cast("BurstIQClient", self.get_client())  # type: ignore[assignment]

    def get_dataframes(self, service_connection_config, client, table) -> DatalakeColumnWrapper:
        """Get the dataframes for burstIQ sampler

        Args:
            service_connection_config: Service connection config
            client: BurstIQ client
            table: Table entity
        Returns:
            DatalakeColumnWrapper: Wrapper containing the columns and dataframes
        """

        def chunk_generator() -> Iterator[pd.DataFrame]:
            chain = self.entity.name.root
            skip = 0
            while True:
                records = self.client.get_records_by_tql(chain, limit=_PAGE_SIZE, skip=skip)
                if not records:
                    break
                frame = self._cast_dataframe(pd.DataFrame(records))
                skip += len(records)
                yield frame
                if len(records) < _PAGE_SIZE:
                    break

        return DatalakeColumnWrapper(
            dataframes=chunk_generator,
            columns=None,
            raw_data=None,
        )

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
