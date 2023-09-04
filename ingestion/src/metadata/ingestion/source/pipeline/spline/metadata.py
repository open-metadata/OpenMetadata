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
Spline source to extract metadata
"""
import traceback
from typing import Iterable, Optional

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import Task
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.splineConnection import (
    SplineConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.ingestion.source.pipeline.spline.models import ExecutionEvent
from metadata.ingestion.source.pipeline.spline.utils import (
    parse_dbfs_path,
    parse_jdbc_url,
)
from metadata.utils import fqn
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SplineSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Airflow's metadata db
    """

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: SplineConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, SplineConnection):
            raise InvalidSourceException(
                f"Expected SplineConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_connections_jobs(
        self, pipeline_details: ExecutionEvent, connection_url: str
    ):
        """
        Returns the list of tasks linked to connection
        """
        return [
            Task(
                name=pipeline_details.executionEventId,
                displayName=pipeline_details.applicationName,
                sourceUrl=connection_url,
            )
        ]

    def yield_pipeline(
        self, pipeline_details: ExecutionEvent
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """
        Convert a Connection into a Pipeline Entity
        :param pipeline_details: pipeline_details object from airbyte
        :return: Create Pipeline request with tasks
        """
        connection_url = None
        if self.service_connection.uiHostPort:
            connection_url = (
                f"{clean_uri(self.service_connection.uiHostPort)}/app/events/"
                f"overview/{pipeline_details.executionEventId}"
            )
        pipeline_request = CreatePipelineRequest(
            name=pipeline_details.executionEventId,
            displayName=pipeline_details.applicationName,
            sourceUrl=connection_url,
            tasks=self.get_connections_jobs(pipeline_details, connection_url),
            service=self.context.pipeline_service.fullyQualifiedName.__root__,
        )
        yield Either(right=pipeline_request)
        self.register_record(pipeline_request=pipeline_request)

    def yield_pipeline_status(
        self, pipeline_details: ExecutionEvent
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """pipeline status not supported for spline connector"""

    def _get_table_entity(
        self, database_name: str, schema_name: str, table_name: str
    ) -> Optional[Table]:
        if not table_name:
            return None
        for service_name in self.source_config.dbServiceNames:
            table_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Table,
                table_name=table_name,
                service_name=service_name,
                schema_name=schema_name,
                database_name=database_name,
            )
            if table_fqn:
                table_entity: Table = self.metadata.get_by_name(
                    entity=Table, fqn=table_fqn
                )
                if table_entity:
                    return table_entity
        return None

    def _get_table_from_datasource_name(self, datasource: str) -> Optional[Table]:

        if (
            not datasource
            and not datasource.startswith("dbfs")
            and not datasource.startswith("jdbc")
        ):
            return None

        try:
            schema_name = None
            database_name = None
            table_name = None

            if datasource.startswith("dbfs") and "/" in datasource:
                table_name = parse_dbfs_path(datasource)

            if datasource.startswith("jdbc"):
                database_name, schema_name, table_name = parse_jdbc_url(datasource)

            return self._get_table_entity(database_name, schema_name, table_name)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"failed to parse datasource details due to: {exc}")

        return None

    def yield_pipeline_lineage_details(
        self, pipeline_details: ExecutionEvent
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Parse all the executions available and create lineage
        """
        if not self.source_config.dbServiceNames:
            return
        lineage_details = self.client.get_lineage_details(
            pipeline_details.executionPlanId
        )
        if (
            lineage_details
            and lineage_details.executionPlan
            and lineage_details.executionPlan.inputs
            and lineage_details.executionPlan.output
        ):
            from_entities = lineage_details.executionPlan.inputs
            to_entity = lineage_details.executionPlan.output

            for from_entity in from_entities:
                from_table = (
                    self._get_table_from_datasource_name(from_entity.source)
                    if from_entity
                    else None
                )
                to_table = (
                    self._get_table_from_datasource_name(to_entity.source)
                    if to_entity
                    else None
                )
                if from_table and to_table:
                    yield Either(
                        right=AddLineageRequest(
                            edge=EntitiesEdge(
                                lineageDetails=LineageDetails(
                                    pipeline=EntityReference(
                                        id=self.context.pipeline.id.__root__,
                                        type="pipeline",
                                    ),
                                    source=LineageSource.PipelineLineage,
                                ),
                                fromEntity=EntityReference(
                                    id=from_table.id, type="table"
                                ),
                                toEntity=EntityReference(id=to_table.id, type="table"),
                            )
                        )
                    )

    def get_pipelines_list(self) -> Iterable[ExecutionEvent]:
        for pipelines in self.client.get_pipelines() or []:
            for pipeline in pipelines.items or []:
                yield pipeline

    def get_pipeline_name(self, pipeline_details: ExecutionEvent) -> str:
        return pipeline_details.applicationName
