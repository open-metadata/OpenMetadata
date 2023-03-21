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
Base class for ingesting database services
"""
from abc import ABC, abstractmethod
from typing import Any, Iterable, List, Optional, Set

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
)
from metadata.generated.schema.metadataIngestion.pipelineServiceMetadataPipeline import (
    PipelineServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import Source
from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.delete_entity import (
    DeleteEntity,
    delete_entity_from_source,
)
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.models.topology import (
    NodeStage,
    ServiceTopology,
    TopologyNode,
    create_source_context,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection, get_test_connection_fn
from metadata.utils import fqn
from metadata.utils.filters import filter_by_pipeline
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class PipelineServiceTopology(ServiceTopology):
    """
    Defines the hierarchy in Pipeline Services.

    We could have a topology validator. We can only consume
    data that has been produced by any parent node.
    """

    root = TopologyNode(
        producer="get_services",
        stages=[
            NodeStage(
                type_=PipelineService,
                context="pipeline_service",
                processor="yield_create_request_pipeline_service",
                overwrite=False,
                must_return=True,
            ),
        ],
        children=["pipeline"],
        post_process=["mark_pipelines_as_deleted"],
    )
    pipeline = TopologyNode(
        producer="get_pipeline",
        stages=[
            NodeStage(
                type_=OMetaTagAndClassification,
                context="tags",
                processor="yield_tag",
                ack_sink=False,
                nullable=True,
            ),
            NodeStage(
                type_=Pipeline,
                context="pipeline",
                processor="yield_pipeline",
                consumer=["pipeline_service"],
            ),
            NodeStage(
                type_=OMetaPipelineStatus,
                context="pipeline_status",
                processor="yield_pipeline_status",
                consumer=["pipeline_service"],
                nullable=True,
                ack_sink=False,
            ),
            NodeStage(
                type_=AddLineageRequest,
                context="lineage",
                processor="yield_pipeline_lineage",
                consumer=["pipeline_service"],
                ack_sink=False,
                nullable=True,
            ),
        ],
    )


class PipelineServiceSource(TopologyRunnerMixin, Source, ABC):
    """
    Base class for Pipeline Services.
    It implements the topology and context.
    """

    source_config: PipelineServiceMetadataPipeline
    config: WorkflowSource
    metadata: OpenMetadata
    # Big union of types we want to fetch dynamically
    service_connection: PipelineConnection.__fields__["config"].type_

    topology = PipelineServiceTopology()
    context = create_source_context(topology)
    pipeline_source_state: Set = set()

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__()
        self.config = config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.service_connection = self.config.serviceConnection.__root__.config
        self.source_config: PipelineServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.connection = get_connection(self.service_connection)
        self.client = self.connection
        self.test_connection()

    @abstractmethod
    def yield_pipeline(self, pipeline_details: Any) -> Iterable[CreatePipelineRequest]:
        """
        Method to Get Pipeline Entity
        """

    @abstractmethod
    def yield_pipeline_lineage_details(
        self, pipeline_details: Any
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Get lineage between pipeline and data sources
        """

    @abstractmethod
    def get_pipelines_list(self) -> Optional[List[Any]]:
        """
        Get List of all pipelines
        """

    @abstractmethod
    def get_pipeline_name(self, pipeline_details: Any) -> str:
        """
        Get Pipeline Name
        """

    @abstractmethod
    def yield_pipeline_status(
        self, pipeline_details: Any
    ) -> Optional[OMetaPipelineStatus]:
        """
        Get Pipeline Status
        """

    def yield_pipeline_lineage(
        self, pipeline_details: Any
    ) -> Iterable[AddLineageRequest]:
        """
        Yields lineage if config is enabled
        """
        if self.source_config.includeLineage:
            yield from self.yield_pipeline_lineage_details(pipeline_details) or []

    def yield_tag(
        self, *args, **kwargs  # pylint: disable=W0613
    ) -> Optional[Iterable[OMetaTagAndClassification]]:
        """
        Method to fetch pipeline tags
        """
        return  # Pipeline does not support fetching tags except Dagster

    def close(self):
        """
        Method to implement any required logic after the ingestion process is completed
        """

    def get_services(self) -> Iterable[WorkflowSource]:
        yield self.config

    def yield_create_request_pipeline_service(self, config: WorkflowSource):
        yield self.metadata.get_create_service_from_source(
            entity=PipelineService, config=config
        )

    def get_pipeline(self) -> Any:
        for pipeline_detail in self.get_pipelines_list():
            pipeline_name = self.get_pipeline_name(pipeline_detail)
            if filter_by_pipeline(
                self.source_config.pipelineFilterPattern,
                pipeline_name,
            ):
                self.status.filter(
                    pipeline_name,
                    "Pipeline Filtered Out",
                )
                continue
            yield pipeline_detail

    def test_connection(self) -> None:
        test_connection_fn = get_test_connection_fn(self.service_connection)
        test_connection_fn(self.connection, self.service_connection)

    def register_record(self, pipeline_request: CreatePipelineRequest) -> None:
        """
        Mark the pipeline record as scanned and update the pipeline_source_state
        """
        pipeline_fqn = fqn.build(
            self.metadata,
            entity_type=Pipeline,
            service_name=pipeline_request.service.__root__,
            pipeline_name=pipeline_request.name.__root__,
        )

        self.pipeline_source_state.add(pipeline_fqn)
        self.status.scanned(pipeline_fqn)

    def mark_pipelines_as_deleted(self) -> Iterable[DeleteEntity]:
        """
        Method to mark the pipelines as deleted
        """
        if self.source_config.markDeletedPipelines:
            yield from delete_entity_from_source(
                metadata=self.metadata,
                entity_type=Pipeline,
                entity_source_state=self.pipeline_source_state,
                mark_deleted_entity=self.source_config.markDeletedPipelines,
                params={
                    "service": self.context.pipeline_service.fullyQualifiedName.__root__
                },
            )

    def prepare(self):
        """
        Method to implement any required logic before starting the ingestion process
        """
