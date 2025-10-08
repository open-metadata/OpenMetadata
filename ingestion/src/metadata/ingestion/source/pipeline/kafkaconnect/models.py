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

from typing import List, Optional, Type, Union

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


class KafkaConnectColumnMapping(BaseModel):
    """Model for column-level mapping between source and target"""

    source_column: str = Field(..., description="Source column name")
    target_column: str = Field(..., description="Target column/field name")


class KafkaConnectDatasetDetails(BaseModel):
    table: Optional[str] = None
    database: Optional[str] = None
    container_name: Optional[str] = None
    column_mappings: List[KafkaConnectColumnMapping] = Field(
        default_factory=list, description="Column-level mappings if available"
    )

    @property
    def dataset_type(self) -> Optional[Type[Union[Table, Container]]]:
        if self.table or self.database:
            return Table
        if self.container_name:
            return Container
        return None


class KafkaConnectPipelineDetails(BaseModel):
    name: str = Field(
        ..., description="Name of the status source (e.g., random-source-json)"
    )
    status: Optional[str] = Field(
        default="UNASSIGNED",
        description="State of the connector (e.g., RUNNING, STOPPED)",
    )
    tasks: Optional[List[KafkaConnectTasks]] = Field(default_factory=list)
    topics: Optional[List[KafkaConnectTopics]] = Field(default_factory=list)
    conn_type: Optional[str] = Field(default="UNKNOWN", alias="type")
    description: Optional[str] = None
    dataset: Optional[KafkaConnectDatasetDetails] = None
    config: Optional[dict] = Field(default_factory=dict)
