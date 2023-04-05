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
from typing import Any, Optional

from metadata.generated.schema.entity.data.table import TableData
from metadata.profiler.api.models import ProfileSampleConfig

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
        profile_sample_config: Optional[ProfileSampleConfig] = None,
        profile_sample_query: Optional[str] = None,
    ):
        self.profile_sample = None
        self.profile_sample_type = None
        if profile_sample_config:
            self.profile_sample = profile_sample_config.profile_sample
            self.profile_sample_type = profile_sample_config.profile_sample_type
        self.session = session
        self.table = table
        self._profile_sample_query = profile_sample_query
        self.sample_limit = 100
        self._sample_rows = None

    def _fetch_rows(self, data_frame):
        return data_frame.dropna().values.tolist()

    def get_col_row(self, data_frame):
        """
        Fetches columns and rows from the data_frame
        """
        cols = []
        rows = []
        cols = data_frame[0].columns.tolist()
        # Sample Data should not exceed sample limit
        for chunk in data_frame:
            rows.extend(self._fetch_rows(chunk)[: self.sample_limit])
            if len(rows) >= self.sample_limit:
                break
        return cols, rows

    def fetch_dl_sample_data(self) -> TableData:
        cols, rows = self.get_col_row(data_frame=self.table)
        return TableData(columns=cols, rows=rows)
