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
Flink Models
"""

from typing import List, Optional

from pydantic import BaseModel, Field


class FlinkTask(BaseModel):
    """Flink task model"""

    id: str
    name: str
    status: str
    start_time: Optional[int] = Field(alias="start-time", default=None)
    end_time: Optional[int] = Field(alias="end-time", default=None)


class FlinkPipeline(BaseModel):
    """Flink job model"""

    state: str
    name: str
    id: str = Field(alias="jid")
    start_time: Optional[int] = Field(alias="start-time", default=None)
    end_time: Optional[int] = Field(alias="end-time", default=None)
    tasks: Optional[List[FlinkTask]] = Field(alias="vertices", default=[])


class FlinkPipelineList(BaseModel):
    """Flink Pipelines List"""

    pipelines: Optional[List[FlinkPipeline]] = Field(alias="jobs", default=[])
