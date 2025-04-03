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
KafkaConnect Source Model module
"""

from typing import List, Optional

from pydantic import BaseModel, Field

from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.table import Table


class KafkaConnectTasks(BaseModel):
    id: int = Field(..., description="ID of the task")
    state: Optional[str] = Field(
        default="UNASSIGNED", description="State of the task (e.g., RUNNING, STOPPED)"
    )
    worker_id: Optional[str] = Field(
        default=None, description="ID of the worker running the task"
    )


class KafkaConnectTopics(BaseModel):
    name: str = Field(..., description="Name of the topic (e.g., random-source-avro)")


class KafkaConnectPipelineDetails(BaseModel):
    name: str = Field(
        ..., description="Name of the status source (e.g., random-source-json)"
    )
    status: Optional[str] = Field(
        default="UNASSIGNED",
        description="State of the connector (e.g., RUNNING, STOPPED)",
    )
    tasks: Optional[List[KafkaConnectTasks]] = []
    topics: Optional[List[KafkaConnectTopics]] = []
    conn_type: Optional[str] = Field(default="UNKNOWN", alias="type")


class KafkaConnectDatasetDetails(BaseModel):
    table: Optional[str] = None
    database: Optional[str] = None
    container_name: Optional[str] = None

    @property
    def dataset_type(self):
        if self.table or self.database:
            return Table
        if self.container_name:
            return Container
        return None
