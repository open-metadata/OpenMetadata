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
Constants for Airbyte
"""

from enum import Enum


class AirbyteSource(Enum):
    MYSQL = "MySQL"
    POSTGRES = "Postgres"
    MSSQL = "Microsoft SQL Server (MSSQL)"
    MONGODB = "MongoDb"
    REDSHIFT = "Redshift"
    CLICKHOUSE = "ClickHouse"
    SNOWFLAKE = "Snowflake"
    BIGQUERY = "BigQuery"
    ORACLE = "Oracle DB"


class AirbyteDestination(Enum):
    MYSQL = "MySQL"
    POSTGRES = "Postgres"
    MSSQL = "MS SQL Server"
    REDSHIFT = "Redshift"
    CLICKHOUSE = "ClickHouse"
    SNOWFLAKE = "Snowflake"
    BIGQUERY = "BigQuery"
    ORACLE = "Oracle"


# The internal API reports connector types as display names (e.g. "Postgres"),
# while the public API (`api/public/v1`) reports them as slugs (e.g. "postgres").
# These maps let lineage resolution accept either form.
SOURCE_TYPE_LOOKUP = {
    AirbyteSource.MYSQL.value: AirbyteSource.MYSQL,
    "mysql": AirbyteSource.MYSQL,
    AirbyteSource.POSTGRES.value: AirbyteSource.POSTGRES,
    "postgres": AirbyteSource.POSTGRES,
    AirbyteSource.MSSQL.value: AirbyteSource.MSSQL,
    "mssql": AirbyteSource.MSSQL,
    AirbyteSource.MONGODB.value: AirbyteSource.MONGODB,
    "mongodb": AirbyteSource.MONGODB,
    "mongodb-v2": AirbyteSource.MONGODB,
    # Warehouses that expose a top-level `database` (schema comes from the stream
    # namespace), so they resolve through the default table-detail path.
    AirbyteSource.REDSHIFT.value: AirbyteSource.REDSHIFT,
    "redshift": AirbyteSource.REDSHIFT,
    AirbyteSource.CLICKHOUSE.value: AirbyteSource.CLICKHOUSE,
    "clickhouse": AirbyteSource.CLICKHOUSE,
    # Mainstream warehouses are mapped so they resolve as tables (or safely yield no
    # lineage) instead of falling through to the API resolver. BigQuery/Oracle use the
    # default database+namespace parse; per-connector field mapping (BigQuery project_id)
    # is deliberately left until there is a live connection to verify it against.
    AirbyteSource.SNOWFLAKE.value: AirbyteSource.SNOWFLAKE,
    "snowflake": AirbyteSource.SNOWFLAKE,
    AirbyteSource.BIGQUERY.value: AirbyteSource.BIGQUERY,
    "bigquery": AirbyteSource.BIGQUERY,
    AirbyteSource.ORACLE.value: AirbyteSource.ORACLE,
    "oracle": AirbyteSource.ORACLE,
}

DESTINATION_TYPE_LOOKUP = {
    AirbyteDestination.MYSQL.value: AirbyteDestination.MYSQL,
    "mysql": AirbyteDestination.MYSQL,
    AirbyteDestination.POSTGRES.value: AirbyteDestination.POSTGRES,
    "postgres": AirbyteDestination.POSTGRES,
    AirbyteDestination.MSSQL.value: AirbyteDestination.MSSQL,
    "mssql": AirbyteDestination.MSSQL,
    # Warehouses expose top-level `database` + `schema`, mapping straight to the
    # OM table FQN through the default destination table-detail path.
    AirbyteDestination.REDSHIFT.value: AirbyteDestination.REDSHIFT,
    "redshift": AirbyteDestination.REDSHIFT,
    AirbyteDestination.CLICKHOUSE.value: AirbyteDestination.CLICKHOUSE,
    "clickhouse": AirbyteDestination.CLICKHOUSE,
    # See SOURCE_TYPE_LOOKUP note — mapped so warehouses never route to the API resolver.
    AirbyteDestination.SNOWFLAKE.value: AirbyteDestination.SNOWFLAKE,
    "snowflake": AirbyteDestination.SNOWFLAKE,
    AirbyteDestination.BIGQUERY.value: AirbyteDestination.BIGQUERY,
    "bigquery": AirbyteDestination.BIGQUERY,
    AirbyteDestination.ORACLE.value: AirbyteDestination.ORACLE,
    "oracle": AirbyteDestination.ORACLE,
}

# Connectors that name the two table-FQN levels differently from the generic
# ``database``/``schema`` keys. Keyed on the connector display name, which is identical for
# the source and destination enums. ``(database_key, schema_key)``.
TABLE_KEY_ALIASES = {
    AirbyteSource.BIGQUERY.value: ("project_id", "dataset_id"),
}

# Object-store connectors map to a Container, not a Table, so they are resolved by path
# rather than through the TYPE_LOOKUP maps. Holds the connector display name ("S3", as
# the internal API reports it) and the public-API slug ("s3").
# S3 only — GCS/Azure use different config keys and URI schemes; they are deliberately left
# out until there is a real connection to test a scheme lookup against.
S3_CONNECTOR_TYPES = frozenset({"S3", "s3"})

# The S3 source and destination connectors name their bucket/prefix fields differently.
S3_SOURCE_BUCKET_KEY = "bucket"
S3_DESTINATION_BUCKET_KEY = "s3_bucket_name"
S3_DESTINATION_PATH_KEY = "s3_bucket_path"

# Message-queue connectors resolve to a Topic and search connectors to a SearchIndex,
# both keyed on the stream name. Each frozenset holds the internal-API display name and
# the public-API slug. Kept small on purpose — add a type (e.g. "Google PubSub") once
# there is a live connection to confirm its reported type string.
MESSAGING_CONNECTOR_TYPES = frozenset({"Kafka", "kafka"})

# The Kafka destination names each topic from a free-form template over ``{namespace}`` and
# ``{stream}`` (destination-kafka 0.1.11 declares no default), so the topic is only the stream
# name when the user wrote it that way.
KAFKA_TOPIC_PATTERN_KEY = "topic_pattern"
SEARCH_CONNECTOR_TYPES = frozenset({"Elasticsearch", "ElasticSearch", "elasticsearch"})

# Both ambiguity guards (same-named API collections, same-path containers) decide a match is
# safe only when exactly one candidate survives filtering. The ometa search helpers default to
# `size=10`, which would let an 11th same-named entity fall off the page and turn a genuinely
# ambiguous match into a confident wrong edge. Ask for more than any real catalog holds and
# treat a full page as proof the answer cannot be trusted.
ES_MATCH_LIMIT = 100

# Connection-level destination naming. `source` and `destination` are spelled the same on both
# APIs; the custom-format value is not -- the public API's NamespaceDefinitionEnum calls it
# `custom_format` while the internal config API's NamespaceDefinitionType calls it
# `customformat`, so both are accepted. `destination` is the default on both.
NAMESPACE_SOURCE = "source"
NAMESPACE_DESTINATION = "destination"
NAMESPACE_CUSTOM_FORMATS = frozenset({"custom_format", "customformat"})
SOURCE_NAMESPACE_TOKEN = "${SOURCE_NAMESPACE}"
