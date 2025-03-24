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
"""Model for the OpenMetadata Profiler Source"""
from pydantic import ConfigDict

from metadata.ingestion.models.custom_pydantic import BaseModel
from metadata.ingestion.models.entity_interface import EntityInterface
from metadata.profiler.source.profiler_source_interface import ProfilerSourceInterface


class ProfilerSourceAndEntity(BaseModel):
    """Return class for the OpenMetadata Profiler Source"""

    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)

    profiler_source: ProfilerSourceInterface
    entity: EntityInterface

    def __str__(self):
        """Return the information of the table being profiler"""
        return f"Table [{self.entity.name.root}]"
