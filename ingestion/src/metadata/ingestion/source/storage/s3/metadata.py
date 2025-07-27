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
"""S3 object store extraction metadata"""
import json
import secrets
import traceback
from copy import deepcopy
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, Iterable, List, Optional, Tuple

from pydantic import ValidationError

from metadata.generated.schema.api.data.createContainer import CreateContainerRequest
from metadata.generated.schema.entity.data import container
from metadata.generated.schema.entity.data.container import (
    Container,
    ContainerDataModel,
)
from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
    S3Config,
)
from metadata.generated.schema.entity.services.connections.storage.s3Connection import (
    S3Connection,
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
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.storage.s3.models import (
    S3BucketResponse,
    S3ContainerDetails,
    S3Tag,
    S3TagResponse,
)
from metadata.ingestion.source.storage.storage_service import (
    KEY_SEPARATOR,
    OPENMETADATA_TEMPLATE_FILE_NAME,
    StorageServiceSource,
)
from metadata.readers.file.base import ReadException
from metadata.readers.file.config_source_factory import get_reader
from metadata.utils import fqn
from metadata.utils.filters import filter_by_container
from metadata.utils.logger import ingestion_logger
from metadata.utils.s3_utils import list_s3_objects
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_label

logger = ingestion_logger()

S3_CLIENT_ROOT_RESPONSE = "Contents"

WILD_CARD = "*"


class S3Metric(Enum):
    NUMBER_OF_OBJECTS = "NumberOfObjects"
    BUCKET_SIZE_BYTES = "BucketSizeBytes"


class S3Source(StorageServiceSource):
    """
    Source implementation to ingest S3 buckets data.
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.s3_client = self.connection.s3_client
        self.cloudwatch_client = self.connection.cloudwatch_client

        self._bucket_cache: Dict[str, Container] = {}
        self._unstructured_container_cache: Dict[str, Tuple[str, str]] = {}
        self.s3_reader = get_reader(config_source=S3Config(), client=self.s3_client)

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: S3Connection = config.serviceConnection.root.config
        if not isinstance(connection, S3Connection):
            raise InvalidSourceException(f"Expected S3Connection, but got {connection}")
        return cls(config, metadata)

    def get_containers(self) -> Iterable[S3ContainerDetails]:
        bucket_results = self.fetch_buckets()

        for bucket_response in bucket_results:
            bucket_name = bucket_response.name
            try:
                # We always generate the parent container (the bucket)
                yield self._generate_unstructured_container(
                    bucket_response=bucket_response
                )
                container_fqn = fqn._build(  # pylint: disable=protected-access
                    *(
                        self.context.get().objectstore_service,
                        self.context.get().container,
                    )
                )
                container_entity = self.metadata.get_by_name(
                    entity=Container, fqn=container_fqn
                )
                self._bucket_cache[bucket_name] = container_entity
                self._unstructured_container_cache[container_fqn] = (
                    container_entity.id.root,
                    KEY_SEPARATOR,
                )
                parent_entity: EntityReference = EntityReference(
                    id=self._bucket_cache[bucket_name].id.root, type="container"
                )
                if self.global_manifest:
                    manifest_entries_for_current_bucket = (
                        self._manifest_entries_to_metadata_entries_by_container(
                            container_name=bucket_name, manifest=self.global_manifest
                        )
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
                metadata_config = self._load_metadata_file(bucket_name=bucket_name)
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

    def _get_bucket_name_and_key(self, full_path: str) -> Tuple[str, str]:
        """
        Method to get the bucket name and key from the full path
        """
        if full_path:
            parts = full_path.removeprefix("s3://").split(KEY_SEPARATOR)
            if len(parts) > 2:
                return parts[0], KEY_SEPARATOR.join(parts[1:])
        return None, None

    def get_tag_by_fqn(self, entity_fqn: str) -> Optional[List[TagLabel]]:
        """
        Pick up the tags registered in the context
        searching by entity FQN
        """
        try:
            tag_labels = []
            for tag_and_category in self.context.get().tags or []:
                if tag_and_category.fqn and tag_and_category.fqn.root == entity_fqn:
                    tag_label = get_tag_label(
                        metadata=self.metadata,
                        tag_name=tag_and_category.tag_request.name.root,
                        classification_name=tag_and_category.classification_request.name.root,
                    )
                    if tag_label:
                        tag_labels.append(tag_label)
            return tag_labels or None
        except Exception as exc:
            logger.debug(f"Failed to ingest tags due to: {exc}")
            logger.debug(traceback.format_exc())

        return None

    def yield_container_tags(
        self, container_details: S3ContainerDetails
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        From topology. To be run for each container
        """
        try:
            bucket_name, key = self._get_bucket_name_and_key(container_details.fullPath)
            if (
                container_details.leaf_container
                and container_details.container_fqn
                and bucket_name
                and key
            ):
                tags = self.s3_client.get_object_tagging(Bucket=bucket_name, Key=key)
                tags_list: List[S3Tag] = S3TagResponse.model_validate(tags).TagSet
                for tag in tags_list:
                    yield from get_ometa_tag_and_classification(
                        tag_fqn=FullyQualifiedEntityName(
                            container_details.container_fqn
                        ),
                        tags=[tag.Value],
                        classification_name=tag.Key,
                        tag_description="S3 TAG VALUE",
                        classification_description="S3 TAG KEY",
                    )
        except Exception as exc:
            logger.debug(f"Failed to ingest tags due to: {exc}")
            logger.debug(traceback.format_exc())

    def yield_create_container_requests(
        self, container_details: S3ContainerDetails
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
            tags=self.get_tag_by_fqn(container_details.container_fqn),
        )
        yield Either(right=container_request)
        self.register_record(container_request=container_request)

    def get_size(self, bucket_name: str, file_path: str) -> Optional[float]:
        """
        Method to get the size of the file
        """
        try:
            file_obj = self.s3_client.head_object(Bucket=bucket_name, Key=file_path)
            return file_obj["ContentLength"]
        except Exception as exc:
            logger.debug(f"Failed to get size of file due to {exc}")
            logger.debug(traceback.format_exc())
        return None

    def _generate_container_details(
        self,
        bucket_response: S3BucketResponse,
        metadata_entry: MetadataEntry,
        parent: Optional[EntityReference] = None,
    ) -> Optional[S3ContainerDetails]:
        bucket_name = bucket_response.name

        if not metadata_entry.structureFormat:
            return None

        sample_key = self._get_sample_file_path(
            bucket_name=bucket_name, metadata_entry=metadata_entry
        )
        # if we have a sample file to fetch a schema from
        if sample_key:
            try:
                columns = self._get_columns(
                    container_name=bucket_name,
                    sample_key=sample_key,
                    metadata_entry=metadata_entry,
                    config_source=S3Config(
                        securityConfig=self.service_connection.awsConfig
                    ),
                    client=self.s3_client,
                )
            except Exception as err:
                self.status.failed(
                    error=StackTraceError(
                        name=f"{bucket_name}/{sample_key}",
                        error=f"Error extracting columns from [{bucket_name}/{sample_key}] due to: [{err}]",
                        stackTrace=traceback.format_exc(),
                    )
                )
                return None
            if columns:
                prefix = (
                    f"{KEY_SEPARATOR}{metadata_entry.dataPath.strip(KEY_SEPARATOR)}"
                )
                return S3ContainerDetails(
                    name=metadata_entry.dataPath.strip(KEY_SEPARATOR),
                    prefix=prefix,
                    creation_date=bucket_response.creation_date.isoformat()
                    if bucket_response.creation_date
                    else None,
                    file_formats=[container.FileFormat(metadata_entry.structureFormat)],
                    data_model=ContainerDataModel(
                        isPartitioned=metadata_entry.isPartitioned, columns=columns
                    ),
                    parent=parent,
                    fullPath=self._get_full_path(bucket_name, prefix),
                    sourceUrl=self._get_object_source_url(
                        bucket_name=bucket_name,
                        prefix=metadata_entry.dataPath.strip(KEY_SEPARATOR),
                    ),
                )
        return None

    def _generate_structured_containers_by_depth(
        self,
        bucket_response: S3BucketResponse,
        metadata_entry: MetadataEntry,
        parent: Optional[EntityReference] = None,
    ) -> Iterable[S3ContainerDetails]:
        try:
            prefix = self._get_sample_file_prefix(metadata_entry=metadata_entry)
            if prefix:
                kwargs = {"Bucket": bucket_response.name, "Prefix": prefix}
                response = list_s3_objects(self.s3_client, **kwargs)
                # total depth is depth of prefix + depth of the metadata entry
                total_depth = metadata_entry.depth + len(prefix[:-1].split("/"))
                candidate_keys = {
                    "/".join(entry.get("Key").split("/")[:total_depth]) + "/"
                    for entry in response
                    if entry
                    and entry.get("Key")
                    and len(entry.get("Key").split("/")) > total_depth
                }
                for key in candidate_keys:
                    metadata_entry_copy = deepcopy(metadata_entry)
                    metadata_entry_copy.dataPath = key.strip(KEY_SEPARATOR)
                    structured_container: Optional[
                        S3ContainerDetails
                    ] = self._generate_container_details(
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
        bucket_response: S3BucketResponse,
        entries: List[MetadataEntry],
        parent: Optional[EntityReference] = None,
    ) -> Iterable[S3ContainerDetails]:
        for metadata_entry in entries:
            logger.info(
                f"Extracting metadata from path {metadata_entry.dataPath.strip(KEY_SEPARATOR)} "
                f"and generating structured container"
            )
            if metadata_entry.depth == 0:
                structured_container: Optional[
                    S3ContainerDetails
                ] = self._generate_container_details(
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

    def is_valid_unstructured_file(self, accepted_extensions: List, key: str) -> bool:
        # Split the string into a list of values
        if WILD_CARD in accepted_extensions:
            return True

        for ext in accepted_extensions:
            if key.endswith(ext):
                return True

        return False

    def _yield_parents_of_unstructured_container(
        self,
        bucket_name: str,
        list_of_parent: List[str],
        parent: Optional[EntityReference] = None,
    ):
        full_path = self._get_full_path(bucket_name)
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
                parent_id, full_path = self._unstructured_container_cache[container_fqn]
                sub_parent = EntityReference(id=parent_id, type="container")
                continue
            yield S3ContainerDetails(
                name=list_of_parent[i],
                prefix=full_path,
                file_formats=[],
                parent=sub_parent,
                fullPath=full_path + KEY_SEPARATOR + list_of_parent[i],
                sourceUrl=self._get_object_source_url(
                    bucket_name=bucket_name,
                    prefix=self._clean_path(
                        full_path + KEY_SEPARATOR + list_of_parent[i]
                    ),
                ),
            )
            container_entity = self.metadata.get_by_name(
                entity=Container, fqn=container_fqn
            )
            full_path += KEY_SEPARATOR + list_of_parent[i]
            self._unstructured_container_cache[container_fqn] = (
                container_entity.id.root,
                full_path,
            )
            sub_parent = EntityReference(id=container_entity.id.root, type="container")

    def _yield_nested_unstructured_containers(
        self,
        bucket_response: S3BucketResponse,
        metadata_entry: MetadataEntry,
        parent: Optional[EntityReference] = None,
    ):
        bucket_name = bucket_response.name
        kwargs = {"Bucket": bucket_name, "Prefix": metadata_entry.dataPath}
        response = list_s3_objects(self.s3_client, **kwargs)
        candidate_keys = [
            entry["Key"]
            for entry in response
            if entry and entry.get("Key") and not entry.get("Key").endswith("/")
        ]
        for key in candidate_keys:
            if self.is_valid_unstructured_file(metadata_entry.unstructuredFormats, key):
                logger.info(
                    f"Extracting metadata from path {key.strip(KEY_SEPARATOR)} "
                    f"and generating unstructured container"
                )
                list_of_parent = key.strip(KEY_SEPARATOR).split(KEY_SEPARATOR)
                yield from self._yield_parents_of_unstructured_container(
                    bucket_name, list_of_parent, parent
                )
                parent_fqn = fqn._build(  # pylint: disable=protected-access
                    *(
                        self.context.get().objectstore_service,
                        bucket_name,
                        *list_of_parent[:-1],
                    )
                )
                parent_id, parent_path = self._unstructured_container_cache[parent_fqn]
                container_fqn = fqn._build(  # pylint: disable=protected-access
                    *(
                        self.context.get().objectstore_service,
                        bucket_name,
                        *list_of_parent,
                    )
                )
                size = self.get_size(bucket_name, key)
                yield S3ContainerDetails(
                    name=list_of_parent[-1],
                    prefix=self._clean_path(parent_path + KEY_SEPARATOR),
                    file_formats=[],
                    size=size,
                    container_fqn=container_fqn,
                    leaf_container=True,
                    parent=EntityReference(id=parent_id, type="container"),
                    fullPath=self._get_full_path(bucket_name, key),
                    sourceUrl=self._get_object_source_url(
                        bucket_name=bucket_name,
                        prefix=self._clean_path(
                            parent_path + KEY_SEPARATOR + list_of_parent[-1]
                        ),
                    ),
                )

    def _generate_unstructured_containers(
        self,
        bucket_response: S3BucketResponse,
        entries: List[MetadataEntry],
        parent: Optional[EntityReference] = None,
    ) -> Iterable[S3ContainerDetails]:
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
                logger.info(
                    f"Extracting metadata from path {metadata_entry.dataPath.strip(KEY_SEPARATOR)} "
                    f"and generating unstructured container"
                )
                prefix = (
                    f"{KEY_SEPARATOR}{metadata_entry.dataPath.strip(KEY_SEPARATOR)}"
                )
                yield S3ContainerDetails(
                    name=metadata_entry.dataPath.strip(KEY_SEPARATOR),
                    prefix=prefix,
                    file_formats=[],
                    data_model=None,
                    parent=parent,
                    size=self.get_size(
                        bucket_name=bucket_name,
                        file_path=metadata_entry.dataPath.strip(KEY_SEPARATOR),
                    ),
                    fullPath=self._get_full_path(bucket_name, prefix),
                    sourceUrl=self._get_object_source_url(
                        bucket_name=bucket_name,
                        prefix=metadata_entry.dataPath.strip(KEY_SEPARATOR),
                    ),
                )

    def fetch_buckets(self) -> List[S3BucketResponse]:
        results: List[S3BucketResponse] = []
        try:
            if self.service_connection.bucketNames:
                return [
                    S3BucketResponse(Name=bucket_name)
                    for bucket_name in self.service_connection.bucketNames
                ]
            # No pagination required, as there is a hard 1000 limit on nr of buckets per aws account
            for bucket in self.s3_client.list_buckets().get("Buckets") or []:
                if filter_by_container(
                    self.source_config.containerFilterPattern,
                    container_name=bucket["Name"],
                ):
                    self.status.filter(bucket["Name"], "Bucket Filtered Out")
                else:
                    results.append(S3BucketResponse.model_validate(bucket))
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to fetch buckets list - {err}")
        return results

    def _fetch_metric(self, bucket_name: str, metric: S3Metric) -> float:
        try:
            raw_result = self.cloudwatch_client.get_metric_data(
                MetricDataQueries=[
                    {
                        "Id": "total_nr_of_object_request",
                        "MetricStat": {
                            "Metric": {
                                "Namespace": "AWS/S3",
                                "MetricName": metric.value,
                                "Dimensions": [
                                    {"Name": "BucketName", "Value": bucket_name},
                                    {
                                        "Name": "StorageType",
                                        # StandardStorage-only support for BucketSizeBytes for now
                                        "Value": "StandardStorage"
                                        if metric == S3Metric.BUCKET_SIZE_BYTES
                                        else "AllStorageTypes",
                                    },
                                ],
                            },
                            "Period": 60,
                            "Stat": "Average",
                            "Unit": "Bytes"
                            if metric == S3Metric.BUCKET_SIZE_BYTES
                            else "Count",
                        },
                    },
                ],
                StartTime=datetime.now() - timedelta(days=2),
                # metrics generated daily, ensure there is at least 1 entry
                EndTime=datetime.now(),
                ScanBy="TimestampDescending",
            )
            if raw_result["MetricDataResults"]:
                first_metric = raw_result["MetricDataResults"][0]
                if first_metric["StatusCode"] == "Complete" and first_metric["Values"]:
                    return int(first_metric["Values"][0])
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed fetching metric {metric.value} for bucket {bucket_name}, returning 0"
            )
        return 0

    def _generate_unstructured_container(
        self, bucket_response: S3BucketResponse
    ) -> S3ContainerDetails:
        return S3ContainerDetails(
            name=bucket_response.name,
            prefix=KEY_SEPARATOR,
            creation_date=bucket_response.creation_date.isoformat()
            if bucket_response.creation_date
            else None,
            number_of_objects=self._fetch_metric(
                bucket_name=bucket_response.name, metric=S3Metric.NUMBER_OF_OBJECTS
            ),
            size=self._fetch_metric(
                bucket_name=bucket_response.name, metric=S3Metric.BUCKET_SIZE_BYTES
            ),
            file_formats=[],
            data_model=None,
            fullPath=self._get_full_path(bucket_name=bucket_response.name),
            sourceUrl=self._get_bucket_source_url(bucket_name=bucket_response.name),
        )

    def _clean_path(self, path: str) -> str:
        return path.strip(KEY_SEPARATOR)

    def _get_full_path(self, bucket_name: str, prefix: str = None) -> Optional[str]:
        """
        Method to get the full path of the file
        """
        if bucket_name is None:
            return None

        full_path = f"s3://{self._clean_path(bucket_name)}"

        if prefix:
            full_path += f"/{self._clean_path(prefix)}"

        return full_path

    def _get_sample_file_path(
        self, bucket_name: str, metadata_entry: MetadataEntry
    ) -> Optional[str]:
        """
        Given a bucket and a metadata entry, returns the full path key to a file which can then be used to infer schema
        or None in the case of a non-structured metadata entry, or if no such keys can be found
        """
        prefix = self._get_sample_file_prefix(metadata_entry=metadata_entry)
        # this will look only in the first 1000 files under that path (default for list_objects_v2).
        # We'd rather not do pagination here as it would incur unwanted costs
        try:
            if prefix:
                response = self.s3_client.list_objects_v2(
                    Bucket=bucket_name, Prefix=prefix
                )
                candidate_keys = [
                    entry["Key"]
                    for entry in response[S3_CLIENT_ROOT_RESPONSE]
                    if entry and entry.get("Key") and not entry.get("Key").endswith("/")
                ]
                # pick a random key out of the candidates if any were returned
                if candidate_keys:
                    result_key = secrets.choice(candidate_keys)
                    logger.info(
                        f"File {result_key} was picked to infer data structure from."
                    )
                    return result_key
                logger.warning(
                    f"No sample files found in {prefix} with {metadata_entry.structureFormat} extension"
                )
            return None
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error when trying to list objects in S3 bucket {bucket_name} at prefix {prefix}"
            )
            return None

    def get_aws_bucket_region(self, bucket_name: str) -> str:
        """
        Method to fetch the bucket region
        """
        region = None
        try:
            region_resp = self.s3_client.get_bucket_location(Bucket=bucket_name)
            region = region_resp.get("LocationConstraint")
        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get the region for bucket: {bucket_name}")
        return region or self.service_connection.awsConfig.awsRegion

    def _get_bucket_source_url(self, bucket_name: str) -> Optional[str]:
        """
        Method to get the source url of s3 bucket
        """
        try:
            region = self.get_aws_bucket_region(bucket_name=bucket_name)
            return (
                f"https://s3.console.aws.amazon.com/s3/buckets/{bucket_name}"
                f"?region={region}&tab=objects"
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get source url: {exc}")
        return None

    def _get_object_source_url(self, bucket_name: str, prefix: str) -> Optional[str]:
        """
        Method to get the source url of s3 bucket
        """
        try:
            region = self.get_aws_bucket_region(bucket_name=bucket_name)
            return (
                f"https://s3.console.aws.amazon.com/s3/buckets/{bucket_name}"
                f"?region={region}&prefix={prefix}/"
                f"&showversions=false"
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get source url: {exc}")
        return None

    def _load_metadata_file(self, bucket_name: str) -> Optional[StorageContainerConfig]:
        """
        Load the metadata template file from the root of the bucket, if it exists
        """
        try:
            logger.info(
                f"Looking for metadata template file at - s3://{bucket_name}/{OPENMETADATA_TEMPLATE_FILE_NAME}"
            )
            response_object = self.s3_reader.read(
                path=OPENMETADATA_TEMPLATE_FILE_NAME,
                bucket_name=bucket_name,
                verbose=False,
            )
            content = json.loads(response_object)
            metadata_config = StorageContainerConfig.model_validate(content)
            return metadata_config
        except ReadException:
            logger.warning(
                f"No metadata file found at s3://{bucket_name}/{OPENMETADATA_TEMPLATE_FILE_NAME}"
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed loading metadata file s3://{bucket_name}/{OPENMETADATA_TEMPLATE_FILE_NAME}-{exc}"
            )
        return None
