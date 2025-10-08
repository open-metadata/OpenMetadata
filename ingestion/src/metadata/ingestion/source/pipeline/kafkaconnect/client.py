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

SUPPORTED_DATASETS = {
    "table": [
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
    ],
    "database": [
        "database",
        "db.name",
        "snowflake.database.name",
        "database.include.list",
        "database.hostname",
        "connection.url",
        "database.dbname",
        "topic.prefix",
        "database.server.name",
        "databases.include",
        "database.names",
        "snowflake.database",
        "connection.host",
        "database.exclude.list",
    ],
    "container_name": [
        "s3.bucket.name",
        "s3.bucket",
        "gcs.bucket.name",
        "azure.container.name",
        "topics.dir",
    ],
}


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
        self.is_confluent_cloud = "api.confluent.cloud" in url

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
        Args:
            connector (str): The name of the connector.
        """
        try:
            result = self.client.get_connector(connector=connector)
            if result:
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
        try:
            column_mappings = []

            # Check for SMT (Single Message Transform) configurations
            transforms = connector_config.get("transforms", "")
            if transforms:
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

        except Exception as exc:
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
            connector (str): The name of the connector.
        Returns:
            Optional[Dict]: A dictionary containing dataset information
                        (type, table, database, or bucket_name)
                        if a dataset is found, or None if the connector
                        is not found, has no dataset, or an error occurs.
        """
        try:
            if not connector_config:
                return None

            result = {}
            for dataset in SUPPORTED_DATASETS or []:
                for key in SUPPORTED_DATASETS[dataset] or []:
                    if connector_config.get(key):
                        result[dataset] = connector_config[key]
                        dataset_details = KafkaConnectDatasetDetails(**result)
                        dataset_details.column_mappings = self.extract_column_mappings(
                            connector_config
                        )
                        return dataset_details

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get connector dataset details {exc}")

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
                    topic_keys = ["kafka.topic", "topics", "topic"]
                    for key in topic_keys:
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
