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
from typing import Callable, List, Optional, cast

from metadata.generated.schema.entity.data.table import (
    PartitionProfilerConfig,
    ProfileSampleType,
    TableData,
)
from metadata.mixins.pandas.pandas_mixin import PandasInterfaceMixin
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.datalake.datalake_utils import GenericDataFrameColumnParser
from metadata.utils.logger import profiler_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = profiler_logger()


class DatalakeSampler(SamplerInterface, PandasInterfaceMixin):
    """
    Generates a sample of the data to not
    run the query in the whole table.
    """

    def __init__(self, *args, **kwargs):
        """Init the pandas sampler"""
        super().__init__(*args, **kwargs)
        self.partition_details = cast(PartitionProfilerConfig, self.partition_details)
        self._table = None
        self.client = self.get_client()

    @property
    def raw_dataset(self) -> Callable:
        """Get the raw dataset (unpartitioned and unsampled)"""
        if not self._table:
            self._table = self.get_dataframes(
                service_connection_config=self.service_connection_config,
                client=self.client.client,
                table=self.entity,
            )
        return self._table.dataframes

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
        return self.get_sampled_query_dataframe(
            sample_query=self.sample_query, raw_dataset=self.raw_dataset
        )

    def get_col_row(
        self,
        df_iterator: Callable,
        columns: Optional[List[SQALikeColumn]] = None,
        sample_query: str = None,
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
                chunk = chunk.query(sample_query)
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

        if not self.sample_config.profileSample or (
            self.sample_config.profileSample == 100
            and self.sample_config.profileSampleType == ProfileSampleType.PERCENTAGE
        ):
            return raw_dataset
        return self.get_sampled_dataframe(raw_dataset, self.sample_config)

    def _fetch_rows(self, data_frame):
        return data_frame.dropna().values.tolist()

    def fetch_sample_data(
        self, columns: Optional[List[SQALikeColumn]] = None
    ) -> TableData:
        """Fetch sample data from the table

        Returns:
            TableData:
        """
        if self.sample_query:
            return self._fetch_sample_data_from_user_query()

        cols, rows = self.get_col_row(df_iterator=self.raw_dataset, columns=columns)
        return TableData(columns=cols, rows=rows)

    def get_columns(self) -> List[Optional[SQALikeColumn]]:
        """Get SQALikeColumns for datalake to be passed for metric computation"""
        sqalike_columns = []
        if self.raw_dataset:
            first_chunk = next(self.raw_dataset())
            for column_name in first_chunk.columns:
                column_name = self._get_column_name(column_name)
                sqalike_columns.append(
                    SQALikeColumn(
                        column_name,
                        GenericDataFrameColumnParser.fetch_col_types(
                            first_chunk, column_name
                        ),
                    )
                )
            return sqalike_columns
        return []
