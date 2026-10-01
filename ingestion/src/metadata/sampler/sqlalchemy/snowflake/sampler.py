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

import json
from typing import Any

from snowflake.sqlalchemy import VARIANT
from sqlalchemy import Column, Table, func, text
from sqlalchemy.sql.selectable import CTE

from metadata.generated.schema.type.basic import ProfileSampleType, SamplingMethodType
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.profiler.orm.types.custom_array import CustomArray
from metadata.sampler.sqlalchemy.sampler import SQASampler
from metadata.utils.constants import SAMPLE_DATA_MAX_CELL_LENGTH


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

    def _process_sample_value(self, column: Column, value: Any) -> Any:
        """The driver returns VARIANT, OBJECT (both profiled as VARIANT) and ARRAY values as JSON text.

        A value longer than the sample cell limit stays text, so truncation still bounds it.
        """
        if (
            isinstance(value, str)
            and len(value) <= SAMPLE_DATA_MAX_CELL_LENGTH
            and isinstance(column.type, (VARIANT, CustomArray))
        ):
            try:
                return json.loads(value)
            except ValueError:
                return value
        return value

    def get_sample_query(self, static: StaticSamplingConfig | None, *, column=None) -> CTE:
        """Override the base method as ROWS or PERCENT sampling handled through the tablesample clause"""
        selectable = self.set_tablesample(static, self.raw_dataset.__table__)  # type: ignore
        rnd = self._base_sample_query(selectable, column).cte(f"{self.get_sampler_table_name()}_rnd")
        with self.session_factory() as client:
            query = client.query(rnd)
        return query.cte(f"{self.get_sampler_table_name()}_sample")
