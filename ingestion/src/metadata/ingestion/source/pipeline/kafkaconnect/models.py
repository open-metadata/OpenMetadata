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

from enum import Enum
from typing import List, Optional, Type, Union  # noqa: UP035

from pydantic import BaseModel, ConfigDict, Field, field_validator

from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic


class ConnectorType(str, Enum):
    """Kafka Connect connector types"""

    SOURCE = "source"
    SINK = "sink"
    UNKNOWN = "UNKNOWN"


class KafkaConnectTasks(BaseModel):
    id: int = Field(..., description="ID of the task")
    state: Optional[str] = Field(default="UNASSIGNED", description="State of the task (e.g., RUNNING, STOPPED)")  # noqa: UP045
    worker_id: Optional[str] = Field(default=None, description="ID of the worker running the task")  # noqa: UP045


class KafkaConnectTopics(BaseModel):
    name: str = Field(..., description="Name of the topic (e.g., random-source-avro)")
    fqn: Optional[str] = Field(default=None, description="Fully qualified name of the topic in OpenMetadata")  # noqa: UP045


class ServiceResolutionResult(BaseModel):
    """Result of service name resolution from connector config"""

    database_service_name: Optional[str] = Field(default=None, description="Resolved database service name")  # noqa: UP045
    messaging_service_name: Optional[str] = Field(default=None, description="Resolved messaging service name")  # noqa: UP045


class TopicResolutionResult(BaseModel):
    """Result of topic parsing and resolution"""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    topics: List[KafkaConnectTopics] = Field(default_factory=list, description="List of discovered/parsed topics")  # noqa: UP006
    topic_entity_map: dict[str, Optional[Topic]] = Field(  # noqa: UP045
        default_factory=dict, description="Map of topic name to resolved Topic entity"
    )


class KafkaConnectColumnMapping(BaseModel):
    """Model for column-level mapping between source and target"""

    source_column: str = Field(..., description="Source column name")
    target_column: str = Field(..., description="Target column/field name")


class KafkaConnectDatasetDetails(BaseModel):
    """
    Details about the dataset from kafkaconnect configuration
    """

    table: Optional[str] = None  # noqa: UP045
    database: Optional[str] = None  # noqa: UP045
    schema: Optional[str] = None  # noqa: UP045
    parent_container: Optional[str] = None  # noqa: UP045
    container_name: Optional[str] = None  # noqa: UP045
    column_mappings: List[KafkaConnectColumnMapping] = Field(  # noqa: UP006
        default_factory=list, description="Column-level mappings if available"
    )

    @property
    def dataset_type(self) -> Optional[Type[Union[Table, Container]]]:  # noqa: UP006, UP007, UP045
        if self.table or self.database:
            return Table
        if self.container_name or self.parent_container:
            return Container
        return None


class KafkaConnectPipelineDetails(BaseModel):
    """
    Details about a Kafka Connect pipeline/connector"""

    name: str = Field(..., description="Name of the status source (e.g., random-source-json)")
    status: Optional[str] = Field(  # noqa: UP045
        default="UNASSIGNED",
        description="State of the connector (e.g., RUNNING, STOPPED)",
    )
    tasks: Optional[List[KafkaConnectTasks]] = Field(default_factory=list)  # noqa: UP006, UP045
    topics: Optional[List[KafkaConnectTopics]] = Field(default_factory=list)  # noqa: UP006, UP045
    conn_type: Optional[str] = Field(default="UNKNOWN", alias="type")  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    datasets: Optional[List[KafkaConnectDatasetDetails]] = Field(default_factory=list)  # noqa: UP006, UP045
    config: Optional[dict] = Field(default_factory=dict)  # noqa: UP045

    @field_validator("conn_type", mode="before")
    @classmethod
    def normalize_connector_type(cls, value: str) -> str:
        """Normalize connector type to enum value"""
        if value:
            value_lower = value.lower()
            if value_lower == "source":
                return ConnectorType.SOURCE.value
            elif value_lower == "sink":  # noqa: RET505
                return ConnectorType.SINK.value
        return ConnectorType.UNKNOWN.value
