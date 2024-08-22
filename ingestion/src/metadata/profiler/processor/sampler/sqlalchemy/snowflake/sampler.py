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

from typing import cast

from sqlalchemy import Table
from sqlalchemy.sql.selectable import CTE

from metadata.generated.schema.entity.data.table import ProfileSampleType
from metadata.profiler.processor.handle_partition import partition_filter_handler
from metadata.profiler.processor.sampler.sqlalchemy.sampler import SQASampler


class SnowflakeSampler(SQASampler):
    """
    Generates a sample of the data to not
    run the query in the whole table.
    """

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)

    @partition_filter_handler(build_sample=True)
    def get_sample_query(self, *, column=None) -> CTE:
        """get query for sample data"""
        # TABLESAMPLE SYSTEM is not supported for views
        self.table = cast(Table, self.table)

        if self.profile_sample_type == ProfileSampleType.PERCENTAGE:
            rnd = (
                self._base_sample_query(
                    column,
                )
                .suffix_with(
                    f"SAMPLE BERNOULLI ({self.profile_sample or 100})",
                )
                .cte(f"{self.table.__tablename__}_rnd")
            )
            session_query = self.client.query(rnd)
            return session_query.cte(f"{self.table.__tablename__}_sample")

        return (
            self._base_sample_query(column)
            .suffix_with(
                f"TABLESAMPLE ({self.profile_sample or 100} ROWS)",
            )
            .cte(f"{self.table.__tablename__}_sample")
        )
