#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Native ClickZetta sampling for profiler and data-quality workflows."""

from sqlalchemy import Table, func, text
from sqlalchemy.sql.selectable import CTE

from metadata.generated.schema.type.basic import ProfileSampleType, SamplingMethodType
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.sampler.sqlalchemy.sampler import SQASampler


class ClickzettaSampler(SQASampler):
    """Use ClickZetta's native ``TABLESAMPLE ROW`` and ``SYSTEM`` modes."""

    @staticmethod
    def _sampling_method(static: StaticSamplingConfig):
        if static.samplingMethodType == SamplingMethodType.SYSTEM:
            return func.system
        return func.ROW

    def set_tablesample(self, static: StaticSamplingConfig | None, selectable: Table):
        """Apply ClickZetta's native row-count or percentage sampling."""

        if static is None:
            return selectable

        sampling_method = self._sampling_method(static)
        sample = static.profileSample or 100
        if static.profileSampleType == ProfileSampleType.PERCENTAGE:
            return selectable.tablesample(sampling_method(sample))

        return selectable.tablesample(sampling_method(text(f"{int(sample)} ROWS")))

    def get_sample_query(self, static: StaticSamplingConfig | None, *, column=None) -> CTE:
        """Build a sampled CTE using ClickZetta's native ``TABLESAMPLE`` clause."""

        selectable = self.set_tablesample(static, self.raw_dataset.__table__)  # type: ignore
        sampled = self._base_sample_query(selectable, column).cte(f"{self.get_sampler_table_name()}_rnd")
        with self.session_factory() as client:
            query = client.query(sampled)
        return query.cte(f"{self.get_sampler_table_name()}_sample")
