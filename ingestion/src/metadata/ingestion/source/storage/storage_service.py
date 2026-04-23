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
import json
from abc import ABC, abstractmethod
from typing import Any, Iterable, List, Optional, Set, Tuple

from pydantic import Field
from typing_extensions import Annotated

from metadata.generated.schema.api.data.createContainer import CreateContainerRequest
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.table import Column as TableColumn
from metadata.generated.schema.entity.data.table import ColumnName
from metadata.generated.schema.entity.services.storageService import (
    StorageConnection,
    StorageService,
)
from metadata.generated.schema.metadataIngestion.storage.containerMetadataConfig import (
    MetadataEntry,
    PartitionColumn,
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
    fetch_dataframe_first_chunk,
)
from metadata.utils.helpers import retry_with_docker_host
from metadata.utils.logger import ingestion_logger
from metadata.utils.path_pattern import (
    detect_hive_partitions,
    extract_static_prefix,
    group_files_by_table,
    infer_structure_format,
    pattern_to_regex,
)
from metadata.utils.storage_metadata_config import (
    StorageMetadataConfigException,
    get_manifest,
)
from metadata.utils.storage_utils import DEFAULT_EXCLUDE_SEGMENTS

logger = ingestion_logger()

KEY_SEPARATOR = "/"
OPENMETADATA_TEMPLATE_FILE_NAME = "openmetadata.json"

# Safety limit for the number of keys scanned per glob entry.
MAX_KEYS_PER_GLOB = 100_000

# Re-export for backwards compatibility with tests that import from here.
DEFAULT_EXCLUDE_PATHS = DEFAULT_EXCLUDE_SEGMENTS

_GLOB_CHARS = ("*", "?")


def has_glob(path: str) -> bool:
    """Return True if path contains a supported glob wildcard (``*``,
    ``**``, or ``?``). Bracket character classes (``[abc]``) are not
    implemented by ``pattern_to_regex`` and are treated as literal
    characters so paths containing ``[`` aren't misclassified as globs.
    """
    return any(c in path for c in _GLOB_CHARS)


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
                logger.warning(f"Could not get global manifest due to [{exc}]")
        return None

    def _load_metadata_file(self, bucket_name: str):  # pylint: disable=unused-argument
        """Load the per-bucket openmetadata.json manifest.

        Override per provider (S3/GCS/Azure). Default returns None so the
        resolution logic falls back to the next source.
        """
        return None

    def _parsed_default_manifest(self) -> Optional[ManifestMetadataConfig]:
        """Parse the ``defaultManifest`` JSON string from the pipeline
        config. Cached on first use; returns ``None`` if unset or invalid.

        Errors are distinguished so users know why the fallback didn't apply:

        - Empty / not set → silently None
        - JSON syntax error → WARNING with line/column
        - Schema validation error → WARNING with per-field details
        """
        if hasattr(self, "_default_manifest_cache"):
            return self._default_manifest_cache

        raw = getattr(self.source_config, "defaultManifest", None)
        parsed: Optional[ManifestMetadataConfig] = None
        if raw and isinstance(raw, str) and raw.strip():
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError as exc:
                msg = (
                    f"defaultManifest is not valid JSON "
                    f"(line {exc.lineno}, column {exc.colno}): {exc.msg}. "
                    f"Fallback manifest will be ignored."
                )
                logger.warning(msg)
                if hasattr(self, "status") and hasattr(self.status, "warning"):
                    self.status.warning("defaultManifest", msg)
                payload = None

            if payload is not None:
                try:
                    parsed = ManifestMetadataConfig.model_validate(payload)
                except ValueError as exc:
                    # Pydantic ValidationError subclasses ValueError in v2.
                    details = str(exc).replace("\n", " | ")
                    msg = (
                        f"defaultManifest JSON does not match the expected "
                        f"manifest schema: {details}. Fallback manifest "
                        f"will be ignored."
                    )
                    logger.warning(msg)
                    if hasattr(self, "status") and hasattr(self.status, "warning"):
                        self.status.warning("defaultManifest", msg)

        self._default_manifest_cache = parsed
        return parsed

    def _resolve_manifest_entries(self, bucket_name: str) -> List[MetadataEntry]:
        """Resolve manifest entries for a bucket using this precedence:

        1. Global manifest (``storageMetadataConfigSource``), filtered to
           entries whose ``containerName`` matches this bucket.
        2. The bucket's own ``openmetadata.json`` file, if present.
        3. The pipeline config's ``defaultManifest`` (fallback), filtered
           to entries matching this bucket.

        Returns an empty list if no source yields entries.
        """
        if self.global_manifest:
            entries = self._manifest_entries_to_metadata_entries_by_container(
                container_name=bucket_name, manifest=self.global_manifest
            )
            if entries:
                return entries

        bucket_config = self._load_metadata_file(bucket_name=bucket_name)
        if bucket_config and bucket_config.entries:
            return list(bucket_config.entries)

        default_manifest = self._parsed_default_manifest()
        if default_manifest and default_manifest.entries:
            entries = self._manifest_entries_to_metadata_entries_by_container(
                container_name=bucket_name, manifest=default_manifest
            )
            if entries:
                logger.info(
                    f"Using defaultManifest from pipeline config for bucket "
                    f"'{bucket_name}' (no bucket manifest file found)."
                )
                return entries

        return []

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
        a given bucket. Wildcard-related fields are preserved so downstream
        glob expansion can use them.
        """
        return [
            MetadataEntry(
                dataPath=entry.dataPath,
                structureFormat=entry.structureFormat,
                isPartitioned=entry.isPartitioned,
                partitionColumns=(
                    [pc.model_dump() for pc in entry.partitionColumns]
                    if entry.partitionColumns
                    else None
                ),
                separator=entry.separator,
                depth=entry.depth,
                unstructuredFormats=entry.unstructuredFormats,
                unstructuredData=entry.unstructuredData,
                autoPartitionDetection=entry.autoPartitionDetection,
                excludePaths=entry.excludePaths,
                excludePatterns=entry.excludePatterns,
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
        session: Any = None,
    ) -> List[Column]:
        """Extract Column related metadata from s3"""
        data_structure_details, raw_data = fetch_dataframe_first_chunk(
            config_source=config_source,
            client=client,
            file_fqn=DatalakeTableSchemaWrapper(
                key=sample_key,
                bucket_name=bucket_name,
                file_extension=SupportedTypes(metadata_entry.structureFormat),
                separator=metadata_entry.separator,
            ),
            fetch_raw_data=True,
            session=session,
        )
        if data_structure_details:
            data_structure_details = next(data_structure_details)
            column_parser = DataFrameColumnParser.create(
                data_structure_details,
                SupportedTypes(metadata_entry.structureFormat),
                raw_data=raw_data,
            )
            return column_parser.get_columns()
        return []

    @staticmethod
    def _partition_columns_to_table_columns(
        partition_columns: Optional[List[PartitionColumn]],
    ) -> List[TableColumn]:
        """Convert lightweight manifest PartitionColumn entries into full
        table Column objects expected by ContainerDataModel."""
        if not partition_columns:
            return []
        return [
            TableColumn(
                name=ColumnName(pc.name),
                dataType=pc.dataType,
                dataTypeDisplay=pc.dataTypeDisplay,
                description=pc.description,
            )
            for pc in partition_columns
        ]

    def _get_columns(
        self,
        container_name: str,
        sample_key: str,
        metadata_entry: MetadataEntry,
        config_source: ConfigSource,
        client: Any,
        session: Any = None,
    ) -> Optional[List[Column]]:
        """Get the columns from the file and partition information"""
        extracted_cols = self.extract_column_definitions(
            container_name,
            sample_key,
            config_source,
            client,
            metadata_entry,
            session,
        )
        partition_cols = self._partition_columns_to_table_columns(
            metadata_entry.partitionColumns
        )
        return partition_cols + (extracted_cols or [])

    def list_keys(self, bucket_name: str, prefix: str) -> Iterable[Tuple[str, int]]:
        """List (key, size_bytes) pairs for files under prefix.

        Must be overridden by each provider to enable glob-style
        ``dataPath`` expansion. Currently implemented for **S3 only**.
        GCS and Azure support are tracked as follow-ups — until then,
        glob patterns on those providers will log a warning and match
        nothing (literal paths still work).

        Returns an empty iterable by default so providers that have
        not yet implemented listing degrade gracefully.
        """
        return []

    def expand_entry(
        self, bucket_name: str, entry: MetadataEntry
    ) -> Iterable[MetadataEntry]:
        """Expand a manifest entry whose dataPath is a glob pattern into
        one or more concrete MetadataEntry objects (one per matched logical
        table, or one per matched file when unstructuredData is true).

        Literal-path entries pass through unchanged, so existing manifests
        keep working exactly as before.
        """
        if not has_glob(entry.dataPath):
            yield entry
            return

        pattern = entry.dataPath
        static_prefix = extract_static_prefix(pattern)
        compiled_regex = pattern_to_regex(pattern)
        exclude_paths = (
            set(entry.excludePaths)
            if entry.excludePaths is not None
            else DEFAULT_EXCLUDE_PATHS
        )
        exclude_regexes = [pattern_to_regex(ep) for ep in (entry.excludePatterns or [])]

        matched: List[Tuple[str, int]] = []
        scanned = 0
        for key, size in self.list_keys(bucket_name, static_prefix):
            scanned += 1
            if scanned > MAX_KEYS_PER_GLOB:
                logger.warning(
                    f"Glob '{pattern}' scanned {MAX_KEYS_PER_GLOB:,} keys in "
                    f"bucket '{bucket_name}' without completing. Stopping to "
                    f"avoid excessive API usage — narrow the pattern."
                )
                break
            if set(key.split(KEY_SEPARATOR)) & exclude_paths:
                continue
            if any(er.match(key) for er in exclude_regexes):
                continue
            if compiled_regex.match(key):
                matched.append((key, size))

        if not matched:
            logger.info(
                f"No files matched glob '{pattern}' in bucket "
                f"'{bucket_name}'. If this is unexpected, verify that "
                f"glob dataPath is supported on your storage provider "
                f"(currently S3 only — GCS/Azure require a list_keys "
                f"override)."
            )
            return

        if entry.unstructuredData:
            for key, _ in matched:
                yield MetadataEntry(
                    dataPath=key,
                    structureFormat=None,
                    separator=entry.separator,
                    isPartitioned=False,
                    partitionColumns=None,
                    unstructuredFormats=None,
                    unstructuredData=True,
                    depth=0,
                )
            return

        for table_root, files in group_files_by_table(matched).items():
            container_name = table_root.strip(KEY_SEPARATOR)
            if not container_name:
                continue
            file_keys = [k for k, _ in files]

            partition_columns = None
            is_partitioned = entry.isPartitioned
            if entry.partitionColumns:
                # Explicit partition columns are already lightweight
                # PartitionColumn objects — pass through unchanged.
                partition_columns = list(entry.partitionColumns)
                is_partitioned = True
            elif entry.autoPartitionDetection:
                detected = detect_hive_partitions(file_keys, table_root) or []
                # detect_hive_partitions returns full Column objects; the
                # manifest stores the lightweight PartitionColumn shape.
                partition_columns = [
                    PartitionColumn(
                        name=col.name.root,
                        dataType=col.dataType,
                        dataTypeDisplay=col.dataTypeDisplay,
                        description=col.description.root if col.description else None,
                    )
                    for col in detected
                ] or None
                has_subdirs = any(
                    KEY_SEPARATOR
                    in k[len(table_root) :]
                    .lstrip(KEY_SEPARATOR)
                    .rsplit(KEY_SEPARATOR, 1)[0]
                    for k in file_keys
                    if k.startswith(table_root)
                )
                is_partitioned = bool(partition_columns) or has_subdirs

            structure_format = entry.structureFormat or infer_structure_format(
                file_keys[0]
            )
            if not structure_format:
                logger.warning(
                    f"Could not determine file format for '{container_name}' "
                    f"(glob '{pattern}'). Set structureFormat on the manifest "
                    f"entry or use a recognized file extension. Skipping."
                )
                continue

            yield MetadataEntry(
                dataPath=container_name,
                structureFormat=structure_format,
                separator=entry.separator,
                isPartitioned=is_partitioned,
                partitionColumns=partition_columns,
                depth=0,
                unstructuredFormats=None,
                unstructuredData=False,
            )

    def expand_entries(
        self, bucket_name: str, entries: List[MetadataEntry]
    ) -> List[MetadataEntry]:
        """Expand all entries whose dataPath is a glob. Literal paths pass
        through. Returns a concrete list safe to iterate multiple times.

        Each entry is expanded inside its own try/except so a failure on
        one (e.g. S3 AccessDenied mid-listing, a malformed glob, an
        unexpected parse error) does NOT block the other entries from
        processing. Failures are logged and reported to the workflow
        status so the user can see which entry went bad.
        """
        result: List[MetadataEntry] = []
        for entry in entries:
            try:
                result.extend(self.expand_entry(bucket_name, entry))
            except Exception as exc:
                msg = (
                    f"Failed to expand manifest entry with dataPath "
                    f"'{entry.dataPath}' in bucket '{bucket_name}': "
                    f"{type(exc).__name__}: {exc}. "
                    f"Other entries will still be processed."
                )
                logger.warning(msg)
                if hasattr(self, "status") and hasattr(self.status, "warning"):
                    self.status.warning(bucket_name, msg)
        return result

    def filter_manifest_entries(
        self, bucket_name: str, entries: List[MetadataEntry]
    ) -> List[MetadataEntry]:
        """Drop manifest entries whose ``dataPath`` should not become a
        container, applying:

        1. Default Spark/Delta artifact skip list (``_SUCCESS``,
           ``_delta_log``, ``_temporary``, ``_spark_metadata``, ``.tmp``)
           so these never leak into the catalog even when a manifest
           accidentally lists them.
        2. The pipeline's ``containerFilterPattern`` (includes / excludes
           / regex) against the **dataPath**. This lets users write a
           single pipeline-level rule (e.g. ``excludes: ["_SUCCESS"]``)
           and have it apply across every bucket manifest without
           editing each manifest file.

        Called by the source after ``expand_entries`` so both literal
        and expanded entries are filtered uniformly.
        """
        from metadata.utils.filters import filter_by_container
        from metadata.utils.storage_utils import is_excluded_artifact

        pattern = getattr(self.source_config, "containerFilterPattern", None)
        filtered: List[MetadataEntry] = []
        for entry in entries:
            path = entry.dataPath or ""
            # 1. Default skip list — never let Spark artifacts become
            #    containers. Uses the full is_excluded_artifact check
            #    (segment-based + leaf-name sentinels like _SUCCESS.crc,
            #    _committed_*, *.crc) so glob-expanded unstructured
            #    entries pointing at sidecar files are caught too.
            if is_excluded_artifact(path):
                logger.info(
                    f"Skipping manifest entry '{path}' in bucket "
                    f"'{bucket_name}' — matches a default excluded "
                    f"path segment (Spark/Delta internal)."
                )
                if hasattr(self, "status") and hasattr(self.status, "filter"):
                    self.status.filter(path, "Default exclude (Spark artifact)")
                continue

            # 2. Pipeline-level containerFilterPattern against the dataPath.
            if pattern and filter_by_container(pattern, path):
                logger.info(
                    f"Skipping manifest entry '{path}' in bucket "
                    f"'{bucket_name}' — filtered by containerFilterPattern."
                )
                if hasattr(self, "status") and hasattr(self.status, "filter"):
                    self.status.filter(path, "containerFilterPattern excluded")
                continue

            filtered.append(entry)
        return filtered
