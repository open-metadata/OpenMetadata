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

from typing import Dict, Optional

from sqlalchemy import func, text
from sqlalchemy.orm import Query

from metadata.generated.schema.entity.data.table import (
    ProfileSampleType,
    SamplingMethodType,
)
from metadata.profiler.api.models import ProfileSampleConfig
from metadata.profiler.orm.functions.table_metric_computer import Table
from metadata.profiler.processor.sampler.sqlalchemy.sampler import SQASampler
from metadata.utils.constants import SAMPLE_DATA_DEFAULT_COUNT


class SnowflakeSampler(SQASampler):
    """
    Generates a sample of the data to not
    run the query in the whole table.
    """

    def __init__(
        self,
        client,
        table,
        profile_sample_config: Optional[ProfileSampleConfig] = None,
        partition_details: Optional[Dict] = None,
        profile_sample_query: Optional[str] = None,
        sample_data_count: Optional[int] = SAMPLE_DATA_DEFAULT_COUNT,
    ):
        super().__init__(
            client,
            table,
            profile_sample_config,
            partition_details,
            profile_sample_query,
            sample_data_count,
        )
        self.sampling_fn = func.bernoulli
        if (
            profile_sample_config
            and profile_sample_config.sampling_method_type == SamplingMethodType.SYSTEM
        ):
            self.sampling_fn = func.system

    def set_tablesample(self, selectable: Table):
        """Set the TABLESAMPLE clause for Snowflake

        Args:
            selectable (Table): _description_
        """
        if self.profile_sample_type == ProfileSampleType.PERCENTAGE:
            return selectable.tablesample(self.sampling_fn(self.profile_sample or 100))

        return selectable.tablesample(
            func.ROW(text(f"{self.profile_sample or 100} ROWS"))
        )

    def get_sample_query(self, *, column=None) -> Query:
        rnd = self._base_sample_query(column).cte(f"{self.table.__tablename__}_rnd")
        query = self.client.query(rnd)
        return query.cte(f"{self.table.__tablename__}_sample")
