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
        ..., description="ID of the worker running the task"
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
    tasks: Optional[List[KafkaConnectTasks]]
    topics: Optional[List[KafkaConnectTopics]]
    conn_type: Optional[str] = Field(..., alias="type")


class KafkaConnectDatasetDetails(BaseModel):
    table: Optional[str]
    database: Optional[str]
    container_name: Optional[str]

    @property
    def dataset_type(self):
        if self.table or self.database:
            return Table
        if self.container_name:
            return Container
        return None
