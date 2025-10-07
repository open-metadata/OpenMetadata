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
Client to interact with Confluent CDC / Kafka Connect REST APIs
"""

import traceback
from typing import List, Optional

from kafka_connect import KafkaConnect

from metadata.generated.schema.entity.services.connections.pipeline.confluentCdcConnection import (
    ConfluentCdcConnection,
)
from metadata.ingestion.source.pipeline.confluentcdc.models import (
    ConfluentCdcColumnMapping,
    ConfluentCdcPipelineDetails,
    ConfluentCdcTableMapping,
    ConfluentCdcTopics,
)
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class ConfluentCdcClient:
    """
    Wrapper on top of Confluent CDC / Kafka Connect REST API
    """

    def __init__(self, config: ConfluentCdcConnection):
        url = clean_uri(config.hostPort)
        auth = None
        ssl_verify = config.verifySSL

        if config.confluentCdcConfig:
            if hasattr(config.confluentCdcConfig, "username"):
                auth = f"{config.confluentCdcConfig.username}:{config.confluentCdcConfig.password.get_secret_value()}"
            elif hasattr(config.confluentCdcConfig, "apiKey"):
                auth = f"{config.confluentCdcConfig.apiKey}:{config.confluentCdcConfig.apiSecret.get_secret_value()}"

        self.client = KafkaConnect(url=url, auth=auth, ssl_verify=ssl_verify)

    def _parse_cdc_column_mappings(
        self, connector_config: dict, connector_type: str
    ) -> List[ConfluentCdcTableMapping]:
        """
        Parse CDC connector config to extract table and column mappings.
        Handles both MySQL source and Postgres sink connectors.
        """
        table_mappings = []

        try:
            if connector_type.lower() == "source":
                table_mappings.extend(
                    self._parse_mysql_source_mapping(connector_config)
                )
            elif connector_type.lower() == "sink":
                table_mappings.extend(
                    self._parse_postgres_sink_mapping(connector_config)
                )

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to parse CDC column mappings: {exc}")

        return table_mappings

    def _parse_mysql_source_mapping(
        self, connector_config: dict
    ) -> List[ConfluentCdcTableMapping]:
        """Parse MySQL CDC source connector configuration"""
        mappings = []

        table_include_list = connector_config.get("table.include.list", "")
        database_name = connector_config.get("database.name") or connector_config.get(
            "database.hostname"
        )

        if table_include_list:
            for table_ref in table_include_list.split(","):
                table_ref = table_ref.strip()
                if "." in table_ref:
                    schema, table = table_ref.rsplit(".", 1)
                else:
                    schema, table = None, table_ref

                mappings.append(
                    ConfluentCdcTableMapping(
                        source_database=database_name,
                        source_schema=schema,
                        source_table=table,
                        target_database=None,
                        target_schema=None,
                        target_table=table,
                        column_mappings=self._extract_column_mappings_from_schema(
                            connector_config
                        ),
                    )
                )

        return mappings

    def _parse_postgres_sink_mapping(
        self, connector_config: dict
    ) -> List[ConfluentCdcTableMapping]:
        """Parse Postgres CDC sink connector configuration"""
        mappings = []

        topics = connector_config.get("topics", "")
        table_name_format = connector_config.get("table.name.format", "${topic}")

        if topics:
            for topic in topics.split(","):
                topic = topic.strip()
                table_name = table_name_format.replace("${topic}", topic)

                mappings.append(
                    ConfluentCdcTableMapping(
                        source_database=None,
                        source_schema=None,
                        source_table=topic,
                        target_database=connector_config.get("connection.database"),
                        target_schema=connector_config.get("schema", "public"),
                        target_table=table_name,
                        column_mappings=self._extract_column_mappings_from_schema(
                            connector_config
                        ),
                    )
                )

        return mappings

    def _extract_column_mappings_from_schema(
        self, connector_config: dict
    ) -> List[ConfluentCdcColumnMapping]:
        """
        Extract column mappings from connector schema/transforms configuration.
        This would ideally parse Avro schemas or SMT (Single Message Transforms) configs.
        """
        column_mappings = []

        transforms = connector_config.get("transforms", "")
        if "flatten" in transforms.lower() or "extractfield" in transforms.lower():
            logger.debug(
                "Column transforms detected but detailed mapping not available"
            )

        return column_mappings

    def _enrich_connector_details(
        self, connector_details: ConfluentCdcPipelineDetails, connector_name: str
    ) -> None:
        """Helper method to enrich connector details with additional information."""
        connector_details.topics = self.get_connector_topics(connector=connector_name)
        connector_details.config = self.get_connector_config(connector=connector_name)

        if connector_details.config:
            connector_details.description = connector_details.config.get(
                "description", None
            )
            connector_details.table_mappings = self._parse_cdc_column_mappings(
                connector_details.config, connector_details.conn_type
            )

    def get_cluster_info(self) -> Optional[dict]:
        """Get the version and other details of the Kafka Connect cluster."""
        return self.client.get_cluster_info()

    def get_connectors_list(
        self,
        expand: str = None,
        pattern: str = None,
        state: str = None,
    ) -> dict:
        """Get the list of connectors from Kafka Connect cluster."""
        return self.client.list_connectors(expand=expand, pattern=pattern, state=state)

    def get_connectors(
        self,
        expand: str = None,
        pattern: str = None,
        state: str = None,
    ) -> Optional[dict]:
        """Get the list of connectors."""
        try:
            return self.get_connectors_list(expand=expand, pattern=pattern, state=state)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get connectors list {exc}")
        return None

    def get_connector_config(self, connector: str) -> Optional[dict]:
        """Get the configuration of a single connector."""
        try:
            result = self.client.get_connector(connector=connector)
            if result:
                return result.get("config")
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get connector configuration details {exc}")
        return None

    def get_connector_topics(
        self, connector: str
    ) -> Optional[List[ConfluentCdcTopics]]:
        """Get the list of topics for a connector."""
        try:
            result = self.client.list_connector_topics(connector=connector).get(
                connector
            )
            if result:
                topics = [
                    ConfluentCdcTopics(name=topic)
                    for topic in result.get("topics") or []
                ]
                return topics
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get connector topics {exc}")
        return None

    def get_connector_list(self) -> Optional[List[ConfluentCdcPipelineDetails]]:
        """
        Get the information of all CDC connectors.
        Returns:
            Optional[List[ConfluentCdcPipelineDetails]]: A list of CDC pipeline details
        """
        try:
            connector_data = self.get_connectors(expand="status") or {}

            for connector_name, connector_info in connector_data.items():
                if isinstance(connector_info, dict) and "status" in connector_info:
                    status_info = connector_info["status"]
                    connector_details = ConfluentCdcPipelineDetails(**status_info)
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
