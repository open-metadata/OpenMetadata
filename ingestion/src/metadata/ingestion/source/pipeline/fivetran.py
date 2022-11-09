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
Airbyte source to extract metadata
"""

from typing import Iterable, Optional

from pydantic import BaseModel

from metadata.clients.fivetran_client import FivetranClient
from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import Task
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.fivetranConnection import (
    FivetranConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class FivetranPipelineDetails(BaseModel):
    """
    Wrapper Class to combine source & destination
    """

    source: dict
    destination: dict
    group: dict

    @property
    def pipeline_name(self):
        return f'{self.group.get("id")}_{self.source.get("id")}'

    @property
    def pipeline_display_name(self):
        return f'{self.group.get("name")} <> {self.source.get("schema")}'


class FivetranSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Fivetran's REST API
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__(config, metadata_config)
        self.client = FivetranClient(self.service_connection)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: FivetranConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, FivetranConnection):
            raise InvalidSourceException(
                f"Expected AirbyteConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_connections_jobs(self, pipeline_details: FivetranPipelineDetails):
        """
        Returns the list of tasks linked to connection
        """
        return [
            Task(
                name=pipeline_details.pipeline_name,
                displayName=pipeline_details.pipeline_display_name,
                description="",
            )
        ]

    def yield_pipeline(
        self, pipeline_details: FivetranPipelineDetails
    ) -> Iterable[CreatePipelineRequest]:
        """
        Convert a Connection into a Pipeline Entity
        :param pipeline_details: pipeline_details object from fivetran
        :return: Create Pipeline request with tasks
        """
        yield CreatePipelineRequest(
            name=pipeline_details.pipeline_name,
            displayName=pipeline_details.pipeline_display_name,
            description="",
            pipelineUrl="",
            tasks=self.get_connections_jobs(pipeline_details),
            service=EntityReference(
                id=self.context.pipeline_service.id.__root__, type="pipelineService"
            ),
        )

    def yield_pipeline_status(
        self, pipeline_details: FivetranPipelineDetails
    ) -> Optional[OMetaPipelineStatus]:
        """
        Method to get task & pipeline status
        """

    def yield_pipeline_lineage_details(
        self, pipeline_details: FivetranPipelineDetails
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Parse all the stream available in the connection and create a lineage between them
        :param pipeline_details: pipeline_details object from airbyte
        :return: Lineage from inlets and outlets
        """
        source_service = self.metadata.get_by_name(
            entity=DatabaseService, fqn=pipeline_details.source.get("schema")
        )
        destination_service = self.metadata.get_by_name(
            entity=DatabaseService, fqn=pipeline_details.group.get("name")
        )
        if not source_service or not destination_service:
            return

        for schema, schema_data in self.client.get_connector_schema_details(
            connector_id=pipeline_details.source.get("id")
        ).items():
            for table in schema_data.get("tables", {}).keys():
                from_fqn = fqn.build(
                    self.metadata,
                    Table,
                    table_name=table,
                    database_name=pipeline_details.source.get("config", {}).get(
                        "database"
                    ),
                    schema_name=schema,
                    service_name=pipeline_details.source.get("schema"),
                )

                to_fqn = fqn.build(
                    self.metadata,
                    Table,
                    table_name=table,
                    database_name=pipeline_details.destination.get("config", {}).get(
                        "database"
                    ),
                    schema_name=f"{pipeline_details.source.get('schema')}_{schema}",
                    service_name=pipeline_details.group.get("name"),
                )

                from_entity = self.metadata.get_by_name(entity=Table, fqn=from_fqn)
                to_entity = self.metadata.get_by_name(entity=Table, fqn=to_fqn)
                if not from_entity or not to_entity:
                    logger.info(f"Lineage Skipped for {from_fqn} - {to_fqn}")
                    continue
                lineage_details = LineageDetails(
                    pipeline=EntityReference(
                        id=self.context.pipeline.id.__root__, type="pipeline"
                    )
                )

                yield AddLineageRequest(
                    edge=EntitiesEdge(
                        fromEntity=EntityReference(id=from_entity.id, type="table"),
                        toEntity=EntityReference(id=to_entity.id, type="table"),
                        lineageDetails=lineage_details,
                    )
                )

    def get_pipelines_list(self) -> Iterable[FivetranPipelineDetails]:
        """
        Get List of all pipelines
        """
        for group in self.client.list_groups():
            for connector in self.client.list_group_connectors(
                group_id=group.get("id")
            ):
                yield FivetranPipelineDetails(
                    destination=self.client.get_destination_details(group.get("id")),
                    source=self.client.get_connector_details(connector.get("id")),
                    group=group,
                )

    def get_pipeline_name(self, pipeline_details: FivetranPipelineDetails) -> str:
        """
        Get Pipeline Name
        """
        return pipeline_details.pipeline_name
