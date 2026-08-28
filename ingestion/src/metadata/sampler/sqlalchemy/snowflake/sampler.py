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

from sqlalchemy import Table, func, text
from sqlalchemy.sql.selectable import CTE

from metadata.generated.schema.type.basic import ProfileSampleType, SamplingMethodType
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.sampler.sqlalchemy.sampler import SQASampler


class SnowflakeSampler(SQASampler):
    """
    Generates a sample of the data to not
    run the query in the whole table.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.sampling_method_type = func.bernoulli
        static = self._resolve_sample_config
        if static and static.samplingMethodType == SamplingMethodType.SYSTEM:
            self.sampling_method_type = func.system

    def set_tablesample(self, static: StaticSamplingConfig | None, selectable: Table):
        """Set the TABLESAMPLE clause for Snowflake
        Args:
            static (StaticSamplingConfig | None): sampling configuration
            selectable (Table): table to sample
        """
        if static is None:
            return selectable

        if static and static.profileSampleType == ProfileSampleType.PERCENTAGE:
            return selectable.tablesample(self.sampling_method_type(static.profileSample or 100))

        return selectable.tablesample(func.ROW(text(f"{static.profileSample or 100 if static else 100} ROWS")))

    def get_sample_query(self, static: StaticSamplingConfig | None, *, column=None) -> CTE:
        """Override the base method as ROWS or PERCENT sampling handled through the tablesample clause"""
        selectable = self.set_tablesample(static, self.raw_dataset.__table__)  # type: ignore
        rnd = self._base_sample_query(selectable, column).cte(f"{self.get_sampler_table_name()}_rnd")
        with self.session_factory() as client:
            query = client.query(rnd)
        return query.cte(f"{self.get_sampler_table_name()}_sample")
