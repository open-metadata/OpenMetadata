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
Utils for Airbyte
"""

from typing import Optional

from metadata.ingestion.source.pipeline.openlineage.models import TableDetails
from metadata.utils.logger import ingestion_logger

from .constants import (  # noqa: TID252
    DESTINATION_TYPE_LOOKUP,
    S3_CONNECTOR_TYPES,
    S3_DESTINATION_BUCKET_KEY,
    S3_DESTINATION_PATH_KEY,
    S3_SOURCE_BUCKET_KEY,
    SOURCE_TYPE_LOOKUP,
    AirbyteDestination,
    AirbyteSource,
)
from .models import AirbyteDestinationResponse, AirbyteSourceResponse, AirbyteStream  # noqa: TID252

logger = ingestion_logger()


def get_source_table_details(stream: AirbyteStream, source_connection: AirbyteSourceResponse) -> Optional[TableDetails]:  # noqa: UP045
    """
    Get the source table details
    """
    source_config = source_connection.resolved_configuration
    source_type = SOURCE_TYPE_LOOKUP.get(source_connection.resolved_type or "")
    source_database = source_config.get("database")
    source_schema = stream.namespace

    if source_type is None:
        logger.warning(
            f"Lineage of airbyte pipeline with source [{source_connection.resolved_type}] is not supported yet"
        )
        return None

    if source_type == AirbyteSource.MYSQL:
        source_schema = source_database
        source_database = None
    elif source_type == AirbyteSource.MONGODB:
        # database_config may be absent or explicitly None on the public-API shape
        source_schema = (source_config.get("database_config") or {}).get("database")
        source_database = None

    return TableDetails(
        name=stream.name,
        schema=source_schema,
        database=source_database,
    )


def is_object_store_connector(resolved_type: Optional[str]) -> bool:  # noqa: UP045
    """
    Whether the connector reads from or writes to an object store rather than a database.
    """
    return (resolved_type or "") in S3_CONNECTOR_TYPES


def _build_s3_uri(bucket_name: Optional[str], *segments: Optional[str]) -> Optional[str]:  # noqa: UP045
    """
    Join a bucket and path segments into a canonical ``s3://`` URI with no trailing slash.
    """
    if not bucket_name:
        return None
    parts = [str(segment).strip("/") for segment in segments if segment]
    return "/".join([f"s3://{bucket_name.strip('/')}", *[part for part in parts if part]])


def get_source_container_path(stream: AirbyteStream, source_connection: AirbyteSourceResponse) -> Optional[str]:  # noqa: UP045
    """
    Build the S3 URI an object-store source reads a stream from.

    The S3 source scopes each stream with per-stream ``globs`` rather than a single
    prefix, so lineage anchors on the bucket. Returns None for non-object-store sources
    so the caller can fall back to table lineage.
    """
    if not is_object_store_connector(source_connection.resolved_type):
        return None

    bucket_name = source_connection.resolved_configuration.get(S3_SOURCE_BUCKET_KEY)
    if not bucket_name:
        logger.warning(
            "Airbyte S3 source [%s] has no %s; cannot resolve storage lineage",
            source_connection.resolved_type,
            S3_SOURCE_BUCKET_KEY,
        )
        return None

    return _build_s3_uri(bucket_name)


def get_destination_container_path(
    stream: AirbyteStream, destination_connection: AirbyteDestinationResponse
) -> Optional[str]:  # noqa: UP045
    """
    Build the S3 URI an object-store destination writes a stream to.

    Airbyte lays streams out as ``s3://<bucket>/<bucket_path>/<stream>``. Returns None
    for non-object-store destinations so the caller can fall back to table lineage.
    """
    if not is_object_store_connector(destination_connection.resolved_type):
        return None

    destination_config = destination_connection.resolved_configuration
    bucket_name = destination_config.get(S3_DESTINATION_BUCKET_KEY)
    if not bucket_name:
        logger.warning(
            "Airbyte S3 destination [%s] has no %s; cannot resolve storage lineage",
            destination_connection.resolved_type,
            S3_DESTINATION_BUCKET_KEY,
        )
        return None

    return _build_s3_uri(bucket_name, destination_config.get(S3_DESTINATION_PATH_KEY), stream.name)


def get_destination_table_details(
    stream: AirbyteStream, destination_connection: AirbyteDestinationResponse
) -> Optional[TableDetails]:  # noqa: UP045
    """
    Get the destination table details
    """
    destination_config = destination_connection.resolved_configuration
    destination_type = DESTINATION_TYPE_LOOKUP.get(destination_connection.resolved_type or "")
    destination_database = destination_config.get("database")
    destination_schema = destination_config.get("schema")

    if destination_type is None:
        logger.warning(
            f"Lineage of airbyte pipeline with destination [{destination_connection.resolved_type}] is not supported yet"
        )
        return None

    if destination_type == AirbyteDestination.MYSQL:
        destination_schema = destination_database
        destination_database = None

    return TableDetails(
        name=stream.name,
        schema=destination_schema,
        database=destination_database,
    )
