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


class ConnectorConfigKeys:
    """Configuration keys for various Kafka Connect connectors"""

    TABLE_KEYS = [
        "table",  # Generic: Often used in simple JDBC source/sink configs
        "table.name.format",  # JDBC Sink: Defines the target table name (e.g., "kafka_${topic}")
        "collection",  # MongoDB: The Mongo equivalent of a Table
        "sanitizeTopics",  # BigQuery: Often used to map/clean topic names into Table names
    ]

    TABLE_LIST_KEYS = [
        "table.whitelist",  # JDBC (Legacy): List of specific tables to ingest
        "table.include.list",  # Debezium/JDBC (Modern): Regex or list of tables to include
        "tables.include",  # Generic: Variation often seen in custom connectors
        "tables",  # Generic: Simple list of tables
        "iceberg.tables",  # Iceberg Sink: Explicit list of target tables
    ]

    TABLE_MAPPING_KEYS = [
        "snowflake.topic2table.map",  # Snowflake Sink: Critical mapping (e.g., "topicA:tableA, topicB:tableB")
    ]

    DATABASE_KEYS = [
        "database",  # Generic: Common in simple JDBC configs
        "db.name",  # Generic: Common variation
        "database.dbname",  # PostgreSQL/JDBC: The physical database name
        "topic.prefix",  # Debezium: The "Logical Server Name".
        "snowflake.database.name",  # Snowflake: The target database
        "snowflake.database",  # Snowflake: Variation
        "defaultDataset",  # BigQuery: The Dataset (Equivalent to a Database/Schema)
        "mongodb.database",  # MongoDB: The specific database to watch/write to
        "cassandra.keyspace",  # Cassandra: Keyspace is the Cassandra equivalent of a Database
    ]

    DATABASE_LIST_KEYS = [
        "database.names",  # SQL Server: List of databases to monitor
        "databases.include",  # Variation (likely MongoDB or older configs)
        "database.include.list",  # Debezium: Explicit whitelist of databases
        "database.whitelist",  # Debezium (Legacy): Legacy whitelist
    ]

    SCHEMA_KEYS = [
        "snowflake.schema.name",  # Snowflake: The Schema (e.g. "PUBLIC")
        "snowflake.schema",  # Snowflake variation
        "schema.name",  # Generic JDBC: Schema namespace
    ]

    BUCKET_KEYS = [
        "s3.bucket.name",
        "s3.bucket",
        "gcs.bucket.name",
        "azure.container.name",
    ]

    PREFIX_KEYS = [
        "topics.dir",
        "s3.prefix",
        "gcs.prefix",
        "directory.path",
    ]

    TOPIC_KEYS = ["kafka.topic", "topics", "topic"]


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
}

# Map service types to hostname config keys
SERVICE_TYPE_HOSTNAME_KEYS = {
    "Mysql": ["database.hostname", "connection.host"],
    "Postgres": ["database.hostname", "connection.host"],
    "Mssql": ["database.hostname"],
    "MongoDB": ["mongodb.connection.uri", "connection.uri"],
    "Oracle": ["database.hostname"],
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

# CDC envelope field names used for Debezium detection and parsing
CDC_ENVELOPE_FIELDS = {"after", "before", "op"}
