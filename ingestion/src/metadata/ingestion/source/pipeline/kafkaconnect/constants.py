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
Constants for Kafka Connect connector configuration keys and mappings
"""

# Re-exported so existing kafkaconnect imports keep working
from metadata.ingestion.lineage.topic_lineage import CDC_ENVELOPE_FIELDS  # noqa: F401


class ConnectorConfigKeys:
    """Configuration keys for various Kafka Connect connectors"""

    TABLE_KEYS = [  # noqa: RUF012
        "table",  # Generic: Often used in simple JDBC source/sink configs
        "table.name.format",  # JDBC Sink: Defines the target table name (e.g., "kafka_${topic}")
        "collection",  # MongoDB: The Mongo equivalent of a Table
        "sanitizeTopics",  # BigQuery: Often used to map/clean topic names into Table names
    ]

    TABLE_LIST_KEYS = [  # noqa: RUF012
        "table.whitelist",  # JDBC (Legacy): List of specific tables to ingest
        "table.include.list",  # Debezium/JDBC (Modern): Regex or list of tables to include
        "tables.include",  # Generic: Variation often seen in custom connectors
        "tables",  # Generic: Simple list of tables
        "iceberg.tables",  # Iceberg Sink: Explicit list of target tables
    ]

    TABLE_MAPPING_KEYS = [  # noqa: RUF012
        "snowflake.topic2table.map",  # Snowflake Sink: Critical mapping (e.g., "topicA:tableA, topicB:tableB")
    ]

    # Both key forms the Snowflake sink accepts, most specific first. Spliced into the
    # generic lists below and read by SnowflakeSinkResolver, so the dedicated resolver
    # cannot recognise fewer keys than the generic key-list search it replaces.
    SNOWFLAKE_DATABASE_KEYS = [  # noqa: RUF012
        "snowflake.database.name",  # Snowflake: The target database
        "snowflake.database",  # Snowflake: Variation
    ]

    SNOWFLAKE_SCHEMA_KEYS = [  # noqa: RUF012
        "snowflake.schema.name",  # Snowflake: The Schema (e.g. "PUBLIC")
        "snowflake.schema",  # Snowflake variation
    ]

    DATABASE_KEYS = [  # noqa: RUF012
        "database",  # Generic: Common in simple JDBC configs
        "db.name",  # Generic: Common variation
        "database.dbname",  # PostgreSQL/JDBC: The physical database name
        "topic.prefix",  # Debezium: The "Logical Server Name".
        *SNOWFLAKE_DATABASE_KEYS,
        "defaultDataset",  # BigQuery: The Dataset (Equivalent to a Database/Schema)
        "mongodb.database",  # MongoDB: The specific database to watch/write to
        "cassandra.keyspace",  # Cassandra: Keyspace is the Cassandra equivalent of a Database
    ]

    DATABASE_LIST_KEYS = [  # noqa: RUF012
        "database.names",  # SQL Server: List of databases to monitor
        "databases.include",  # Variation (likely MongoDB or older configs)
        "database.include.list",  # Debezium: Explicit whitelist of databases
        "database.whitelist",  # Debezium (Legacy): Legacy whitelist
    ]

    SCHEMA_KEYS = [  # noqa: RUF012
        *SNOWFLAKE_SCHEMA_KEYS,
        "schema.name",  # Generic JDBC: Schema namespace
    ]

    BUCKET_KEYS = [  # noqa: RUF012
        "s3.bucket.name",
        "s3.bucket",
        "gcs.bucket.name",
        "azure.container.name",
    ]

    PREFIX_KEYS = [  # noqa: RUF012
        "topics.dir",
        "s3.prefix",
        "gcs.prefix",
        "directory.path",
    ]

    TOPIC_KEYS = ["kafka.topic", "topics", "topic"]  # noqa: RUF012


SUPPORTED_DATASETS = {
    "table": {
        "single": ConnectorConfigKeys.TABLE_KEYS,
        "list": ConnectorConfigKeys.TABLE_LIST_KEYS,
        "mapping": ConnectorConfigKeys.TABLE_MAPPING_KEYS,
    },
    "database": {
        "single": ConnectorConfigKeys.DATABASE_KEYS,
        "list": ConnectorConfigKeys.DATABASE_LIST_KEYS,
        "mapping": [],
    },
    "schema": {
        "single": ConnectorConfigKeys.SCHEMA_KEYS,
        "list": [],
        "mapping": [],
    },
    "parent_container": {
        "single": ConnectorConfigKeys.BUCKET_KEYS,
        "list": [],
        "mapping": [],
    },
    "container_name": {
        "single": ConnectorConfigKeys.PREFIX_KEYS,
        "list": [],
        "mapping": [],
    },
}

# Map Kafka Connect connector class names to OpenMetadata service types
CONNECTOR_CLASS_TO_SERVICE_TYPE = {
    "MySqlCdcSource": "Mysql",
    "MySqlCdcSourceV2": "Mysql",
    "PostgresCdcSource": "Postgres",
    "PostgresSourceConnector": "Postgres",
    "SqlServerCdcSource": "Mssql",
    "MongoDbCdcSource": "MongoDB",
    "OracleCdcSource": "Oracle",
    "Db2CdcSource": "Db2",
    # Confluent Cloud reports the short plugin name; self-managed Connect reports the Java class.
    "SnowflakeSink": "Snowflake",
    "SnowflakeSinkConnector": "Snowflake",
    "SnowflakeStreamingSinkConnector": "Snowflake",
}

# Map service types to hostname config keys
SERVICE_TYPE_HOSTNAME_KEYS = {
    "Mysql": ["database.hostname", "connection.host"],
    "Postgres": ["database.hostname", "connection.host"],
    "Mssql": ["database.hostname"],
    "MongoDB": ["mongodb.connection.uri", "connection.uri"],
    "Oracle": ["database.hostname"],
    "Snowflake": ["snowflake.url.name"],
}

# Service connection attributes probed, in order, for the host identifying a service.
# Most connections expose hostPort or host; Snowflake exposes neither and identifies
# the deployment by `account`.
SERVICE_CONNECTION_HOST_ATTRIBUTES = ["hostPort", "host", "account"]

# Domain suffixes a connector may append to the host stored on the service connection.
# Confluent reports "<account>.snowflakecomputing.com" for snowflake.url.name while the
# OpenMetadata Snowflake service stores the bare "<account>", so the suffix must not
# defeat the comparison. Values must be lowercase: hosts are lowercased before matching.
SERVICE_TYPE_HOST_DOMAIN_SUFFIXES = {
    "Snowflake": [".snowflakecomputing.com"],
}

# Map service types to broker/endpoint config keys for messaging services
MESSAGING_ENDPOINT_KEYS = [
    "kafka.endpoint",
    "bootstrap.servers",
    "kafka.bootstrap.servers",
]

# Storage sink connector class names
STORAGE_SINK_CONNECTOR_CLASSES = [
    "S3SinkConnector",
    "GcsSinkConnector",
    "AzureBlobSinkConnector",
    "AzureBlobStorageSinkConnector",
]

# Storage endpoint configuration keys by provider
STORAGE_ENDPOINT_KEYS = {
    "s3": ["store.url", "s3.endpoint", "aws.s3.endpoint", "s3.region"],
    "gcs": ["gcs.credentials.path"],
    "azure": ["azure.storage.account.name", "azblob.account.name"],
}
