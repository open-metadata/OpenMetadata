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
    state: str | None = Field(default="UNASSIGNED", description="State of the task (e.g., RUNNING, STOPPED)")
    worker_id: str | None = Field(default=None, description="ID of the worker running the task")


class KafkaConnectTopics(BaseModel):
    name: str = Field(..., description="Name of the topic (e.g., random-source-avro)")
    fqn: str | None = Field(default=None, description="Fully qualified name of the topic in OpenMetadata")


class ServiceResolutionResult(BaseModel):
    """Result of service name resolution from connector config"""

    database_service_name: str | None = Field(default=None, description="Resolved database service name")
    messaging_service_name: str | None = Field(default=None, description="Resolved messaging service name")


class TopicResolutionResult(BaseModel):
    """Result of topic parsing and resolution"""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    topics: list[KafkaConnectTopics] = Field(default_factory=list, description="List of discovered/parsed topics")
    topic_entity_map: dict[str, Topic | None] = Field(
        default_factory=dict, description="Map of topic name to resolved Topic entity"
    )


class ConfluentTelemetryRow(BaseModel):
    """
    One topic/client pair from Confluent's telemetry Data Flow dataset.

    The API returns its group_by fields under dotted names, which are not valid Python
    identifiers, so both are read through aliases. The metric value is deliberately absent:
    only the pairing carries meaning here, since the question is which client wrote to
    which topic and not how much it wrote.

    Both halves are required and non-empty, because a row missing either one attributes a
    topic to no connector or a connector to no topic, and neither can become lineage.
    """

    model_config = ConfigDict(populate_by_name=True)

    client_id: str = Field(..., min_length=1, alias="metric.client_id", description="Producer or consumer client id")
    topic: str = Field(..., min_length=1, alias="metric.topic", description="Topic the client wrote to")


class KafkaConnectColumnMapping(BaseModel):
    """Model for column-level mapping between source and target"""

    source_column: str = Field(..., description="Source column name")
    target_column: str = Field(..., description="Target column/field name")


class KafkaConnectDatasetDetails(BaseModel):
    """
    Details about the dataset from kafkaconnect configuration
    """

    table: str | None = None
    database: str | None = None
    schema: str | None = None
    parent_container: str | None = None
    container_name: str | None = None
    column_mappings: list[KafkaConnectColumnMapping] = Field(
        default_factory=list, description="Column-level mappings if available"
    )

    @property
    def dataset_type(self) -> type[Table | Container] | None:
        if self.table or self.database:
            return Table
        if self.container_name or self.parent_container:
            return Container
        return None


class KafkaConnectPipelineDetails(BaseModel):
    """
    Details about a Kafka Connect pipeline/connector"""

    name: str = Field(..., description="Name of the status source (e.g., random-source-json)")
    status: str | None = Field(
        default="UNASSIGNED",
        description="State of the connector (e.g., RUNNING, STOPPED)",
    )
    tasks: list[KafkaConnectTasks] | None = Field(default_factory=list)
    topics: list[KafkaConnectTopics] | None = Field(default_factory=list)
    conn_type: str | None = Field(default="UNKNOWN", alias="type")
    description: str | None = None
    datasets: list[KafkaConnectDatasetDetails] | None = Field(default_factory=list)
    config: dict | None = Field(default_factory=dict)

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
