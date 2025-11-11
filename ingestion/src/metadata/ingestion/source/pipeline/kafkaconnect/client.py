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
Client to interact with Kafka Connect REST APIs
"""

import traceback
from typing import List, Optional
from urllib.parse import urlparse

from kafka_connect import KafkaConnect

from metadata.generated.schema.entity.services.connections.pipeline.kafkaConnectConnection import (
    KafkaConnectConnection,
)
from metadata.ingestion.source.pipeline.kafkaconnect.models import (
    KafkaConnectColumnMapping,
    KafkaConnectDatasetDetails,
    KafkaConnectPipelineDetails,
    KafkaConnectTopics,
)
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


def parse_cdc_topic_name(topic_name: str, database_server_name: str = None) -> dict:
    """
    Parse CDC topic names to extract database and table information.

    Common CDC topic naming patterns:
    - Debezium: {server-name}.{database}.{table}
    - Debezium V2: {topic-prefix}.{database}.{table}
    - Examples:
      - MysqlKafkaV2.ecommerce.orders -> database=ecommerce, table=orders
      - PostgresKafkaCDC.public.orders -> database=public, table=orders

    Args:
        topic_name: The Kafka topic name
        database_server_name: The database.server.name or topic.prefix from connector config

    Returns:
        dict with 'database' and 'table' keys, or empty dict if pattern doesn't match
    """
    if not topic_name:
        return {}

    # Skip internal/system topics
    if topic_name.startswith(("_", "dbhistory.", "__")):
        return {}

    # If database_server_name is provided, check if topic starts with it
    # This handles server names with dots like "collate.ecommerce.dev"
    if database_server_name:
        # Check if topic starts with the server name prefix
        server_prefix = database_server_name + "."
        if topic_name.startswith(server_prefix):
            # Strip the server name prefix to get schema.table or just table
            remaining = topic_name[len(server_prefix) :]
            remaining_parts = remaining.split(".")

            if len(remaining_parts) == 2:
                # Pattern: {server-name}.{schema}.{table}
                database, table = remaining_parts
                return {"database": database, "table": table}
            elif len(remaining_parts) == 1:
                # Pattern: {server-name}.{table} (no explicit schema)
                return {"database": database_server_name, "table": remaining_parts[0]}

        # Check if topic exactly matches server name (edge case)
        if topic_name.lower() == database_server_name.lower():
            return {}

    # Fallback: try to parse without server name
    parts = topic_name.split(".")

    # Pattern: {prefix}.{database}.{table} (3 parts)
    if len(parts) == 3:
        prefix, database, table = parts
        return {"database": database, "table": table}

    # Pattern: {database}.{table} (2 parts)
    elif len(parts) == 2:
        database, table = parts
        return {"database": database, "table": table}

    # Pattern: just {table} (1 part)
    elif len(parts) == 1:
        if database_server_name:
            return {"database": database_server_name, "table": topic_name}
        # Without server name, we can't determine the database
        return {}

    return {}


class ConnectorConfigKeys:
    """Configuration keys for various Kafka Connect connectors"""

    TABLE_KEYS = [
        "table",
        "collection",
        "snowflake.schema.name",
        "table.whitelist",
        "fields.whitelist",
        "table.include.list",
        "table.name.format",
        "tables.include",
        "table.exclude.list",
        "snowflake.schema",
        "snowflake.topic2table.map",
        "fields.included",
    ]

    DATABASE_KEYS = [
        "database",
        "db.name",
        "snowflake.database.name",
        "database.include.list",
        # "database.hostname",
        # "connection.url",
        "database.dbname",
        "topic.prefix",
        # "database.server.name",  # This maps the server name, not the actual database
        "databases.include",
        "database.names",
        "snowflake.database",
        # "connection.host",
        # "database.exclude.list",
    ]

    CONTAINER_KEYS = [
        "s3.bucket.name",
        "s3.bucket",
        "gcs.bucket.name",
        "azure.container.name",
        "topics.dir",  # Directory path within storage container for sink connectors
    ]

    TOPIC_KEYS = ["kafka.topic", "topics", "topic"]


SUPPORTED_DATASETS = {
    "table": ConnectorConfigKeys.TABLE_KEYS,
    "database": ConnectorConfigKeys.DATABASE_KEYS,
    "container_name": ConnectorConfigKeys.CONTAINER_KEYS,
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


class KafkaConnectClient:
    """
    Wrapper on top of KafkaConnect REST API
    """

    def __init__(self, config: KafkaConnectConnection):
        url = clean_uri(config.hostPort)
        auth = None
        ssl_verify = config.verifySSL
        if config.KafkaConnectConfig:
            auth = f"{config.KafkaConnectConfig.username}:{config.KafkaConnectConfig.password.get_secret_value()}"
        self.client = KafkaConnect(url=url, auth=auth, ssl_verify=ssl_verify)

        # Detect if this is Confluent Cloud (managed connectors)
        parsed_url = urlparse(url)
        self.is_confluent_cloud = parsed_url.hostname == "api.confluent.cloud"

    def _infer_cdc_topics_from_server_name(
        self, database_server_name: str
    ) -> Optional[List[KafkaConnectTopics]]:
        """
        For CDC connectors, infer topic names based on database.server.name or topic.prefix.
        CDC connectors create topics with pattern: {server-name}.{database}.{table}

        This is a workaround for Confluent Cloud which doesn't expose topic lists.
        We look for topics that start with the server name prefix.

        Args:
            database_server_name: The database.server.name or topic.prefix from config

        Returns:
            List of inferred KafkaConnectTopics, or None
        """
        if not database_server_name or not self.is_confluent_cloud:
            return None

        try:
            # Get all connectors and check their topics
            # Note: This is a best-effort approach for Confluent Cloud
            # In practice, the messaging service should already have ingested these topics
            logger.debug(
                f"CDC connector detected with server name: {database_server_name}"
            )
            return None  # Topics will be matched via messaging service during lineage
        except Exception as exc:
            logger.debug(f"Unable to infer CDC topics: {exc}")
            return None

    def _enrich_connector_details(
        self, connector_details: KafkaConnectPipelineDetails, connector_name: str
    ) -> None:
        """Helper method to enrich connector details with additional information."""
        connector_details.topics = self.get_connector_topics(connector=connector_name)
        connector_details.config = self.get_connector_config(connector=connector_name)
        if connector_details.config:
            connector_details.description = connector_details.config.get(
                "description", None
            )
            connector_details.dataset = self.get_connector_dataset_info(
                connector_details.config
            )

            # For CDC connectors without explicit topics, try to infer from server name
            if (
                not connector_details.topics
                and connector_details.conn_type.lower() == "source"
            ):
                database_server_name = connector_details.config.get(
                    "database.server.name"
                ) or connector_details.config.get("topic.prefix")
                if database_server_name:
                    inferred_topics = self._infer_cdc_topics_from_server_name(
                        database_server_name
                    )
                    if inferred_topics:
                        connector_details.topics = inferred_topics

    def get_cluster_info(self) -> Optional[dict]:
        """
        Get the version and other details of the Kafka Connect cluster.

        For Confluent Cloud, the root endpoint is not supported, so we use
        the /connectors endpoint to verify authentication and connectivity.
        """
        if self.is_confluent_cloud:
            # Confluent Cloud doesn't support the root endpoint (/)
            # Use /connectors to test authentication and connectivity
            logger.info(
                "Confluent Cloud detected - testing connection via connectors list endpoint"
            )
            try:
                connectors = self.client.list_connectors()
                # Connection successful - return a valid response
                logger.info(
                    f"Confluent Cloud connection successful - found {len(connectors) if connectors else 0} connectors"
                )
                return {
                    "version": "confluent-cloud",
                    "commit": "managed",
                    "kafka_cluster_id": "confluent-managed",
                }
            except Exception as exc:
                logger.error(f"Failed to connect to Confluent Cloud: {exc}")
                raise

        return self.client.get_cluster_info()

    def get_connectors_list(
        self,
        expand: str = None,
        pattern: str = None,
        state: str = None,
    ) -> dict:
        """
        Get the list of connectors from Kafka Connect cluster.
        """
        return self.client.list_connectors(expand=expand, pattern=pattern, state=state)

    def get_connectors(
        self,
        expand: str = None,
        pattern: str = None,
        state: str = None,
    ) -> Optional[dict]:
        """
        Get the list of connectors.
        Args:
            expand (str): Optional parameter that retrieves additional information about the connectors.
                Valid values are "status" and "info".
            pattern (str): Only list connectors that match the regex pattern.
            state (str): Only list connectors that match the state.
        """
        try:
            return self.get_connectors_list(expand=expand, pattern=pattern, state=state)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get connectors list {exc}")

        return None

    def get_connector_plugins(self) -> Optional[dict]:
        """
        Get the list of connector plugins.
        """
        try:
            return self.client.list_connector_plugins()
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get connector plugins  {exc}")

    def get_connector_config(self, connector: str) -> Optional[dict]:
        """
        Get the details of a single connector.

        For Confluent Cloud, the API returns configs as an array of {config, value} objects.
        For self-hosted Kafka Connect, it returns a flat config dictionary.

        Args:
            connector (str): The name of the connector.
        """
        try:
            result = self.client.get_connector(connector=connector)
            if not result:
                return None

            # Check if this is Confluent Cloud format (array of {config, value})
            if self.is_confluent_cloud and "configs" in result:
                # Transform Confluent Cloud format: [{config: "key", value: "val"}] -> {key: val}
                configs_array = result.get("configs", [])
                if isinstance(configs_array, list):
                    config_dict = {
                        item["config"]: item["value"]
                        for item in configs_array
                        if isinstance(item, dict)
                        and "config" in item
                        and "value" in item
                    }
                    return config_dict or None

            # Standard self-hosted Kafka Connect format
            return result.get("config")

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get connector configuration details {exc}")

        return None

    def extract_column_mappings(
        self, connector_config: dict
    ) -> Optional[List[KafkaConnectColumnMapping]]:
        """
        Extract column mappings from connector configuration.
        For Debezium and JDBC connectors, columns are typically mapped 1:1
        unless transforms are applied.

        Args:
            connector_config: The connector configuration dictionary

        Returns:
            List of KafkaConnectColumnMapping objects if mappings can be inferred
        """
        if not connector_config or not isinstance(connector_config, dict):
            logger.debug("Invalid connector_config: expected dict")
            return None

        try:
            column_mappings = []

            # Check for SMT (Single Message Transform) configurations
            transforms = connector_config.get("transforms", "")
            if not transforms:
                return None

            transform_list = [t.strip() for t in transforms.split(",")]
            for transform in transform_list:
                transform_type = connector_config.get(
                    f"transforms.{transform}.type", ""
                )

                # ReplaceField transform can rename columns
                if "ReplaceField" in transform_type:
                    renames = connector_config.get(
                        f"transforms.{transform}.renames", ""
                    )
                    if renames:
                        for rename in renames.split(","):
                            if ":" in rename:
                                source_col, target_col = rename.split(":", 1)
                                column_mappings.append(
                                    KafkaConnectColumnMapping(
                                        source_column=source_col.strip(),
                                        target_column=target_col.strip(),
                                    )
                                )

            return column_mappings if column_mappings else None

        except (KeyError, AttributeError, ValueError) as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to extract column mappings: {exc}")

        return None

    def get_connector_dataset_info(
        self, connector_config: dict
    ) -> Optional[KafkaConnectDatasetDetails]:
        """
        Get the details of dataset of connector if there is any.
        Checks in the connector configurations for dataset fields
        if any related field is found returns the result
        Args:
            connector_config: The connector configuration dictionary
        Returns:
            Optional[KafkaConnectDatasetDetails]: Dataset information including
                table, database, or container_name if found, or None otherwise
        """
        if not connector_config or not isinstance(connector_config, dict):
            logger.debug("Invalid connector_config: expected dict")
            return None

        try:
            result = {}
            for dataset_type, config_keys in SUPPORTED_DATASETS.items():
                for key in config_keys:
                    if connector_config.get(key):
                        result[dataset_type] = connector_config[key]

            # Only create dataset details if we have meaningful dataset information
            # For CDC connectors, database.server.name/topic.prefix are captured
            # but don't represent actual table names, so skip dataset creation
            # We need either: table name OR container name
            if result and (result.get("table") or result.get("container_name")):
                dataset_details = KafkaConnectDatasetDetails(**result)
                dataset_details.column_mappings = (
                    self.extract_column_mappings(connector_config) or []
                )
                return dataset_details

        except (KeyError, ValueError, TypeError) as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get connector dataset details: {exc}")

        return None

    def get_connector_topics(
        self, connector: str
    ) -> Optional[List[KafkaConnectTopics]]:
        """
        Get the list of topics for a connector.

        For Confluent Cloud, the /topics endpoint is not supported, so we extract
        topics from the connector configuration instead.

        Args:
            connector (str): The name of the connector.

        Returns:
            Optional[List[KafkaConnectTopics]]: A list of KafkaConnectTopics objects
                                            representing the connector's topics,
                                            or None if the connector is not found
                                            or an error occurs.
        """
        try:
            if self.is_confluent_cloud:
                # Confluent Cloud doesn't support /connectors/{name}/topics endpoint
                # Extract topics from connector config instead
                config = self.get_connector_config(connector=connector)
                if config:
                    topics = []
                    # Check common topic configuration keys
                    for key in ConnectorConfigKeys.TOPIC_KEYS:
                        if key in config:
                            topic_value = config[key]
                            # Handle single topic or comma-separated list
                            if isinstance(topic_value, str):
                                topic_list = [t.strip() for t in topic_value.split(",")]
                                topics.extend(
                                    [
                                        KafkaConnectTopics(name=topic)
                                        for topic in topic_list
                                    ]
                                )

                    if topics:
                        logger.info(
                            f"Extracted {len(topics)} topics from Confluent Cloud connector config"
                        )
                        return topics
            else:
                # Self-hosted Kafka Connect supports /topics endpoint
                result = self.client.list_connector_topics(connector=connector).get(
                    connector
                )
                if result:
                    topics = [
                        KafkaConnectTopics(name=topic)
                        for topic in result.get("topics") or []
                    ]
                    return topics
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get connector Topics {exc}")

        return None

    def get_connector_list(self) -> Optional[List[KafkaConnectPipelineDetails]]:
        """
        Get the information of all connectors.
        Returns:
            Optional[List[KafkaConnectPipelineDetails]]: A list of KafkaConnectPipelineDetails
                                            objects containing connector information,
                                            or None if an error occurs.
        """
        try:
            connector_data = self.get_connectors(expand="status") or {}

            for connector_name, connector_info in connector_data.items():
                if isinstance(connector_info, dict) and "status" in connector_info:
                    status_info = connector_info["status"]
                    connector_details = KafkaConnectPipelineDetails(**status_info)
                    connector_details.status = status_info.get("connector", {}).get(
                        "state", "UNASSIGNED"
                    )
                    self._enrich_connector_details(connector_details, connector_name)
                    if connector_details:
                        yield connector_details
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get connector information {exc}")

        return None
