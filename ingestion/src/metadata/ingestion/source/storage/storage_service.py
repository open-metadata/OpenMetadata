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
Base class for ingesting Object Storage services
"""
from abc import ABC, abstractmethod
from typing import Any, Iterable, List, Optional, Set

from pydantic import Field
from typing_extensions import Annotated

from metadata.generated.schema.api.data.createContainer import CreateContainerRequest
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.services.storageService import (
    StorageConnection,
    StorageService,
)
from metadata.generated.schema.metadataIngestion.storage.containerMetadataConfig import (
    MetadataEntry,
)
from metadata.generated.schema.metadataIngestion.storage.manifestMetadataConfig import (
    ManifestMetadataConfig,
)
from metadata.generated.schema.metadataIngestion.storageServiceMetadataPipeline import (
    NoMetadataConfigurationSource,
    StorageServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.delete import delete_entity_from_source
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import Source
from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.delete_entity import DeleteEntity
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.topology import (
    NodeStage,
    ServiceTopology,
    TopologyContextManager,
    TopologyNode,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection, test_connection_common
from metadata.ingestion.source.database.glue.models import Column
from metadata.readers.dataframe.models import DatalakeTableSchemaWrapper
from metadata.readers.dataframe.reader_factory import SupportedTypes
from metadata.readers.models import ConfigSource
from metadata.utils import fqn
from metadata.utils.datalake.datalake_utils import (
    DataFrameColumnParser,
    fetch_dataframe,
)
from metadata.utils.helpers import retry_with_docker_host
from metadata.utils.logger import ingestion_logger
from metadata.utils.storage_metadata_config import (
    StorageMetadataConfigException,
    get_manifest,
)

logger = ingestion_logger()

KEY_SEPARATOR = "/"
OPENMETADATA_TEMPLATE_FILE_NAME = "openmetadata.json"


class StorageServiceTopology(ServiceTopology):
    """
    Defines the hierarchy in Messaging Services.
    service -> container -> container -> container...
    """

    root: Annotated[
        TopologyNode, Field(description="Root node for the topology")
    ] = TopologyNode(
        producer="get_services",
        stages=[
            NodeStage(
                type_=StorageService,
                context="objectstore_service",
                processor="yield_create_request_objectstore_service",
                overwrite=False,
                must_return=True,
                cache_entities=True,
            ),
        ],
        children=["container"],
        post_process=["mark_containers_as_deleted"],
    )

    container: Annotated[
        TopologyNode, Field(description="Container Processing Node")
    ] = TopologyNode(
        producer="get_containers",
        stages=[
            NodeStage(
                type_=OMetaTagAndClassification,
                context="tags",
                processor="yield_tag_details",
                nullable=True,
                store_all_in_context=True,
            ),
            NodeStage(
                type_=Container,
                context="container",
                processor="yield_create_container_requests",
                consumer=["objectstore_service"],
                nullable=True,
                use_cache=True,
            ),
        ],
    )


class StorageServiceSource(TopologyRunnerMixin, Source, ABC):
    """
    Base class for Object Store Services.
    It implements the topology and context.
    """

    source_config: StorageServiceMetadataPipeline
    config: WorkflowSource
    metadata: OpenMetadata
    # Big union of types we want to fetch dynamically
    service_connection: StorageConnection.model_fields["config"].annotation

    topology = StorageServiceTopology()
    context = TopologyContextManager(topology)
    container_source_state: Set = set()

    global_manifest: Optional[ManifestMetadataConfig]

    @retry_with_docker_host()
    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.root.config
        self.source_config: StorageServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.connection = get_connection(self.service_connection)

        # Flag the connection for the test connection
        self.connection_obj = self.connection
        self.test_connection()

        # Try to get the global manifest
        self.global_manifest: Optional[
            ManifestMetadataConfig
        ] = self.get_manifest_file()

    @property
    def name(self) -> str:
        return self.service_connection.type.name

    def get_manifest_file(self) -> Optional[ManifestMetadataConfig]:
        if self.source_config.storageMetadataConfigSource and not isinstance(
            self.source_config.storageMetadataConfigSource,
            NoMetadataConfigurationSource,
        ):
            try:
                return get_manifest(self.source_config.storageMetadataConfigSource)
            except StorageMetadataConfigException as exc:
                logger.warning(f"Could no get global manifest due to [{exc}]")
        return None

    @abstractmethod
    def get_containers(self) -> Iterable[Any]:
        """
        Retrieve all containers for the service
        """

    @abstractmethod
    def yield_create_container_requests(
        self, container_details: Any
    ) -> Iterable[Either[CreateContainerRequest]]:
        """Generate the create container requests based on the received details"""

    def close(self):
        """By default, nothing needs to be closed"""

    def get_services(self) -> Iterable[WorkflowSource]:
        yield self.config

    def prepare(self):
        """By default, nothing needs to be taken care of when loading the source"""

    def yield_container_tags(
        self, container_details: Any
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each container
        """

    def yield_tag_details(
        self, container_details: Any
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each container
        """
        if self.source_config.includeTags:
            yield from self.yield_container_tags(container_details) or []

    def register_record(self, container_request: CreateContainerRequest) -> None:
        """
        Mark the container record as scanned and update
        the storage_source_state
        """
        parent_container = (
            self.metadata.get_by_id(
                entity=Container, entity_id=container_request.parent.id
            ).fullyQualifiedName.root
            if container_request.parent
            else None
        )
        container_fqn = fqn.build(
            self.metadata,
            entity_type=Container,
            service_name=self.context.get().objectstore_service,
            parent_container=parent_container,
            container_name=fqn.quote_name(container_request.name.root),
        )

        self.container_source_state.add(container_fqn)

    def test_connection(self) -> None:
        test_connection_common(
            self.metadata, self.connection_obj, self.service_connection
        )

    def mark_containers_as_deleted(self) -> Iterable[Either[DeleteEntity]]:
        """Method to mark the containers as deleted"""
        if self.source_config.markDeletedContainers:
            yield from delete_entity_from_source(
                metadata=self.metadata,
                entity_type=Container,
                entity_source_state=self.container_source_state,
                mark_deleted_entity=self.source_config.markDeletedContainers,
                params={"service": self.context.get().objectstore_service},
            )

    def yield_create_request_objectstore_service(self, config: WorkflowSource):
        yield Either(
            right=self.metadata.get_create_service_from_source(
                entity=StorageService, config=config
            )
        )

    @staticmethod
    def _manifest_entries_to_metadata_entries_by_container(
        container_name: str, manifest: ManifestMetadataConfig
    ) -> List[MetadataEntry]:
        """
        Convert manifest entries (which have an extra bucket property) to bucket-level metadata entries, filtered by
        a given bucket
        """
        return [
            MetadataEntry(
                dataPath=entry.dataPath,
                structureFormat=entry.structureFormat,
                isPartitioned=entry.isPartitioned,
                partitionColumns=entry.partitionColumns,
                separator=entry.separator,
            )
            for entry in manifest.entries
            if entry.containerName == container_name
        ]

    @staticmethod
    def _get_sample_file_prefix(metadata_entry: MetadataEntry) -> Optional[str]:
        """
        Return a prefix if we have structure data to read
        """
        # Adding the ending separator so that we only read files from the right directory, for example:
        # if we have files in `transactions/*` and `transactions_old/*`, only passing the prefix as
        # `transactions` would list files for both directories. We need the prefix to be `transactions/`.
        result = f"{metadata_entry.dataPath.strip(KEY_SEPARATOR)}{KEY_SEPARATOR}"
        if not metadata_entry.structureFormat:
            logger.warning(f"Ignoring un-structured metadata entry {result}")
            return None
        return result

    @staticmethod
    def extract_column_definitions(
        bucket_name: str,
        sample_key: str,
        config_source: ConfigSource,
        client: Any,
        metadata_entry: MetadataEntry,
    ) -> List[Column]:
        """Extract Column related metadata from s3"""
        data_structure_details, raw_data = fetch_dataframe(
            config_source=config_source,
            client=client,
            file_fqn=DatalakeTableSchemaWrapper(
                key=sample_key,
                bucket_name=bucket_name,
                file_extension=SupportedTypes(metadata_entry.structureFormat),
                separator=metadata_entry.separator,
            ),
            fetch_raw_data=True,
        )
        columns = []
        column_parser = DataFrameColumnParser.create(
            data_structure_details,
            SupportedTypes(metadata_entry.structureFormat),
            raw_data=raw_data,
        )
        columns = column_parser.get_columns()
        return columns

    def _get_columns(
        self,
        container_name: str,
        sample_key: str,
        metadata_entry: MetadataEntry,
        config_source: ConfigSource,
        client: Any,
    ) -> Optional[List[Column]]:
        """Get the columns from the file and partition information"""
        extracted_cols = self.extract_column_definitions(
            container_name, sample_key, config_source, client, metadata_entry
        )
        return (metadata_entry.partitionColumns or []) + (extracted_cols or [])
