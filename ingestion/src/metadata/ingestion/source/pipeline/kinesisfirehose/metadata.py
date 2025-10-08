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
Kinesis Firehose pipeline source to extract metadata
"""

import re
import time
import traceback
from typing import Any, Callable, Iterable, Optional, TypeVar

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.searchIndex import SearchIndex
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.pipeline.kinesisFirehoseConnection import (
    KinesisFirehoseConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
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
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.kinesisfirehose.models import (
    DeliveryStreamResponse,
    ListDeliveryStreamsResponse,
)
from metadata.ingestion.source.pipeline.pipeline_service import PipelineServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

NAME = "DeliveryStreamName"
DYNAMODB_STREAM_ARN_PATTERN = (
    r"arn:aws:dynamodb:([^:]+):([^:]+):table/([^/]+)/stream/.*"
)

T = TypeVar("T")


def retry_on_throttle(func: Callable[..., T], max_retries: int = 3) -> Callable[..., T]:
    """
    Decorator to retry AWS API calls with exponential backoff on throttling errors.
    Handles common AWS throttling exceptions and rate limits.
    """

    def wrapper(*args, **kwargs) -> T:
        retries = 0
        base_delay = 1

        while retries < max_retries:
            try:
                return func(*args, **kwargs)
            except Exception as exc:
                error_code = getattr(exc, "response", {}).get("Error", {}).get("Code")

                if error_code in [
                    "ThrottlingException",
                    "Throttling",
                    "TooManyRequestsException",
                    "ProvisionedThroughputExceededException",
                    "RequestLimitExceeded",
                ]:
                    retries += 1
                    if retries >= max_retries:
                        logger.error(
                            f"Max retries ({max_retries}) exceeded for {func.__name__}: {exc}"
                        )
                        raise

                    delay = base_delay * (2 ** (retries - 1))
                    logger.warning(
                        f"Throttled on {func.__name__}, retrying in {delay}s (attempt {retries}/{max_retries})"
                    )
                    time.sleep(delay)
                else:
                    raise

        return func(*args, **kwargs)

    return wrapper


class FirehoseSource(PipelineServiceSource):
    """
    Implements the necessary methods to extract
    Pipeline metadata from Kinesis Firehose
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.firehose = self.connection

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: KinesisFirehoseConnection = config.serviceConnection.root.config
        if not isinstance(connection, KinesisFirehoseConnection):
            raise InvalidSourceException(
                f"Expected KinesisFirehoseConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_pipelines_list(self) -> Iterable[dict]:
        try:
            has_more = True
            exclusive_start_stream_name = None

            while has_more:
                kwargs = {"Limit": 100}
                if exclusive_start_stream_name:
                    kwargs[
                        "ExclusiveStartDeliveryStreamName"
                    ] = exclusive_start_stream_name

                response = retry_on_throttle(self.firehose.list_delivery_streams)(
                    **kwargs
                )
                streams_response = ListDeliveryStreamsResponse.model_validate(response)

                for stream_name in streams_response.DeliveryStreamNames:
                    try:
                        stream_details = retry_on_throttle(
                            self.firehose.describe_delivery_stream
                        )(DeliveryStreamName=stream_name)
                        delivery_stream = DeliveryStreamResponse.model_validate(
                            stream_details
                        )
                        yield delivery_stream.DeliveryStreamDescription.model_dump()
                    except Exception as exc:
                        logger.debug(traceback.format_exc())
                        logger.warning(
                            f"Failed to get details for stream {stream_name}: {exc}"
                        )

                has_more = streams_response.HasMoreDeliveryStreams
                if has_more and streams_response.DeliveryStreamNames:
                    exclusive_start_stream_name = streams_response.DeliveryStreamNames[
                        -1
                    ]
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to list delivery streams: {exc}")

    def get_pipeline_name(self, pipeline_details: dict) -> str:
        return pipeline_details.get("DeliveryStreamName", "")

    def yield_pipeline(
        self, pipeline_details: Any
    ) -> Iterable[Either[CreatePipelineRequest]]:
        try:
            stream_name = pipeline_details.get("DeliveryStreamName")
            source_url = SourceUrl(
                f"https://{self.service_connection.awsConfig.awsRegion}.console.aws.amazon.com/firehose/home?"
                f"region={self.service_connection.awsConfig.awsRegion}#/details/{stream_name}"
            )

            pipeline_request = CreatePipelineRequest(
                name=EntityName(stream_name),
                displayName=stream_name,
                description=f"Firehose delivery stream: {pipeline_details.get('DeliveryStreamType', 'Unknown')}",
                service=FullyQualifiedEntityName(self.context.get().pipeline_service),
                sourceUrl=source_url,
            )
            yield Either(right=pipeline_request)
            self.register_record(pipeline_request=pipeline_request)

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.get("DeliveryStreamName", "unknown"),
                    error=f"Failed to yield pipeline: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _extract_dynamodb_table_from_stream_arn(self, stream_arn: str) -> Optional[str]:
        """
        Extract DynamoDB table name from stream ARN using AWS ARN structure.
        ARN format: arn:aws:dynamodb:region:account:table/TableName/stream/...
        """
        try:
            if not stream_arn.startswith("arn:aws:dynamodb:"):
                return None

            parts = stream_arn.split(":")
            if len(parts) < 6:
                return None

            resource_part = ":".join(parts[5:])
            resource_components = resource_part.split("/")

            if len(resource_components) >= 2 and resource_components[0] == "table":
                return resource_components[1]
        except Exception as exc:
            logger.debug(f"Failed to parse DynamoDB ARN {stream_arn}: {exc}")

        return None

    def _find_dynamodb_table_entity(self, table_name: str) -> Optional[EntityReference]:
        """
        Search for DynamoDB table across database services and namespaces.
        Tries multiple common namespace patterns to handle different configurations.
        """
        for db_service_name in self.get_db_service_names():
            namespace_combinations = [
                ("default", "default"),
                (table_name, "default"),
                ("dynamodb", "default"),
                ("default", table_name),
            ]

            for database, schema in namespace_combinations:
                try:
                    entity = self.metadata.get_entity_reference(
                        entity=Table,
                        fqn=fqn.build(
                            metadata=self.metadata,
                            entity_type=Table,
                            table_name=table_name,
                            database_name=database,
                            schema_name=schema,
                            service_name=db_service_name,
                        ),
                    )
                    if entity:
                        logger.info(
                            f"Found DynamoDB table: {entity.fullyQualifiedName}"
                        )
                        return entity
                except Exception as exc:
                    logger.debug(
                        f"Table not found at {db_service_name}.{database}.{schema}.{table_name}: {exc}"
                    )
                    continue

        return None

    def _get_s3_path_from_destination(self, pipeline_details: dict) -> Optional[str]:
        """
        Extract S3 path from destination configuration with robust ARN parsing.
        Handles both S3DestinationDescription and ExtendedS3DestinationDescription.
        """
        s3_dest = pipeline_details.get(
            "S3DestinationDescription"
        ) or pipeline_details.get("ExtendedS3DestinationDescription")

        if not s3_dest:
            return None

        bucket_arn = s3_dest.get("BucketARN", "")

        if not bucket_arn:
            logger.warning("S3 destination found but BucketARN is missing")
            return None

        if bucket_arn.startswith("arn:aws:s3:::"):
            bucket_name = bucket_arn.replace("arn:aws:s3:::", "")
        elif bucket_arn.startswith("arn:"):
            logger.warning(f"Unexpected S3 bucket ARN format: {bucket_arn}")
            return None
        else:
            bucket_name = bucket_arn

        if not bucket_name:
            return None

        prefix = s3_dest.get("Prefix", "").rstrip("/")

        return f"s3://{bucket_name}/{prefix}/" if prefix else f"s3://{bucket_name}/"

    def _find_redshift_table_entity(
        self, jdbc_url: str, table_name: str
    ) -> Optional[EntityReference]:
        """
        Find Redshift table entity from JDBC URL and table name.
        JDBC URL format: jdbc:redshift://cluster.region.redshift.amazonaws.com:5439/database
        """
        try:
            jdbc_pattern = r"jdbc:(?:redshift|postgresql)://[^/]+/([^?]+)"
            match = re.match(jdbc_pattern, jdbc_url)
            if not match:
                logger.warning(f"Could not parse database from JDBC URL: {jdbc_url}")
                return None

            database_name = match.group(1)

            for db_service_name in self.get_db_service_names():
                schema_combinations = ["public", "default", table_name]

                for schema in schema_combinations:
                    try:
                        entity = self.metadata.get_entity_reference(
                            entity=Table,
                            fqn=fqn.build(
                                metadata=self.metadata,
                                entity_type=Table,
                                table_name=table_name,
                                database_name=database_name,
                                schema_name=schema,
                                service_name=db_service_name,
                            ),
                        )
                        if entity:
                            logger.info(
                                f"Found Redshift table: {entity.fullyQualifiedName}"
                            )
                            return entity
                    except Exception as exc:
                        logger.debug(
                            f"Table not found at {db_service_name}.{database_name}.{schema}.{table_name}: {exc}"
                        )
                        continue

        except Exception as exc:
            logger.debug(f"Failed to find Redshift table entity: {exc}")

        return None

    def _find_opensearch_index_entity(
        self, index_name: str
    ) -> Optional[EntityReference]:
        """
        Find OpenSearch/Elasticsearch index entity.
        """
        try:
            search_services = self.metadata.list_all_entities(
                entity=SearchIndex, fields=["service"]
            )
            service_names = {
                service.service.name for service in search_services if service.service
            }

            for search_service_name in service_names:
                try:
                    entity = self.metadata.get_entity_reference(
                        entity=SearchIndex,
                        fqn=f"{search_service_name}.{index_name}",
                    )
                    if entity:
                        logger.info(
                            f"Found OpenSearch index: {entity.fullyQualifiedName}"
                        )
                        return entity
                except Exception as exc:
                    logger.debug(
                        f"Index not found at {search_service_name}.{index_name}: {exc}"
                    )
                    continue

        except Exception as exc:
            logger.debug(f"Failed to find OpenSearch index entity: {exc}")

        return None

    def _find_snowflake_table_entity(
        self, database: str, schema: str, table: str
    ) -> Optional[EntityReference]:
        """
        Find Snowflake table entity using database, schema, and table names.
        """
        try:
            for db_service_name in self.get_db_service_names():
                try:
                    entity = self.metadata.get_entity_reference(
                        entity=Table,
                        fqn=fqn.build(
                            metadata=self.metadata,
                            entity_type=Table,
                            table_name=table,
                            database_name=database,
                            schema_name=schema,
                            service_name=db_service_name,
                        ),
                    )
                    if entity:
                        logger.info(
                            f"Found Snowflake table: {entity.fullyQualifiedName}"
                        )
                        return entity
                except Exception as exc:
                    logger.debug(
                        f"Table not found at {db_service_name}.{database}.{schema}.{table}: {exc}"
                    )
                    continue

        except Exception as exc:
            logger.debug(f"Failed to find Snowflake table entity: {exc}")

        return None

    def _extract_s3_container_from_destination(
        self, pipeline_details: dict
    ) -> Optional[EntityReference]:
        """
        Extract S3 container entity from destination configuration.
        """
        s3_path = self._get_s3_path_from_destination(pipeline_details)
        if s3_path:
            containers = self.metadata.es_search_container_by_path(full_path=s3_path)
            if containers and containers[0]:
                return EntityReference(
                    id=containers[0].id,
                    type="container",
                    name=containers[0].name.root,
                    fullyQualifiedName=containers[0].fullyQualifiedName.root,
                )
        return None

    def _create_column_lineage(
        self, source_entity: EntityReference, target_entity: EntityReference
    ) -> Optional[list[ColumnLineage]]:
        """
        Create column-level lineage by matching column names between source and destination.
        Since Firehose doesn't transform data, we match columns by name (case-insensitive).
        """
        try:
            source_full = self.metadata.get_by_name(
                entity=Table, fqn=source_entity.fullyQualifiedName, fields=["columns"]
            )
            if not source_full or not source_full.columns:
                logger.debug(
                    f"No columns found for source entity: {source_entity.fullyQualifiedName}"
                )
                return None

            if target_entity.type == "table":
                target_full = self.metadata.get_by_name(
                    entity=Table,
                    fqn=target_entity.fullyQualifiedName,
                    fields=["columns"],
                )
            elif target_entity.type == "searchIndex":
                target_full = self.metadata.get_by_name(
                    entity=SearchIndex,
                    fqn=target_entity.fullyQualifiedName,
                    fields=["fields"],
                )
            else:
                logger.debug(
                    f"Column lineage not supported for target type: {target_entity.type}"
                )
                return None

            if not target_full:
                logger.debug(
                    f"Target entity not found: {target_entity.fullyQualifiedName}"
                )
                return None

            target_columns = (
                target_full.columns
                if hasattr(target_full, "columns")
                else target_full.fields
            )
            if not target_columns:
                logger.debug(
                    f"No columns found for target entity: {target_entity.fullyQualifiedName}"
                )
                return None

            source_col_map = {
                col.name.root.lower(): col.fullyQualifiedName.root
                for col in source_full.columns
            }

            column_lineages = []
            for target_col in target_columns:
                target_col_name = target_col.name.root.lower()
                if target_col_name in source_col_map:
                    column_lineages.append(
                        ColumnLineage(
                            fromColumns=[source_col_map[target_col_name]],
                            toColumn=target_col.fullyQualifiedName.root,
                        )
                    )

            if column_lineages:
                logger.info(
                    f"Created {len(column_lineages)} column lineage mappings between "
                    f"{source_entity.fullyQualifiedName} and {target_entity.fullyQualifiedName}"
                )
                return column_lineages
            else:
                logger.warning(
                    f"No matching columns found between {source_entity.fullyQualifiedName} "
                    f"and {target_entity.fullyQualifiedName}"
                )
                return None

        except Exception as exc:
            logger.debug(f"Failed to create column lineage: {exc}")
            return None

    def yield_pipeline_status(self, pipeline_details: Any) -> Iterable[Either]:
        """
        Firehose is a streaming delivery service without discrete job runs,
        so we don't yield pipeline status.
        """
        return iter([])

    def yield_pipeline_lineage_details(
        self, pipeline_details: Any
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Get lineage from source (DynamoDB) through Firehose pipeline to destinations
        (S3, Redshift, OpenSearch, Snowflake, MongoDB)
        """
        try:
            pipeline_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=Pipeline,
                service_name=self.context.get().pipeline_service,
                pipeline_name=self.context.get().pipeline,
            )

            pipeline_entity = self.metadata.get_by_name(
                entity=Pipeline, fqn=pipeline_fqn
            )

            if not pipeline_entity:
                logger.warning(f"Pipeline entity not found: {pipeline_fqn}")
                return

            lineage_details = LineageDetails(
                pipeline=EntityReference(id=pipeline_entity.id.root, type="pipeline"),
                source=LineageSource.PipelineLineage,
            )

            source_entity = None
            target_entity = None

            kinesis_source_config = pipeline_details.get(
                "KinesisStreamSourceConfiguration"
            )
            if kinesis_source_config:
                stream_arn = kinesis_source_config.get("KinesisStreamARN", "")

                if "dynamodb" in stream_arn.lower():
                    table_name = self._extract_dynamodb_table_from_stream_arn(
                        stream_arn
                    )
                    if table_name:
                        source_entity = self._find_dynamodb_table_entity(table_name)
                        if source_entity:
                            logger.info(
                                f"Found DynamoDB source entity: {source_entity.fullyQualifiedName}"
                            )

            redshift_dest = pipeline_details.get("RedshiftDestinationDescription")
            if redshift_dest:
                jdbc_url = redshift_dest.get("ClusterJDBCURL")
                copy_command = redshift_dest.get("CopyCommand", {})
                table_name = copy_command.get("DataTableName")

                if jdbc_url and table_name:
                    target_entity = self._find_redshift_table_entity(
                        jdbc_url, table_name
                    )
                    if target_entity:
                        logger.info(
                            f"Found Redshift target entity: {target_entity.fullyQualifiedName}"
                        )
                    else:
                        logger.warning(
                            f"Redshift destination configured but table not found in OpenMetadata: {table_name}"
                        )

            elif pipeline_details.get("AmazonopensearchserviceDestinationDescription"):
                opensearch_dest = pipeline_details.get(
                    "AmazonopensearchserviceDestinationDescription"
                )
                index_name = opensearch_dest.get("IndexName")
                if index_name:
                    target_entity = self._find_opensearch_index_entity(index_name)
                    if target_entity:
                        logger.info(
                            f"Found OpenSearch target entity: {target_entity.fullyQualifiedName}"
                        )
                    else:
                        logger.warning(
                            f"OpenSearch destination configured but index not found in OpenMetadata: {index_name}"
                        )

            elif pipeline_details.get("SnowflakeDestinationDescription"):
                snowflake_dest = pipeline_details.get("SnowflakeDestinationDescription")
                database = snowflake_dest.get("Database")
                schema = snowflake_dest.get("Schema")
                table = snowflake_dest.get("Table")

                if database and schema and table:
                    target_entity = self._find_snowflake_table_entity(
                        database, schema, table
                    )
                    if target_entity:
                        logger.info(
                            f"Found Snowflake target entity: {target_entity.fullyQualifiedName}"
                        )
                    else:
                        logger.warning(
                            f"Snowflake destination configured but table not found in OpenMetadata: {database}.{schema}.{table}"
                        )

            elif pipeline_details.get("HttpEndpointDestinationDescription"):
                http_dest = pipeline_details.get("HttpEndpointDestinationDescription")
                endpoint_config = http_dest.get("EndpointConfiguration", {})
                endpoint_url = endpoint_config.get("Url", "")
                endpoint_name = endpoint_config.get("Name", "")

                if (
                    "mongodb" in endpoint_url.lower()
                    or "mongodb" in endpoint_name.lower()
                ):
                    logger.warning(
                        "MongoDB HTTP endpoint detected, but lineage to MongoDB is not yet supported. "
                        "Please configure MongoDB connector in OpenMetadata to enable lineage."
                    )

            elif pipeline_details.get(
                "S3DestinationDescription"
            ) or pipeline_details.get("ExtendedS3DestinationDescription"):
                target_entity = self._extract_s3_container_from_destination(
                    pipeline_details
                )
                if target_entity:
                    logger.info(
                        f"Found S3 target entity: {target_entity.fullyQualifiedName}"
                    )
                else:
                    s3_path = self._get_s3_path_from_destination(pipeline_details)
                    logger.warning(
                        f"S3 destination configured but container not found in OpenMetadata: {s3_path}"
                    )

            if source_entity and target_entity:
                column_lineages = self._create_column_lineage(
                    source_entity, target_entity
                )
                if column_lineages:
                    lineage_details.columnsLineage = column_lineages

                yield Either(
                    right=AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=source_entity,
                            toEntity=target_entity,
                            lineageDetails=lineage_details,
                        )
                    )
                )
            else:
                if not source_entity:
                    logger.warning(
                        f"Source entity not found for stream: {pipeline_details.get('DeliveryStreamName')}"
                    )
                if not target_entity:
                    logger.warning(
                        f"Target entity not found for stream: {pipeline_details.get('DeliveryStreamName')}"
                    )

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=pipeline_details.get("DeliveryStreamName", "unknown"),
                    error=f"Failed to yield pipeline lineage: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
