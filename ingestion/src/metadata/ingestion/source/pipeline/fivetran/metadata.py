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

import traceback
from typing import Iterable, List, Optional, Union, cast

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import Pipeline, Task
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.pipeline.fivetranConnection import (
    FivetranConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    SourceUrl,
)
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.sql_lineage import get_column_fqn
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.fivetran.client import FivetranClient
from metadata.ingestion.source.pipeline.fivetran.models import FivetranPipelineDetails
from metadata.ingestion.source.pipeline.openlineage.models import TableDetails
from metadata.ingestion.source.pipeline.openlineage.utils import FQNNotFoundException
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class FivetranSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Fivetran's REST API
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: FivetranConnection = config.serviceConnection.root.config
        if not isinstance(connection, FivetranConnection):
            raise InvalidSourceException(
                f"Expected FivetranConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_connections_jobs(
        self,
        pipeline_details: FivetranPipelineDetails,
        source_url: Optional[SourceUrl] = None,
    ) -> List[Task]:
        """Returns the list of tasks linked to connection"""
        return [
            Task(
                name=pipeline_details.pipeline_name,
                displayName=pipeline_details.pipeline_display_name,
                sourceUrl=source_url,
            )  # type: ignore
        ]

    def yield_pipeline(
        self, pipeline_details: FivetranPipelineDetails
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """
        Convert a Connection into a Pipeline Entity
        :param pipeline_details: pipeline_details object from fivetran
        :return: Create Pipeline request with tasks
        """
        source_url = self.get_source_url(
            connector_id=pipeline_details.source.get("id"),
            group_id=pipeline_details.group.get("id"),
            source_name=pipeline_details.source.get("service"),
        )
        pipeline_request = CreatePipelineRequest(
            name=EntityName(pipeline_details.pipeline_name),
            displayName=pipeline_details.pipeline_display_name,
            tasks=self.get_connections_jobs(
                pipeline_details=pipeline_details, source_url=source_url
            ),
            service=FullyQualifiedEntityName(self.context.get().pipeline_service),
            sourceUrl=source_url,
        )  # type: ignore
        yield Either(left=None, right=pipeline_request)
        self.register_record(pipeline_request=pipeline_request)

    def yield_pipeline_status(
        self, pipeline_details: FivetranPipelineDetails
    ) -> Optional[Iterable[Either[OMetaPipelineStatus]]]:
        """Method to get task & pipeline status"""

    def fetch_column_lineage(
        self, pipeline_details: FivetranPipelineDetails, schema, schema_data, table
    ) -> List[Optional[ColumnLineage]]:
        col_details = self.client.get_connector_column_lineage(
            pipeline_details.connector_id, schema_name=schema, table_name=table
        )
        col_lineage_arr = []
        try:
            from_entity_fqn: Optional[str] = self._get_table_fqn_from_om(
                table_details=TableDetails(schema=schema, name=table)
            )
            to_entity_fqn: Optional[str] = self._get_table_fqn_from_om(
                table_details=TableDetails(
                    schema=schema_data.get("name_in_destination"),
                    name=schema_data["tables"][table]["name_in_destination"],
                )
            )
        except FQNNotFoundException:
            to_entity_fqn = ""
            from_entity_fqn = ""

        if from_entity_fqn and to_entity_fqn:
            to_table_entity = self.metadata.get_by_name(entity=Table, fqn=to_entity_fqn)
            from_table_entity = self.metadata.get_by_name(
                entity=Table, fqn=from_entity_fqn
            )
            for key, value in col_details.items():
                if value["enabled"] == True:
                    if from_table_entity and to_table_entity:
                        from_col = get_column_fqn(
                            table_entity=from_table_entity, column=key
                        )
                        to_col = get_column_fqn(
                            table_entity=to_table_entity,
                            column=value.get("name_in_destination"),
                        )
                    col_lineage_arr.append(
                        ColumnLineage(
                            toColumn=to_col,
                            fromColumns=[from_col],
                            function=None,
                        )
                    )
        return col_lineage_arr if col_lineage_arr else []

    def yield_pipeline_lineage_details(
        self, pipeline_details: FivetranPipelineDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Parse all the stream available in the connection and create a lineage between them
        :param pipeline_details: pipeline_details object from airbyte
        :return: Lineage from inlets and outlets
        """
        self.client = cast(FivetranClient, self.client)
        source_service = self.metadata.get_by_name(
            entity=DatabaseService, fqn=pipeline_details.source.get("schema")
        )
        if not source_service:
            es_resp: Union[
                List[DatabaseService], None
            ] = self.metadata.es_search_from_fqn(
                DatabaseService, pipeline_details.source.get("schema", "")
            )
            if es_resp and len(es_resp) > 0 and es_resp[0].fullyQualifiedName:
                source_service = self.metadata.get_by_name(
                    entity=DatabaseService,
                    fqn=(es_resp[0].fullyQualifiedName.root),
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
                col_lineage_arr = self.fetch_column_lineage(
                    pipeline_details=pipeline_details,
                    schema=schema,
                    schema_data=schema_data,
                    table=table,
                )

                from_fqn = fqn.build(
                    metadata=self.metadata,
                    entity_type=Table,
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
                pipeline_fqn = fqn.build(
                    metadata=self.metadata,
                    entity_type=Pipeline,
                    service_name=self.context.get().pipeline_service,
                    pipeline_name=self.context.get().pipeline,
                )
                pipeline_entity = self.metadata.get_by_name(
                    entity=Pipeline, fqn=pipeline_fqn
                )
                lineage_details = LineageDetails(
                    pipeline=EntityReference(
                        id=pipeline_entity.id.root, type="pipeline"
                    ),  # type: ignore
                    source=LineageSource.PipelineLineage,
                    columnsLineage=col_lineage_arr if col_lineage_arr else None,
                    sqlQuery=None,
                    description=None,
                )

                yield Either(
                    right=AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(id=from_entity.id, type="table"),  # type: ignore
                            toEntity=EntityReference(id=to_entity.id, type="table"),  # type: ignore
                            lineageDetails=lineage_details,
                        )
                    )
                )  # type: ignore

    def get_pipelines_list(self) -> Iterable[FivetranPipelineDetails]:
        """Get List of all pipelines"""
        for group in self.client.list_groups():
            destination_id: str = group.get("id", "")
            for connector in self.client.list_group_connectors(group_id=destination_id):
                connector_id: str = connector.get("id", "")
                yield FivetranPipelineDetails(
                    destination=self.client.get_destination_details(
                        destination_id=destination_id
                    ),
                    source=self.client.get_connector_details(connector_id=connector_id),
                    group=group,
                    connector_id=connector_id,
                )

    def get_pipeline_name(self, pipeline_details: FivetranPipelineDetails) -> str:
        return pipeline_details.pipeline_display_name or pipeline_details.pipeline_name

    def get_source_url(
        self,
        connector_id: Optional[str],
        group_id: Optional[str],
        source_name: Optional[str],
    ) -> Optional[SourceUrl]:
        try:
            if connector_id and group_id and source_name:
                return SourceUrl(
                    f"https://fivetran.com/dashboard/connectors/{connector_id}/status"
                    f"?groupId={group_id}&service={source_name}"
                )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get source url: {exc}")
        return None
