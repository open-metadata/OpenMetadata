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

from typing import cast

from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.openlineage.models import TableDetails
from metadata.utils.logger import ingestion_logger

from .constants import (  # noqa: TID252
    DESTINATION_TYPE_LOOKUP,
    S3_CONNECTOR_TYPES,
    S3_DESTINATION_BUCKET_KEY,
    S3_DESTINATION_PATH_KEY,
    S3_SOURCE_BUCKET_KEY,
    SOURCE_TYPE_LOOKUP,
    TABLE_KEY_ALIASES,
    AirbyteSource,
)
from .models import AirbyteDestinationResponse, AirbyteSourceResponse, AirbyteStream  # noqa: TID252

logger = ingestion_logger()


def _table_details(name: str, schema: str | None, database: str | None) -> TableDetails:
    """
    Build a TableDetails whose levels may legitimately be absent.

    ``TableDetails.schema`` is typed ``str``, but a connector can report no schema at all
    (MongoDB with a null ``database_config``, BigQuery with no ``dataset_id``). Dropping the
    level is the correct answer there — ``table_fqn_candidates`` and ``_get_table_fqn`` decide
    what to do with it — so the value is passed through rather than invented.
    """
    return TableDetails(name=name, schema=cast("str", schema), database=database)


def service_supports_database(metadata: OpenMetadata, service_name: str) -> bool | None:
    """
    Return whether a database service models a real database level in its table FQN:
    True for multi-database, False for single-database, None when the service cannot be
    read and the caller should try both shapes.

    Multi-database services (Postgres, BigQuery, Snowflake, Redshift, MSSQL) declare
    ``supportsDatabase``/``database`` in their connection JSON Schema and ingest as
    ``service.database.schema.table``. Single-database services (MySQL, ClickHouse,
    Oracle) declare neither and ingest under a synthetic ``default`` database (see
    ``common_db_source.get_database_names``), so what Airbyte calls their "database" is
    really the OpenMetadata schema.

    The check is on field *presence*, not value. A connection the server returns with
    ``supportsDatabase`` nulled (verified: ``PostgresConnection(supportsDatabase=None)`` is
    valid and falsy) would be classified single-database by a truthiness test, and BigQuery
    declares ``supportsDatabase`` while declaring no ``database`` field at all.
    """
    service = metadata.get_by_name(entity=DatabaseService, fqn=service_name)
    config = service.connection.config if service and service.connection else None
    model_fields = getattr(type(config), "model_fields", None)
    # A masked or absent connection says nothing about the service's class, so it stays
    # undecided rather than defaulting to single-database and dropping the database level.
    if not model_fields:
        return None
    return "supportsDatabase" in model_fields or "database" in model_fields


def table_fqn_candidates(details: TableDetails, supports_database: bool | None) -> list[TableDetails]:
    """
    The FQN shapes to try for a table, most specific first.

    Airbyte reports one "database" value whose OpenMetadata level depends on the target
    service class, so a single-database service needs that value in the schema slot. An
    undecided service tries both rather than guessing.
    """
    candidates = []
    if supports_database is not False and details.database:
        candidates.append(details)
    if supports_database is not True:
        # Never a duplicate of the shape above: that one is only added when it carries a
        # database, and this one drops the level entirely.
        candidates.append(_table_details(details.name, details.schema or details.database, None))
    return candidates


def get_source_table_details(stream: AirbyteStream, source_connection: AirbyteSourceResponse) -> TableDetails | None:
    """
    Get the source table details, as the connector reports them.

    ``database``/``schema`` here are Airbyte's levels; which OpenMetadata level each maps to
    is decided by ``table_fqn_candidates`` from the target service class.
    """
    source_config = source_connection.resolved_configuration
    source_type = SOURCE_TYPE_LOOKUP.get(source_connection.resolved_type or "")

    if source_type is None:
        # Expected branch, not an error: the caller then tries object-store and API resolution.
        logger.debug(
            "Airbyte source [%s] is not a relational table; trying object-store / API resolution",
            source_connection.resolved_type,
        )
        return None

    if source_type == AirbyteSource.MONGODB:
        # A key-shape difference, not a level one: database_config may be absent or
        # explicitly None on the public-API shape.
        return _table_details(stream.name, (source_config.get("database_config") or {}).get("database"), None)

    # Relational sources carry the schema on the stream, not the connection, so the generic
    # schema key is empty (``dict.get("")`` is None); only aliased connectors (BigQuery's
    # dataset_id) declare one in the config.
    database_key, schema_key = TABLE_KEY_ALIASES.get(source_type.value, ("database", ""))
    return _table_details(
        stream.name,
        source_config.get(schema_key) or stream.namespace,
        source_config.get(database_key),
    )


def is_object_store_connector(resolved_type: str | None) -> bool:
    """
    Whether the connector reads from or writes to an object store rather than a database.
    """
    return (resolved_type or "") in S3_CONNECTOR_TYPES


def _build_s3_uri(bucket_name: str | None, *segments: str | None) -> str | None:
    """
    Join a bucket and path segments into a canonical ``s3://`` URI with no trailing slash.
    """
    if not bucket_name:
        return None
    parts = [str(segment).strip("/") for segment in segments if segment]
    return "/".join([f"s3://{bucket_name.strip('/')}", *[part for part in parts if part]])


def get_source_container_path(stream: AirbyteStream, source_connection: AirbyteSourceResponse) -> str | None:
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
) -> str | None:
    """
    Build the S3 URI an object-store destination writes a stream to.

    Airbyte's default ``s3_path_format`` is ``${NAMESPACE}/${STREAM_NAME}/...``, so streams
    land under ``s3://<bucket>/<bucket_path>/<namespace>/<stream>``. A custom path format is
    absorbed by the caller's walk up the prefix tree rather than parsed here. Returns None
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

    return _build_s3_uri(bucket_name, destination_config.get(S3_DESTINATION_PATH_KEY), stream.namespace, stream.name)


def get_destination_table_details(
    stream: AirbyteStream, destination_connection: AirbyteDestinationResponse
) -> TableDetails | None:
    """
    Get the destination table details, as the connector reports them.

    Same contract as ``get_source_table_details``: the levels are Airbyte's, and
    ``table_fqn_candidates`` maps them onto OpenMetadata's.
    """
    destination_config = destination_connection.resolved_configuration
    destination_type = DESTINATION_TYPE_LOOKUP.get(destination_connection.resolved_type or "")

    if destination_type is None:
        # Expected branch, not an error: the caller then tries object-store resolution.
        logger.debug(
            "Airbyte destination [%s] is not a relational table; trying object-store resolution",
            destination_connection.resolved_type,
        )
        return None

    database_key, schema_key = TABLE_KEY_ALIASES.get(destination_type.value, ("database", "schema"))
    return _table_details(stream.name, destination_config.get(schema_key), destination_config.get(database_key))
