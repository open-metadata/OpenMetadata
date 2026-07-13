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
Helper module to handle data sampling for the profiler
"""

from sqlalchemy import Table as SqaTable
from sqlalchemy import func
from sqlalchemy.orm import Query

from metadata.generated.schema.type.basic import ProfileSampleType
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.sampler.sqlalchemy.sampler import SQASampler
from metadata.sampler.sqlalchemy.snowflake.sampler import SamplingMethodType


class PostgresSampler(SQASampler):
    """
    Generates a sample of the data to not
    run the query in the whole table.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.sampling_fn = func.bernoulli
        self.sampling_method_type = SamplingMethodType.BERNOULLI
        static = self._resolve_sample_config
        if static and static.samplingMethodType == SamplingMethodType.SYSTEM:
            self.sampling_fn = func.system

    def set_tablesample(self, static: StaticSamplingConfig | None, selectable: SqaTable):
        """Set the TABLESAMPLE clause for postgres
        Args:
            static (StaticSamplingConfig | None): sampling configuration
            selectable (Table): table to sample
        """
        if static and static.profileSampleType == ProfileSampleType.PERCENTAGE:
            return selectable.tablesample(self.sampling_fn(static.profileSample or 100))

        return selectable

    def get_sample_query(self, static: StaticSamplingConfig | None, *, column=None) -> Query:
        selectable = self.set_tablesample(static, self.raw_dataset.__table__)  # type: ignore
        if static and static.profileSampleType == ProfileSampleType.PERCENTAGE:
            return self._base_sample_query(selectable, column).cte(f"{self.get_sampler_table_name()}_rnd")  # type: ignore

        return super().get_sample_query(static, column=column)
