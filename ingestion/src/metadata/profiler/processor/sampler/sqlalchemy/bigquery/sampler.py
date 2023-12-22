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

from sqlalchemy.orm import Query

from metadata.generated.schema.entity.data.table import ProfileSampleType, TableType
from metadata.profiler.api.models import ProfileSampleConfig
from metadata.profiler.processor.handle_partition import partition_filter_handler
from metadata.profiler.processor.sampler.sqlalchemy.sampler import SQASampler
from metadata.utils.constants import SAMPLE_DATA_DEFAULT_COUNT


class BigQuerySampler(SQASampler):
    """
    Generates a sample of the data to not
    run the query in the whole table.
    """

    # pylint: disable=too-many-arguments
    def __init__(
        self,
        client,
        table,
        profile_sample_config: Optional[ProfileSampleConfig] = None,
        partition_details: Optional[Dict] = None,
        profile_sample_query: Optional[str] = None,
        sample_data_count: Optional[int] = SAMPLE_DATA_DEFAULT_COUNT,
        table_type: TableType = None,
    ):
        super().__init__(
            client,
            table,
            profile_sample_config,
            partition_details,
            profile_sample_query,
            sample_data_count,
        )
        self.table_type: TableType = table_type

    @partition_filter_handler(build_sample=True)
    def get_sample_query(self, *, column=None) -> Query:
        """get query for sample data"""
        # TABLESAMPLE SYSTEM is not supported for views
        if (
            self.profile_sample_type == ProfileSampleType.PERCENTAGE
            and self.table_type != TableType.View
        ):
            return (
                self._base_sample_query(column)
                .suffix_with(
                    f"TABLESAMPLE SYSTEM ({self.profile_sample or 100} PERCENT)",
                )
                .cte(f"{self.table.__tablename__}_sample")
            )

        return super().get_sample_query(column=column)
