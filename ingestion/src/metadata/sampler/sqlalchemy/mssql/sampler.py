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

from sqlalchemy import Table, text
from sqlalchemy.sql.selectable import CTE

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.type.basic import ProfileSampleType
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.sampler.sqlalchemy.sampler import SQASampler


class MssqlSampler(SQASampler):
    """
    Generates a sample of the data to not
    run the query in the whole table.
    """

    def set_tablesample(self, static: StaticSamplingConfig, selectable: Table):
        """Set the TABLESAMPLE clause for MSSQL
        Args:
            static (StaticSamplingConfig): sampling configuration
            selectable (Table): table to sample
        """
        static = self.sample_config.get_static_config()
        if self.entity.tableType != TableType.View:
            if static and static.profileSampleType == ProfileSampleType.PERCENTAGE:
                return selectable.tablesample(text(f"{static.profileSample or 100} PERCENT"))

            return selectable.tablesample(text(f"{int(static.profileSample or 100 if static else 100)} ROWS"))
        return selectable

    def get_sample_query(self, static: StaticSamplingConfig, *, column=None) -> CTE:
        """Override the base method as ROWS or PERCENT sampling handled through the tablesample clause"""
        selectable = self.set_tablesample(static, self.raw_dataset.__table__)
        rnd = self._base_sample_query(selectable, column).cte(f"{self.get_sampler_table_name()}_rnd")
        query = self.get_client().query(rnd)
        return query.cte(f"{self.get_sampler_table_name()}_sample")
