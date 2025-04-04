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
    KafkaConnectDatasetDetails,
    KafkaConnectPipelineDetails,
    KafkaConnectTasks,
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
    ],
    "database": ["database", "db.name", "snowflake.database.name"],
    "container_name": ["s3.bucket.name"],
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

    def get_cluster_info(self) -> Optional[dict]:
        """
        Get the version and other details of the Kafka Connect cluster.
        """
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
            result = self.client.list_connector_plugins()
            return result
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get connector plugins  {exc}")

        return None

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

    def get_connector_dataset_info(self, connector: str) -> Optional[dict]:
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
            conn_config = self.get_connector_config(connector=connector)

            if not conn_config:
                return None

            result = {}
            for dataset in SUPPORTED_DATASETS or []:
                for key in SUPPORTED_DATASETS[dataset] or []:
                    if conn_config.get(key):
                        result[dataset] = conn_config[key]
                        return KafkaConnectDatasetDetails(**result)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get connector dataset details {exc}")

        return None

    def get_connector_tasks(self, connector: str) -> Optional[List[KafkaConnectTasks]]:
        """
        Get the list of tasks for a connector.
        Args:
            connector (str): The name of the connector.
        Returns:
            Optional[List[KafkaConnectTasks]]: A list of KafkaConnectTasks objects
                                            representing the connector's tasks,
                                            or None if the connector is not found
                                            or an error occurs.
        """
        try:
            result = self.client.get_connector_status(connector=connector)
            tasks = [KafkaConnectTasks(**task) for task in result.get("tasks") or []]
            return tasks
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get connector tasks list {exc}")

        return None

    def get_connector_task_status(self, connector: str, task_id: int) -> Optional[dict]:
        """
        Get the status of a specific task for a connector.
        Args:
            connector (str): The name of the connector.
            task_id (int): The ID of the task.
        Returns:
            Optional[Dict]: A dictionary containing the task status information,
                        or None if the connector or task is not found
                        or an error occurs.
        """
        try:
            result = self.client.get_connector_task_status(
                connector=connector, task_id=task_id
            )
            return result
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get connector tasks status {exc}")

        return None

    def get_connector_topics(
        self, connector: str
    ) -> Optional[List[KafkaConnectTopics]]:
        """
        Get the list of topics for a connector.

        Args:
            connector (str): The name of the connector.

        Returns:
            Optional[List[KafkaConnectTopics]]: A list of KafkaConnectTopics objects
                                            representing the connector's topics,
                                            or None if the connector is not found
                                            or an error occurs.
        """
        try:
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

    def get_connector_state(self, connector: str) -> Optional[str]:
        """
        Get the status of a single connector.
        Args:
            connector (str): The name of the connector.
        """
        try:
            result = self.client.get_connector_status(connector=connector)
            if result.get("connector"):
                return result["connector"].get("state")
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get connector state due to {exc}")

        return None

    def get_connector_list(self) -> Optional[List[KafkaConnectPipelineDetails]]:
        """
        Get the information of a single connector.
        Args:
            connector (str): The name of the connector.
        Returns:
            Optional[KafkaConnectPipelineDetails]: A KafkaConnectPipelineDetails
                                            object containing connector information,
                                            or None if the connector is not found
                                            or an error occurs.
        """
        try:
            connectors = []
            for connector in self.get_connectors() or []:
                result = self.client.get_connector_status(connector=connector)
                connector_details = KafkaConnectPipelineDetails(**result)
                connector_details.status = self.get_connector_state(connector=connector)
                connector_details.tasks = self.get_connector_tasks(connector=connector)
                connector_details.topics = self.get_connector_topics(
                    connector=connector
                )
                connectors.append(connector_details)
            return connectors
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get connector information {exc}")

        return None
