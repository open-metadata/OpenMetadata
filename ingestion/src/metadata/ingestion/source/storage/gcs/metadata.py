#  Copyright 2024 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""GCS object store extraction metadata"""

import json
import secrets
import traceback
from copy import deepcopy
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, Iterable, List, Optional, Tuple  # noqa: UP035

from google.cloud.exceptions import NotFound
from google.cloud.monitoring_v3.types import TimeInterval
from pydantic import ValidationError

from metadata.generated.schema.api.data.createContainer import CreateContainerRequest
from metadata.generated.schema.entity.data import container
from metadata.generated.schema.entity.data.container import (
    Container,
    ContainerDataModel,
)
from metadata.generated.schema.entity.services.connections.database.datalake.gcsConfig import (
    GCSConfig,
)
from metadata.generated.schema.entity.services.connections.storage.gcsConnection import (
    GcsConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.storage.containerMetadataConfig import (
    MetadataEntry,
    StorageContainerConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.storage.gcs.models import (
    GCSBucketResponse,
    GCSContainerDetails,
)
from metadata.ingestion.source.storage.storage_service import (
    KEY_SEPARATOR,
    OPENMETADATA_TEMPLATE_FILE_NAME,
    StorageServiceSource,
)
from metadata.readers.archive import (
    ArchiveEntry,
    GCSBlobAdapter,
    is_archive_format,
    iter_archive_entries_with_schema,
    open_archive_reader,
)
from metadata.readers.dataframe.reader_factory import SupportedTypes
from metadata.readers.file.base import ReadException
from metadata.readers.file.config_source_factory import get_reader
from metadata.utils import fqn
from metadata.utils.filters import filter_by_container
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

WILD_CARD = "*"


class GCSMetric(Enum):
    NUMBER_OF_OBJECTS = "storage.googleapis.com/storage/object_count"
    BUCKET_SIZE_BYTES = "storage.googleapis.com/storage/total_bytes"


class GcsSource(StorageServiceSource):
    """
    Source implementation to ingest GCS bucket data.
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.gcs_clients = self.connection
        self.gcs_readers = {
            project_id: get_reader(config_source=GCSConfig(), client=client)
            for project_id, client in self.gcs_clients.storage_client.clients.items()
        }
        self._bucket_cache: Dict[str, Container] = {}  # noqa: UP006
        self._unstructured_container_cache: Dict[str, Tuple[str, str]] = {}  # noqa: UP006

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None):  # noqa: UP045
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: GcsConnection = config.serviceConnection.root.config
        if not isinstance(connection, GcsConnection):
            raise InvalidSourceException(f"Expected GcsConnection, but got {connection}")
        return cls(config, metadata)

    def get_containers(self) -> Iterable[GCSContainerDetails]:
        bucket_results = self.fetch_buckets()

        for bucket_response in bucket_results:
            bucket_name = bucket_response.name
            try:
                # We always generate the parent container (the bucket)
                yield self._generate_unstructured_container(bucket_response=bucket_response)
                container_fqn = fqn._build(  # pylint: disable=protected-access
                    *(
                        self.context.get().objectstore_service,
                        self.context.get().container,
                    )
                )
                container_entity = self.metadata.get_by_name(entity=Container, fqn=container_fqn)
                self._bucket_cache[bucket_name] = container_entity
                self._unstructured_container_cache[container_fqn] = (
                    container_entity.id.root,
                    "",  # Empty string for bucket root (no relative path)
                )
                parent_entity: EntityReference = EntityReference(
                    id=self._bucket_cache[bucket_name].id.root, type="container"
                )
                if self.global_manifest:
                    manifest_entries_for_current_bucket = self._manifest_entries_to_metadata_entries_by_container(
                        container_name=bucket_name, manifest=self.global_manifest
                    )
                    # Check if we have entries in the manifest file belonging to this bucket
                    if manifest_entries_for_current_bucket:
                        # ingest all the relevant valid paths from it
                        yield from self._generate_structured_containers(
                            bucket_response=bucket_response,
                            entries=manifest_entries_for_current_bucket,
                            parent=parent_entity,
                        )
                        yield from self._generate_unstructured_containers(
                            bucket_response=bucket_response,
                            entries=manifest_entries_for_current_bucket,
                            parent=parent_entity,
                        )
                        # nothing else do to for the current bucket, skipping to the next
                        continue
                # If no global file, or no valid entries in the manifest, check for bucket level metadata file
                metadata_config = self._load_metadata_file(bucket=bucket_response)
                if metadata_config:
                    yield from self._generate_structured_containers(
                        bucket_response=bucket_response,
                        entries=metadata_config.entries,
                        parent=parent_entity,
                    )
                    yield from self._generate_unstructured_containers(
                        bucket_response=bucket_response,
                        entries=metadata_config.entries,
                        parent=parent_entity,
                    )

                # clean up the cache after each bucket
                self._unstructured_container_cache.clear()

            except ValidationError as err:
                self.status.failed(
                    StackTraceError(
                        name=bucket_response.name,
                        error=f"Validation error while creating Container from bucket details - {err}",
                        stackTrace=traceback.format_exc(),
                    )
                )
            except Exception as err:
                self.status.failed(
                    StackTraceError(
                        name=bucket_response.name,
                        error=f"Wild error while creating Container from bucket details - {err}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_create_container_requests(
        self, container_details: GCSContainerDetails
    ) -> Iterable[Either[CreateContainerRequest]]:
        container_request = CreateContainerRequest(
            name=EntityName(container_details.name),
            prefix=container_details.prefix,
            numberOfObjects=container_details.number_of_objects,
            size=container_details.size,
            dataModel=container_details.data_model,
            service=FullyQualifiedEntityName(self.context.get().objectstore_service),
            parent=container_details.parent,
            sourceUrl=container_details.sourceUrl,
            fileFormats=container_details.file_formats,
            fullPath=container_details.fullPath,
        )
        yield Either(right=container_request)
        self.register_record(container_request=container_request)

    def get_size(self, bucket_name: str, project_id: str, file_path: str) -> Optional[float]:  # noqa: UP045
        """
        Method to get the size of the file
        """
        try:
            client = self.gcs_clients.storage_client.clients[project_id]
            bucket = client.get_bucket(bucket_name)
            blob = bucket.blob(file_path)
            blob.reload()
            return blob.size  # noqa: TRY300
        except Exception as exc:
            logger.debug(f"Failed to get size of file due to {exc}")
            logger.debug(traceback.format_exc())
        return None

    def is_valid_unstructured_file(self, accepted_extensions: List, key: str) -> bool:  # noqa: UP006
        if WILD_CARD in accepted_extensions:
            return True

        for ext in accepted_extensions:  # noqa: SIM110
            if key.endswith(ext):
                return True

        return False

    def _generate_inner_file_container(
        self,
        entry: ArchiveEntry,
        archive_ref: EntityReference,
        archive_prefix: str,
        columns: list,
        entry_format: SupportedTypes | None,
        bucket_response: GCSBucketResponse,
    ) -> Iterable[GCSContainerDetails]:
        """Yield one child container for an inner archive entry."""
        inner_name = entry.name.split("/")[-1]
        inner_prefix = f"{archive_prefix}/{entry.name.lstrip(KEY_SEPARATOR)}"
        try:
            file_formats = [container.FileFormat(entry_format.value)] if entry_format else []
        except ValueError:
            file_formats = []
        data_model = ContainerDataModel(isPartitioned=False, columns=columns) if columns else None
        yield GCSContainerDetails(  # pyright: ignore[reportCallIssue]
            name=inner_name,
            prefix=inner_prefix,
            size=entry.size,
            file_formats=file_formats,
            data_model=data_model,
            parent=archive_ref,
            leaf_container=True,
            fullPath=self._get_full_path(bucket_response.name, inner_prefix),
            sourceUrl=self._get_object_source_url(
                bucket=bucket_response,
                prefix=self._clean_path(inner_prefix),
                is_file=True,
            ),
        )

    def _generate_archive_containers(
        self,
        bucket_response: GCSBucketResponse,
        metadata_entry: MetadataEntry,
        parent: EntityReference | None = None,
    ) -> Iterable[GCSContainerDetails]:
        """Yield a parent container for the archive blob, then child containers for each inner file.

        Schema is inferred once from the first valid inner file and reused for all children
        (Uniform Schema Requirement).
        """
        bucket_name = bucket_response.name
        archive_path = metadata_entry.dataPath.strip(KEY_SEPARATOR)
        archive_size = self.get_size(bucket_name, bucket_response.project_id, archive_path)
        prefix = f"{KEY_SEPARATOR}{archive_path}"

        yield GCSContainerDetails(  # pyright: ignore[reportCallIssue]
            name=archive_path,
            prefix=prefix,
            creation_date=(bucket_response.creation_date.isoformat() if bucket_response.creation_date else None),
            size=archive_size,
            file_formats=[],
            data_model=None,
            parent=parent,
            fullPath=self._get_full_path(bucket_name, prefix),
            sourceUrl=self._get_object_source_url(
                bucket=bucket_response,
                prefix=archive_path,
                is_file=True,
            ),
        )

        archive_fqn = fqn._build(  # pylint: disable=protected-access
            getattr(self.context.get(), "objectstore_service"),  # noqa: B009
            bucket_name,
            archive_path,
        )
        archive_entity = self.metadata.get_by_name(entity=Container, fqn=archive_fqn)
        if archive_entity is None:
            logger.warning(f"Archive container {archive_fqn!r} not found after creation; skipping children")
            return
        archive_ref = EntityReference(id=archive_entity.id.root, type="container")  # pyright: ignore[reportCallIssue]

        client = self.gcs_clients.storage_client.clients[bucket_response.project_id]
        bucket_client = client.bucket(bucket_name)
        blob = GCSBlobAdapter(bucket_client, archive_path)
        structure_format = metadata_entry.structureFormat or ""
        with open_archive_reader(blob, structure_format) as reader:
            for entry, columns, entry_format in iter_archive_entries_with_schema(reader):
                yield from self._generate_inner_file_container(
                    entry=entry,
                    archive_ref=archive_ref,
                    archive_prefix=prefix,
                    columns=columns,
                    entry_format=entry_format,
                    bucket_response=bucket_response,
                )

    def _generate_container_details(
        self,
        bucket_response: GCSBucketResponse,
        metadata_entry: MetadataEntry,
        parent: Optional[EntityReference] = None,  # noqa: UP045
    ) -> Optional[GCSContainerDetails]:  # noqa: UP045
        bucket_name = bucket_response.name

        if not metadata_entry.structureFormat:
            return None

        sample_key = self._get_sample_file_path(bucket=bucket_response, metadata_entry=metadata_entry)
        # if we have a sample file to fetch a schema from
        if sample_key:
            columns = self._get_columns(
                container_name=bucket_name,
                sample_key=sample_key,
                metadata_entry=metadata_entry,
                config_source=GCSConfig(securityConfig=self.service_connection.credentials),
                client=self.gcs_clients.storage_client.clients[bucket_response.project_id],
            )
            if columns:
                prefix = f"{KEY_SEPARATOR}{metadata_entry.dataPath.strip(KEY_SEPARATOR)}"
                return GCSContainerDetails(
                    name=metadata_entry.dataPath.strip(KEY_SEPARATOR),
                    prefix=prefix,
                    creation_date=bucket_response.creation_date.isoformat() if bucket_response.creation_date else None,
                    number_of_objects=self._fetch_metric(bucket=bucket_response, metric=GCSMetric.NUMBER_OF_OBJECTS),
                    size=self._fetch_metric(bucket=bucket_response, metric=GCSMetric.BUCKET_SIZE_BYTES),
                    file_formats=[container.FileFormat(metadata_entry.structureFormat)],
                    data_model=ContainerDataModel(isPartitioned=metadata_entry.isPartitioned, columns=columns),
                    parent=parent,
                    fullPath=self._get_full_path(bucket_name, prefix),
                    sourceUrl=self._get_object_source_url(
                        bucket=bucket_response,
                        prefix=metadata_entry.dataPath.strip(KEY_SEPARATOR),
                        is_file=False,  # Structured containers are directories
                    ),
                )
        return None

    def _generate_structured_containers_by_depth(
        self,
        bucket_response: GCSBucketResponse,
        metadata_entry: MetadataEntry,
        parent: Optional[EntityReference] = None,  # noqa: UP045
    ) -> Iterable[GCSContainerDetails]:
        try:
            prefix = self._get_sample_file_prefix(metadata_entry=metadata_entry)
            if prefix:
                client = self.gcs_clients.storage_client.clients[bucket_response.project_id]
                response = client.list_blobs(
                    bucket_response.name,
                    prefix=prefix,
                    max_results=1000,
                )
                # total depth is depth of prefix + depth of the metadata entry
                total_depth = metadata_entry.depth + len(prefix[:-1].split("/"))
                candidate_keys = {
                    "/".join(entry.name.split("/")[:total_depth]) + "/"
                    for entry in response
                    if entry and entry.name and len(entry.name.split("/")) > total_depth
                }
                for key in candidate_keys:
                    metadata_entry_copy = deepcopy(metadata_entry)
                    metadata_entry_copy.dataPath = key.strip(KEY_SEPARATOR)
                    structured_container: Optional[GCSContainerDetails] = self._generate_container_details(  # noqa: UP045
                        bucket_response=bucket_response,
                        metadata_entry=metadata_entry_copy,
                        parent=parent,
                    )
                    if structured_container:
                        yield structured_container
        except Exception as err:
            logger.warning(
                f"Error while generating structured containers by depth for {metadata_entry.dataPath} - {err}"
            )
            logger.debug(traceback.format_exc())

    def _generate_structured_containers(
        self,
        bucket_response: GCSBucketResponse,
        entries: List[MetadataEntry],  # noqa: UP006
        parent: Optional[EntityReference] = None,  # noqa: UP045
    ) -> Iterable[GCSContainerDetails]:
        for metadata_entry in entries:
            logger.info(
                f"Extracting metadata from path {metadata_entry.dataPath.strip(KEY_SEPARATOR)} "
                f"and generating structured container"
            )
            if is_archive_format(metadata_entry.structureFormat):
                try:
                    yield from self._generate_archive_containers(
                        bucket_response=bucket_response,
                        metadata_entry=metadata_entry,
                        parent=parent,
                    )
                except (ValueError, OSError) as exc:
                    logger.warning(f"Failed processing archive {metadata_entry.dataPath!r}: {exc}")
                    logger.debug(traceback.format_exc())
                except Exception as exc:
                    logger.error(
                        f"Unexpected error processing archive {metadata_entry.dataPath!r}: {exc}", exc_info=True
                    )
                continue
            if metadata_entry.depth == 0:
                structured_container: Optional[GCSContainerDetails] = self._generate_container_details(  # noqa: UP045
                    bucket_response=bucket_response,
                    metadata_entry=metadata_entry,
                    parent=parent,
                )
                if structured_container:
                    yield structured_container
            else:
                yield from self._generate_structured_containers_by_depth(
                    bucket_response=bucket_response,
                    metadata_entry=metadata_entry,
                    parent=parent,
                )

    def _fetch_bucket(self, bucket_name: str) -> GCSBucketResponse:  # noqa: RET503
        for project_id, client in self.gcs_clients.storage_client.clients.items():
            try:
                bucket = client.get_bucket(bucket_name)
            except NotFound:
                logger.warning(f"Bucket {bucket_name} not found in project {project_id}")
                self.status.warning(f"{project_id}.{bucket_name}", "Bucket Not Found")
                continue
            return GCSBucketResponse(
                name=bucket.name,
                project_id=project_id,
                creation_date=bucket.time_created,
            )

    def fetch_buckets(self) -> List[GCSBucketResponse]:  # noqa: UP006
        results: List[GCSBucketResponse] = []  # noqa: UP006
        try:
            if self.service_connection.bucketNames:
                for bucket_name in self.service_connection.bucketNames:
                    bucket = self._fetch_bucket(bucket_name)
                    if bucket:
                        results.append(bucket)
                return results
            for project_id, client in self.gcs_clients.storage_client.clients.items():
                for bucket in client.list_buckets():
                    if filter_by_container(
                        self.source_config.containerFilterPattern,
                        container_name=bucket.name,
                    ):
                        self.status.filter(bucket.name, "Bucket Filtered Out")
                    else:
                        results.append(
                            GCSBucketResponse(
                                name=bucket.name,
                                project_id=project_id,
                                creation_date=bucket.time_created,
                            )
                        )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to fetch buckets list - {err}")
        return results

    def _get_time_interval(self, days: int = 2):
        end = datetime.now()
        start = end - timedelta(days=days)

        start_time = start.isoformat(timespec="seconds") + "Z"
        end_time = end.isoformat(timespec="seconds") + "Z"
        return TimeInterval(end_time=end_time, start_time=start_time)

    def _fetch_metric(self, bucket: GCSBucketResponse, metric: GCSMetric) -> float:
        try:
            filters = [
                f'resource.labels.bucket_name="{bucket.name}"',
                f'metric.type="{metric.value}"',
            ]
            filter_ = " AND ".join(filters)
            interval = self._get_time_interval()
            timeseries = self.gcs_clients.metrics_client.list_time_series(
                name=f"projects/{bucket.project_id}", filter=filter_, interval=interval
            )
            point = list(timeseries)[-1].points[-1]
            return point.value.int64_value  # noqa: TRY300
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed fetching metric {metric.value} for bucket {bucket.name}, returning 0")
        return 0

    def _generate_unstructured_container(self, bucket_response: GCSBucketResponse) -> GCSContainerDetails:
        return GCSContainerDetails(
            name=bucket_response.name,
            prefix=KEY_SEPARATOR,
            creation_date=bucket_response.creation_date.isoformat() if bucket_response.creation_date else None,
            number_of_objects=self._fetch_metric(bucket=bucket_response, metric=GCSMetric.NUMBER_OF_OBJECTS),
            size=self._fetch_metric(bucket=bucket_response, metric=GCSMetric.BUCKET_SIZE_BYTES),
            file_formats=[],
            data_model=None,
            fullPath=self._get_full_path(bucket_name=bucket_response.name),
            sourceUrl=self._get_bucket_source_url(bucket=bucket_response),
        )

    def _clean_path(self, path: str) -> str:
        return path.strip(KEY_SEPARATOR)

    def _get_full_path(self, bucket_name: str, prefix: str = None) -> Optional[str]:  # noqa: RUF013, UP045
        """
        Method to get the full path of the file
        """
        if bucket_name is None:
            return None

        full_path = f"gs://{self._clean_path(bucket_name)}"

        if prefix:
            full_path += f"/{self._clean_path(prefix)}"

        return full_path

    def _get_sample_file_path(self, bucket: GCSBucketResponse, metadata_entry: MetadataEntry) -> Optional[str]:  # noqa: UP045
        """
        Given a bucket and a metadata entry, returns the full path key to a file which can then be used to infer schema
        or None in the case of a non-structured metadata entry, or if no such keys can be found
        """
        prefix = self._get_sample_file_prefix(metadata_entry=metadata_entry)
        try:
            if prefix:
                client = self.gcs_clients.storage_client.clients[bucket.project_id]
                response = client.list_blobs(
                    bucket.name,
                    prefix=prefix,
                    max_results=1000,
                )
                candidate_keys = [
                    entry.name for entry in response if entry.name.endswith(metadata_entry.structureFormat)
                ]
                # pick a random key out of the candidates if any were returned
                if candidate_keys:
                    result_key = secrets.choice(candidate_keys)
                    logger.info(f"File {result_key} was picked to infer data structure from.")
                    return result_key
                logger.warning(f"No sample files found in {prefix} with {metadata_entry.structureFormat} extension")
            return None  # noqa: TRY300
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error when trying to list objects in GCS bucket {bucket.name} at prefix {prefix}")
            return None

    def _get_bucket_source_url(self, bucket: GCSBucketResponse) -> Optional[str]:  # noqa: UP045
        """
        Method to get the source url of GCS bucket
        """
        try:
            return f"https://console.cloud.google.com/storage/browser/{bucket.name}?project={bucket.project_id}"
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get source url: {exc}")
        return None

    def _get_object_source_url(self, bucket: GCSBucketResponse, prefix: str, is_file: bool = False) -> Optional[str]:  # noqa: UP045
        """
        Method to get the source url of GCS object or directory
        """
        try:
            # Remove trailing slash from prefix if present
            clean_prefix = prefix.rstrip("/")

            if is_file:
                # For files, use the _details path with tab=live_object
                return f"https://console.cloud.google.com/storage/browser/_details/{bucket.name}/{clean_prefix};tab=live_object"
            else:  # noqa: RET505
                # For directories/prefixes, use the browser view
                return f"https://console.cloud.google.com/storage/browser/{bucket.name}/{clean_prefix}?project={bucket.project_id}"
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get source url: {exc}")
        return None

    def _yield_parents_of_unstructured_container(
        self,
        bucket_name: str,
        project_id: str,
        list_of_parent: List[str],  # noqa: UP006
        parent: Optional[EntityReference] = None,  # noqa: UP045
    ):
        relative_path = ""  # Path relative to bucket for URLs
        sub_parent = parent
        for i in range(len(list_of_parent) - 1):
            container_fqn = fqn._build(  # pylint: disable=protected-access
                *(
                    self.context.get().objectstore_service,
                    bucket_name,
                    *list_of_parent[: i + 1],
                )
            )
            if container_fqn in self._unstructured_container_cache:
                parent_id, relative_path = self._unstructured_container_cache[container_fqn]
                sub_parent = EntityReference(id=parent_id, type="container")
                continue

            # Build the relative path (no gs:// prefix)
            current_relative_path = KEY_SEPARATOR.join(list_of_parent[: i + 1])
            yield GCSContainerDetails(
                name=list_of_parent[i],
                prefix=KEY_SEPARATOR + current_relative_path,
                file_formats=[],
                parent=sub_parent,
                fullPath=self._get_full_path(bucket_name, current_relative_path),
                sourceUrl=self._get_object_source_url(
                    bucket=GCSBucketResponse(name=bucket_name, project_id=project_id, creation_date=None),
                    prefix=current_relative_path,
                    is_file=False,  # Parent containers are directories
                ),
            )
            container_entity = self.metadata.get_by_name(entity=Container, fqn=container_fqn)
            relative_path = current_relative_path
            self._unstructured_container_cache[container_fqn] = (
                container_entity.id.root,
                relative_path,
            )
            sub_parent = EntityReference(id=container_entity.id.root, type="container")

    def _yield_nested_unstructured_containers(
        self,
        bucket_response: GCSBucketResponse,
        metadata_entry: MetadataEntry,
        parent: Optional[EntityReference] = None,  # noqa: UP045
    ):
        bucket_name = bucket_response.name
        client = self.gcs_clients.storage_client.clients[bucket_response.project_id]
        response = client.list_blobs(
            bucket_name,
            prefix=metadata_entry.dataPath,
            max_results=1000,
        )
        candidate_keys = [entry.name for entry in response if entry and entry.name and not entry.name.endswith("/")]
        for key in candidate_keys:
            if self.is_valid_unstructured_file(metadata_entry.unstructuredFormats, key):
                logger.debug(
                    f"Extracting metadata from path {key.strip(KEY_SEPARATOR)} and generating unstructured container"
                )
                list_of_parent = key.strip(KEY_SEPARATOR).split(KEY_SEPARATOR)
                yield from self._yield_parents_of_unstructured_container(
                    bucket_name, bucket_response.project_id, list_of_parent, parent
                )
                parent_fqn = fqn._build(  # pylint: disable=protected-access
                    *(
                        self.context.get().objectstore_service,
                        bucket_name,
                        *list_of_parent[:-1],
                    )
                )
                parent_id, parent_relative_path = self._unstructured_container_cache[parent_fqn]
                container_fqn = fqn._build(  # pylint: disable=protected-access
                    *(
                        self.context.get().objectstore_service,
                        bucket_name,
                        *list_of_parent,
                    )
                )
                size = self.get_size(bucket_name, bucket_response.project_id, key)
                yield GCSContainerDetails(
                    name=list_of_parent[-1],
                    prefix=KEY_SEPARATOR + parent_relative_path if parent_relative_path else KEY_SEPARATOR,
                    file_formats=[],
                    size=size,
                    container_fqn=container_fqn,
                    leaf_container=True,
                    parent=EntityReference(id=parent_id, type="container"),
                    fullPath=self._get_full_path(bucket_name, key),
                    sourceUrl=self._get_object_source_url(
                        bucket=bucket_response,
                        prefix=key,  # Use the full key path for the file
                        is_file=True,  # Leaf containers are files
                    ),
                )

    def _generate_unstructured_containers(
        self,
        bucket_response: GCSBucketResponse,
        entries: List[MetadataEntry],  # noqa: UP006
        parent: Optional[EntityReference] = None,  # noqa: UP045
    ) -> Iterable[GCSContainerDetails]:
        bucket_name = bucket_response.name
        for metadata_entry in entries:
            if metadata_entry.structureFormat:
                continue
            if metadata_entry.unstructuredFormats:
                yield from self._yield_nested_unstructured_containers(
                    bucket_response=bucket_response,
                    metadata_entry=metadata_entry,
                    parent=parent,
                )
            else:
                logger.debug(
                    f"Extracting metadata from path {metadata_entry.dataPath.strip(KEY_SEPARATOR)} "
                    f"and generating unstructured container"
                )
                prefix = f"{KEY_SEPARATOR}{metadata_entry.dataPath.strip(KEY_SEPARATOR)}"
                yield GCSContainerDetails(
                    name=metadata_entry.dataPath.strip(KEY_SEPARATOR),
                    prefix=prefix,
                    file_formats=[],
                    data_model=None,
                    parent=parent,
                    size=self.get_size(
                        bucket_name=bucket_name,
                        project_id=bucket_response.project_id,
                        file_path=metadata_entry.dataPath.strip(KEY_SEPARATOR),
                    ),
                    fullPath=self._get_full_path(bucket_name, prefix),
                    sourceUrl=self._get_object_source_url(
                        bucket=bucket_response,
                        prefix=metadata_entry.dataPath.strip(KEY_SEPARATOR),
                        is_file=True,  # Individual unstructured files
                    ),
                )

    def _load_metadata_file(self, bucket: GCSBucketResponse) -> Optional[StorageContainerConfig]:  # noqa: UP045
        """
        Load the metadata template file from the root of the bucket, if it exists
        """
        try:
            logger.info(f"Looking for metadata template file at - gs://{bucket.name}/{OPENMETADATA_TEMPLATE_FILE_NAME}")
            reader = self.gcs_readers.get(bucket.project_id)
            response_object = reader.read(
                path=OPENMETADATA_TEMPLATE_FILE_NAME,
                bucket_name=bucket.name,
                verbose=False,
            )
            content = json.loads(response_object)
            metadata_config = StorageContainerConfig.model_validate(content)
            return metadata_config  # noqa: RET504, TRY300
        except ReadException:
            logger.warning(f"No metadata file found at gs://{bucket.name}/{OPENMETADATA_TEMPLATE_FILE_NAME}")
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed loading metadata file gs://{bucket.name}/{OPENMETADATA_TEMPLATE_FILE_NAME}-{exc}")
        return None
