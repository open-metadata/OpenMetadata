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
KafkaConnect source to extract metadata from OM UI
"""
import traceback
from datetime import datetime
from typing import Iterable, Optional

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.pipeline.kafkaConnectConnection import (
    KafkaConnectConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import EntityName, SourceUrl, Timestamp
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata, T
from metadata.ingestion.source.pipeline.kafkaconnect.models import (
    KafkaConnectPipelineDetails,
)
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.constants import ENTITY_REFERENCE_TYPE_MAP
from metadata.utils.helpers import clean_uri, datetime_to_ts
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

STATUS_MAP = {
    "RUNNING": StatusType.Successful.value,
    "FAILED": StatusType.Failed.value,
    "PAUSED": StatusType.Pending.value,
    "UNASSIGNED": StatusType.Pending.value,
}


class KafkaconnectSource(PipelineServiceSource):
    """
    Implements the necessary methods ot extract
    Pipeline metadata from Kafka Connect
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: KafkaConnectConnection = config.serviceConnection.root.config
        if not isinstance(connection, KafkaConnectConnection):
            raise InvalidSourceException(
                f"Expected KafkaConnectConnection, but got {connection}"
            )
        return cls(config, metadata)

    def yield_pipeline(
        self, pipeline_details: KafkaConnectPipelineDetails
    ) -> Iterable[Either[CreatePipelineRequest]]:
        """
        Method to Get Pipeline Entity
        """
        try:
            connection_url = SourceUrl(f"{clean_uri(self.service_connection.hostPort)}")

            pipeline_request = CreatePipelineRequest(
                name=EntityName(pipeline_details.name),
                sourceUrl=connection_url,
                tasks=[
                    Task(
                        name=task.id,
                    )
                    for task in pipeline_details.tasks or []
                ],
                service=self.context.get().pipeline_service,
            )
            yield Either(right=pipeline_request)
            self.register_record(pipeline_request=pipeline_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.name,
                    error=f"Wild error ingesting pipeline {pipeline_details} - {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_dataset_entity(
        self, pipeline_details: KafkaConnectPipelineDetails
    ) -> Optional[T]:
        """
        Get lineage dataset entity
        """
        try:
            dataset_details = self.client.get_connector_dataset_info(
                connector=pipeline_details.name
            )
            if dataset_details:
                if (
                    isinstance(dataset_details.dataset_type, type(Table))
                    and self.source_config.lineageInformation.dbServiceNames
                ):
                    for dbservicename in (
                        self.source_config.lineageInformation.dbServiceNames or []
                    ):
                        dataset_entity = self.metadata.get_by_name(
                            entity=dataset_details.dataset_type,
                            fqn=fqn.build(
                                metadata=self.metadata,
                                entity_type=dataset_details.dataset_type,
                                table_name=dataset_details.table,
                                database_name=None,
                                schema_name=dataset_details.database,
                                service_name=dbservicename,
                            ),
                        )

                        if dataset_entity:
                            return dataset_entity

                if (
                    isinstance(dataset_details.dataset_type, type(Container))
                    and self.source_config.lineageInformation.storageServiceNames
                ):
                    for storageservicename in (
                        self.source_config.lineageInformation.storageServiceNames or []
                    ):
                        dataset_entity = self.metadata.get_by_name(
                            entity=dataset_details.dataset_type,
                            fqn=fqn.build(
                                metadata=self.metadata,
                                entity_type=dataset_details.dataset_type,
                                container_name=dataset_details.container_name,
                                service_name=storageservicename,
                            ),
                        )

                        if dataset_entity:
                            return dataset_entity

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get dataset entity {exc}")

        return None

    def yield_pipeline_lineage_details(
        self, pipeline_details: KafkaConnectPipelineDetails
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Get lineage between pipeline and data sources
        """
        try:
            if not self.service_connection.messagingServiceName:
                logger.debug("Kafka messagingServiceName not found")
                return None

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
                pipeline=EntityReference(id=pipeline_entity.id.root, type="pipeline"),
                source=LineageSource.PipelineLineage,
            )

            dataset_entity = self.get_dataset_entity(pipeline_details=pipeline_details)

            for topic in pipeline_details.topics or []:
                topic_fqn = fqn.build(
                    metadata=self.metadata,
                    entity_type=Topic,
                    service_name=self.service_connection.messagingServiceName,
                    topic_name=topic.name,
                )

                topic_entity = self.metadata.get_by_name(entity=Topic, fqn=topic_fqn)

                if topic_entity is None or dataset_entity is None:
                    continue

                if pipeline_details.conn_type.lower() == "sink":
                    from_entity, to_entity = topic_entity, dataset_entity
                else:
                    from_entity, to_entity = dataset_entity, topic_entity

                yield Either(
                    right=AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=from_entity.id,
                                type=ENTITY_REFERENCE_TYPE_MAP[
                                    type(from_entity).__name__
                                ],
                            ),
                            toEntity=EntityReference(
                                id=to_entity.id,
                                type=ENTITY_REFERENCE_TYPE_MAP[
                                    type(to_entity).__name__
                                ],
                            ),
                            lineageDetails=lineage_details,
                        )
                    )
                )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.name,
                    error=f"Wild error ingesting pipeline lineage {pipeline_details} - {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

        return None

    def get_pipelines_list(self) -> Iterable[KafkaConnectPipelineDetails]:
        """
        Get List of all pipelines
        """
        try:
            yield from self.client.get_connector_list()
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to get pipeline list due to : {exc}")

    def get_pipeline_name(self, pipeline_details: KafkaConnectPipelineDetails) -> str:
        """
        Get Pipeline Name
        """
        try:
            return pipeline_details.name
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to get pipeline name to : {exc}")

        return None

    def yield_pipeline_status(
        self, pipeline_details: KafkaConnectPipelineDetails
    ) -> Iterable[Either[OMetaPipelineStatus]]:
        """
        Get Pipeline Status
        """
        try:
            task_status = [
                TaskStatus(
                    name=task.id,
                    executionStatus=STATUS_MAP.get(task.state, StatusType.Pending),
                )
                for task in pipeline_details.tasks or []
            ]

            pipeline_status = PipelineStatus(
                executionStatus=STATUS_MAP.get(
                    pipeline_details.status, StatusType.Pending
                ),
                taskStatus=task_status,
                timestamp=Timestamp(datetime_to_ts(datetime.now()))
                # Kafka connect doesn't provide any details with exec time
            )

            pipeline_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Pipeline,
                service_name=self.context.get().pipeline_service,
                pipeline_name=self.context.get().pipeline,
            )
            yield Either(
                right=OMetaPipelineStatus(
                    pipeline_fqn=pipeline_fqn,
                    pipeline_status=pipeline_status,
                )
            )

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.name,
                    error=f"Wild error ingesting pipeline status {pipeline_details} - {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
