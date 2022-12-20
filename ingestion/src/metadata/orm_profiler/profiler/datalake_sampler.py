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
Helper module to handle data sampling
for the profiler
"""
from typing import Any, Dict, Optional

from metadata.generated.schema.entity.data.table import TableData
from metadata.ingestion.source.database.datalake import DatalakeSource
from metadata.orm_profiler.api.models import ProfileSampleConfig

RANDOM_LABEL = "random"


class DatalakeSampler:
    """
    Generates a sample of the data to not
    run the query in the whole table.
    """

    def __init__(
        self,
        session: Optional[Any],
        table,
        profile_sample: Optional[ProfileSampleConfig] = None,
        partition_details: Optional[Dict] = None,
        profile_sample_query: Optional[str] = None,
    ):
        self.profile_sample = profile_sample
        self.session = session
        self.table = table
        self._partition_details = partition_details
        self._profile_sample_query = profile_sample_query
        self.sample_limit = 100
        self._sample_rows = None

    def get_col_row(self, data_frame):
        from pandas import DataFrame, notnull  # pylint: disable=import-outside-toplevel

        cols = []
        chunk = None
        if isinstance(data_frame, DataFrame):
            table_columns = DatalakeSource.get_columns(data_frame=data_frame)
            return (
                [col.name.__root__ for col in table_columns],
                data_frame.astype(object)
                .where(notnull(data_frame), None)
                .values.tolist()[:100],
            )
        for chunk in data_frame:
            table_columns = DatalakeSource.get_columns(data_frame=chunk)
            cols = [col.name.__root__ for col in table_columns]
            rows = chunk.values.tolist()
            break
        return cols, rows, chunk

    def fetch_dl_sample_data(self) -> TableData:
        from pandas import DataFrame  # pylint: disable=import-outside-toplevel

        cols, rows = self.get_col_row(
            data_frame=self.table[0]
            if not isinstance(self.table, DataFrame)
            else self.table
        )
        return TableData(columns=cols, rows=rows)
