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
Helper module to handle data sampling
for the profiler
"""

from typing import Callable, List, Optional, cast  # noqa: UP035

from metadata.generated.schema.entity.data.table import (
    PartitionProfilerConfig,
    TableData,
)
from metadata.generated.schema.type.basic import ProfileSampleType
from metadata.mixins.pandas.pandas_mixin import PandasInterfaceMixin
from metadata.sampler.sampler_config import DatabaseSamplerConfig
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.datalake.datalake_utils import GenericDataFrameColumnParser
from metadata.utils.logger import profiler_logger
from metadata.utils.sqa_like_column import SQALikeColumn
from metadata.utils.ssl_manager import get_ssl_connection

logger = profiler_logger()


class DatalakeSampler(SamplerInterface, PandasInterfaceMixin):
    """
    Generates a sample of the data to not
    run the query in the whole table.
    """

    def __init__(self, *args, **kwargs):
        """Init the pandas sampler"""
        super().__init__(*args, **kwargs)
        db_config = kwargs.get("config") or DatabaseSamplerConfig()
        self.connection = get_ssl_connection(self.service_connection_config)
        self.partition_details = cast(PartitionProfilerConfig, db_config.partition_details)  # noqa: TC006
        self.sample_query: str | None = db_config.sample_query
        self._table = None
        self.client = self.get_client()

    @property
    def raw_dataset(self) -> Callable:
        """Get the raw dataset (unpartitioned and unsampled)"""
        if not self._table:
            self._table = self.get_dataframes(
                service_connection_config=self.service_connection_config,
                client=self.client,
                table=self.entity,
            )
        return self._table.dataframes

    def _get_asset_row_count(self) -> int:
        """
        Get the row count of the asset being profiled. This is used for dynamic sampling.
        Default implementation returns 0 and should be overridden by implementations that support fetching row count.
        """
        try:
            self._row_count = sum(len(chunk.index) for chunk in self.raw_dataset())
        except Exception:
            logger.exception("Failed to fetch row count for asset %s. Defaulting to 0.", self.entity.name)
            self._row_count = 0

        return self._row_count

    def get_client(self):
        return self.connection

    def _partitioned_table(self):
        """Get partitioned table"""
        return self.get_partitioned_df(self.partition_details, self.raw_dataset)

    def _fetch_sample_data_from_user_query(self) -> TableData:
        """Fetch sample data from user query"""
        cols, rows = self.get_col_row(df_iterator=self._rdn_sample_from_user_query())
        return TableData(columns=cols, rows=rows)

    def _rdn_sample_from_user_query(self) -> Callable:
        """Generate sample from user query"""
        return self.get_sampled_query_dataframe(sample_query=self.sample_query, raw_dataset=self.raw_dataset)

    def get_col_row(
        self,
        df_iterator: Callable,
        columns: Optional[List[SQALikeColumn]] = None,  # noqa: UP006, UP045
        sample_query: str = None,  # noqa: RUF013
    ):
        """
        Fetches columns and rows from the data_frame
        """
        cols = None
        if columns:
            cols = [col.name for col in columns]
        rows = []
        # Sample Data should not exceed sample limit
        for chunk in df_iterator():
            if cols is None:
                cols = chunk.columns.tolist()
            if sample_query is not None:
                chunk = chunk.query(sample_query)  # noqa: PLW2901
            rows.extend(self._fetch_rows(chunk[cols])[: self.sample_limit])
            if len(rows) >= (self.sample_limit or 100):
                break
        return cols, rows

    def get_dataset(self, **__):
        """Generate random sample from the table

        Returns:
            List[DataFrame]
        """
        raw_dataset = self.raw_dataset
        if self.sample_query:
            return self._rdn_sample_from_user_query()

        if self.partition_details:
            raw_dataset = self._partitioned_table()

        static = self._resolve_sample_config
        if (
            not static
            or not static.profileSample
            or (
                static.profileSample == 100
                and static.profileSampleType == ProfileSampleType.PERCENTAGE
                and self.sample_config.randomizedSample is not True
            )
        ):
            return raw_dataset
        return self.get_sampled_dataframe(raw_dataset, static)

    def _fetch_rows(self, data_frame):
        return [[self._truncate_cell(cell) for cell in row] for row in data_frame.dropna().values.tolist()]

    def fetch_sample_data(self, columns: Optional[List[SQALikeColumn]] = None) -> TableData:  # noqa: UP006, UP045
        """Fetch sample data from the table

        Returns:
            TableData:
        """
        if self.sample_query:
            return self._fetch_sample_data_from_user_query()

        cols, rows = self.get_col_row(df_iterator=self.raw_dataset, columns=columns)
        return TableData(columns=cols, rows=rows)

    def get_columns(self) -> List[Optional[SQALikeColumn]]:  # noqa: UP006, UP045
        """Get SQALikeColumns for datalake to be passed for metric computation"""
        sqalike_columns = []
        if self.raw_dataset:
            first_chunk = next(self.raw_dataset())
            for column_name in first_chunk.columns:
                column_name = self._get_column_name(column_name)  # noqa: PLW2901
                sqalike_columns.append(
                    SQALikeColumn(
                        column_name,
                        GenericDataFrameColumnParser.fetch_col_types(first_chunk, column_name),
                    )
                )
            return sqalike_columns
        return []
