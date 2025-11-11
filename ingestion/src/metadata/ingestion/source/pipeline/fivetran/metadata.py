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
Fivetran source to extract metadata
"""

import traceback
from typing import Iterable, List, Optional, cast

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import Pipeline, Task
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.pipeline.fivetranConnection import (
    FivetranConnection,
)
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
        self,
        pipeline_details: FivetranPipelineDetails,
        schema_name: str,
        schema_data: dict,
        table_name: str,
        from_table_entity: Table,
        to_table_entity: Table,
    ) -> List[Optional[ColumnLineage]]:
        """
        Fetch column-level lineage between source and destination tables in a Fivetran connector.

        This method retrieves column mappings from Fivetran and creates ColumnLineage objects
        for each enabled column transformation, mapping source columns to their corresponding
        destination columns.

        :param pipeline_details: FivetranPipelineDetails containing connector information
        :param schema_name: Name of the source schema
        :param schema_data: Dictionary containing schema configuration data
        :param table_name: Name of the source table
        :param from_table_entity: Source Table entity from OpenMetadata
        :param to_table_entity: Destination Table entity from OpenMetadata
        :return: List of ColumnLineage objects representing column-to-column mappings, empty list if none found
        """
        pipeline_name = self.get_pipeline_name(pipeline_details)

        col_lineage_arr = []
        for column_name, column_data in self.client.get_connector_column_lineage(
            pipeline_details.connector_id,
            schema_name=schema_name,
            table_name=table_name,
        ).items():
            if not column_data.get("enabled"):
                logger.debug(
                    f"Skipping column [{schema_name}.{table_name}.{column_name}] for pipeline"
                    f" [{pipeline_name}] lineage - column is disabled"
                )
                continue

            from_col = get_column_fqn(
                table_entity=from_table_entity, column=column_name
            )
            to_col = get_column_fqn(
                table_entity=to_table_entity,
                column=column_data.get("name_in_destination"),
            )
            col_lineage_arr.append(
                ColumnLineage(
                    fromColumns=[from_col],
                    toColumn=to_col,
                    function=None,
                )
            )

        return col_lineage_arr if col_lineage_arr else []

    def yield_pipeline_lineage_details(
        self, pipeline_details: FivetranPipelineDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Parse all the stream available in the connection and create a lineage between them
        :param pipeline_details: pipeline_details object from fivetran
        :return: Lineage from inlets and outlets
        """
        self.client = cast(FivetranClient, self.client)
        pipeline_name = self.get_pipeline_name(pipeline_details)

        source_database_name = pipeline_details.source.get("config", {}).get("database")
        destination_database_name = pipeline_details.destination.get("config", {}).get(
            "database"
        )

        for schema_name, schema_data in self.client.get_connector_schema_details(
            connector_id=pipeline_details.source.get("id")
        ).items():
            if not schema_data.get("enabled"):
                logger.debug(
                    f"Skipping schema [{schema_name}] for pipeline [{pipeline_name}] lineage"
                    " - schema is disabled"
                )
                continue

            source_schema_name = schema_name
            destination_schema_name = schema_data.get("name_in_destination")

            for table_name, table_data in schema_data.get("tables", {}).items():
                if not table_data.get("enabled"):
                    logger.debug(
                        f"Skipping table [{schema_name}].[{table_name}] for pipeline [{pipeline_name}]"
                        " lineage - table is disabled"
                    )
                    continue

                source_table_name = table_name
                destination_table_name = table_data.get("name_in_destination")

                from_fqn = None
                from_entity = None
                for db_service_name in self.get_db_service_names() or "*":
                    from_fqn = fqn.build(
                        metadata=self.metadata,
                        entity_type=Table,
                        table_name=source_table_name,
                        database_name=source_database_name,
                        schema_name=source_schema_name,
                        service_name=db_service_name,
                    )
                    from_entity = self.metadata.get_by_name(entity=Table, fqn=from_fqn)
                    if from_entity:
                        break

                if not from_entity:
                    logger.debug(
                        f"Lineage skipped for pipeline [{pipeline_name}]"
                        f" since source table [{from_fqn}] not found."
                    )
                    continue

                to_fqn = None
                to_entity = None
                for db_service_name in self.get_db_service_names() or "*":
                    to_fqn = fqn.build(
                        self.metadata,
                        Table,
                        table_name=destination_table_name,
                        database_name=destination_database_name,
                        schema_name=destination_schema_name,
                        service_name=db_service_name,
                    )
                    to_entity = self.metadata.get_by_name(entity=Table, fqn=to_fqn)
                    if to_entity:
                        break

                if not to_entity:
                    logger.debug(
                        f"Lineage skipped for pipeline [{pipeline_name}]"
                        f" since destination table [{to_fqn}] not found."
                    )
                    continue

                col_lineage_arr = self.fetch_column_lineage(
                    pipeline_details=pipeline_details,
                    schema_name=schema_name,
                    schema_data=schema_data,
                    table_name=table_name,
                    from_table_entity=from_entity,
                    to_table_entity=to_entity,
                )

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
