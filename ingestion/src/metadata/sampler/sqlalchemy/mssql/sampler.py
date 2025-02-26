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


from sqlalchemy import Table, text
from sqlalchemy.sql.selectable import CTE

from metadata.generated.schema.entity.data.table import ProfileSampleType, TableType
from metadata.sampler.sqlalchemy.sampler import SQASampler


class MssqlSampler(SQASampler):
    """
    Generates a sample of the data to not
    run the query in the whole table.
    """

    def set_tablesample(self, selectable: Table):
        """Set the TABLESAMPLE clause for MSSQL
        Args:
            selectable (Table): _description_
        """
        if self.entity.tableType != TableType.View:
            if self.sample_config.profileSampleType == ProfileSampleType.PERCENTAGE:
                return selectable.tablesample(
                    text(f"{self.sample_config.profileSample or 100} PERCENT")
                )

            return selectable.tablesample(
                text(f"{int(self.sample_config.profileSample or 100)} ROWS")
            )
        return selectable

    def get_sample_query(self, *, column=None) -> CTE:
        """get query for sample data"""
        rnd = self._base_sample_query(column).cte(
            f"{self.get_sampler_table_name()}_rnd"
        )
        query = self.client.query(rnd)
        return query.cte(f"{self.get_sampler_table_name()}_sample")
