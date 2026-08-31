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

import re
import traceback
from typing import Iterable, List, Optional  # noqa: UP035
from urllib.parse import urlparse

from kafka_connect import KafkaConnect

from metadata.generated.schema.entity.services.connections.pipeline.kafkaConnectConnection import (
    KafkaConnectConnection,
)
from metadata.ingestion.source.pipeline.kafkaconnect.constants import (
    ConnectorConfigKeys,
)
from metadata.ingestion.source.pipeline.kafkaconnect.models import (
    KafkaConnectColumnMapping,
    KafkaConnectPipelineDetails,
    KafkaConnectTopics,
)
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


def parse_cdc_topic_name(topic_name: str, database_server_name: str = None) -> dict:  # noqa: RUF013
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
            elif len(remaining_parts) == 1:  # noqa: RET505
                # Pattern: {server-name}.{table} (no explicit schema)
                return {"database": database_server_name, "table": remaining_parts[0]}

        # Check if topic exactly matches server name (edge case)
        if topic_name.lower() == database_server_name.lower():
            return {}

    # Fallback: try to parse without server name
    parts = topic_name.split(".")

    # Pattern: {prefix}.{database}.{table} (3 parts)
    if len(parts) == 3:
        _, database, table = parts
        return {"database": database, "table": table}

    # Pattern: {database}.{table} (2 parts)
    elif len(parts) == 2:  # noqa: RET505
        database, table = parts
        return {"database": database, "table": table}

    # Pattern: just {table} (1 part)
    elif len(parts) == 1:
        if database_server_name:
            return {"database": database_server_name, "table": topic_name}
        # Without server name, we can't determine the database
        return {}

    return {}


# Kafka Connect's RegexRouter uses Java replacement backreferences: numbered
# ($1 / ${1}) and named (${name}). Both convert to Python's re \g<...> form,
# which also disambiguates "$12" from "$1" followed by "2".
JAVA_NAMED_BACKREF_PATTERN = re.compile(r"\$\{(\w+)\}")
JAVA_NUMBERED_BACKREF_PATTERN = re.compile(r"\$(\d+)")


# Java named capture group (?<name>...) -> Python (?P<name>...); the negative
# lookahead keeps lookbehind (?<= / (?<! untouched.
JAVA_NAMED_GROUP_PATTERN = re.compile(r"\(\?<(?![=!])(\w+)>")


# Statuses that mean the route itself is absent, as opposed to a request that failed.
# Confluent Cloud answers 404 "route_not_found" for /connectors/{name}/topics, and a proxy
# in front of Connect may answer 405 or 501. These are properties of the deployment, so
# re-asking per connector only costs a doomed request each time.
UNSUPPORTED_ROUTE_STATUS_CODES = frozenset({404, 405, 501})

# A worker started with topic.tracking.enable=false answers 403 with this message. A 403
# is only latched off when the body says so: a proxy or per-route RBAC can also answer 403
# while the endpoint exists, and latching on the status alone would silently disable
# runtime topic discovery for every connector behind the first such response.
TOPIC_TRACKING_DISABLED_MARKER = "topic tracking is disabled"

# Config keys naming a topic the connector creates for its own bookkeeping rather than
# for data. Debezium's schema history and the Connect error-handling dead letter queue.
INTERNAL_TOPIC_CONFIG_KEYS = (
    "schema.history.internal.kafka.topic",
    "database.history.kafka.topic",
    "errors.deadletterqueue.topic.name",
)


def extract_internal_topic_names(connector_config: Optional[dict]) -> set[str]:  # noqa: UP045
    """
    Topic names a connector creates for its own bookkeeping, derived from its config.

    Connect's active-topic tracking legitimately reports these next to data topics:
    Debezium's schema-change topic is named exactly ``topic.prefix``, and its transaction
    metadata topic ``topic.prefix + ".transaction"``. They are metadata plumbing, not data
    assets, so they must never become lineage endpoints.

    Derived from configuration rather than matched by shape on purpose. A rule like "ends
    in .transaction" would delete a legitimately named customer topic, whereas the config
    states the actual names. Names that do not exist for a given connector simply never
    match, which is what makes this safe for connectors that have no such topics.
    """
    names: set[str] = set()
    if not isinstance(connector_config, dict):
        return names

    prefix = connector_config.get("topic.prefix") or connector_config.get("database.server.name")
    if prefix:
        names.update({prefix, f"{prefix}.transaction"})

    for key in INTERNAL_TOPIC_CONFIG_KEYS:
        configured = connector_config.get(key)
        if configured:
            names.add(configured)

    return names


def _to_python_replacement(replacement: str) -> str:
    """Convert Java RegexRouter backreferences ($1, ${1}, ${name}) to Python \\g<...>."""
    replacement = JAVA_NAMED_BACKREF_PATTERN.sub(r"\\g<\1>", replacement)
    return JAVA_NUMBERED_BACKREF_PATTERN.sub(r"\\g<\1>", replacement)


def _apply_regex_router(topic_name: str, connector_config: dict, transform: str) -> str:
    """Apply a single RegexRouter transform to a topic name."""
    regex = connector_config.get(f"transforms.{transform}.regex")
    replacement = connector_config.get(f"transforms.{transform}.replacement", "")
    result = topic_name
    if regex:
        try:
            python_regex = JAVA_NAMED_GROUP_PATTERN.sub(r"(?P<\1>", regex)
            result = re.sub(python_regex, _to_python_replacement(replacement), topic_name)
        except re.error as exc:
            logger.warning(f"Invalid RegexRouter config for transform '{transform}': {exc}")
    return result


def apply_topic_routing_transforms(topic_name: str, connector_config: dict) -> str:
    """
    Apply Kafka Connect topic-routing SMTs that deterministically rewrite the
    destination topic name (RegexRouter / TopicRegexRouter).

    Kafka Connect applies transforms in the order listed in the ``transforms``
    config, so a statically-constructed topic name must be rewritten the same way
    before it can be matched against the real topic in OpenMetadata. Dynamic
    routers such as Debezium's EventRouter resolve to a value only known per-row
    and are handled separately by matching against already-ingested topics.

    Args:
        topic_name: The statically-constructed topic name.
        connector_config: The Kafka Connect connector configuration.

    Returns:
        The topic name after applying deterministic routing transforms.
    """
    if not topic_name or not isinstance(connector_config, dict):
        return topic_name

    transforms = connector_config.get("transforms", "")
    if not transforms:
        return topic_name

    result = topic_name
    for transform in [name.strip() for name in transforms.split(",") if name.strip()]:
        transform_type = connector_config.get(f"transforms.{transform}.type", "")
        if "RegexRouter" in transform_type:
            result = _apply_regex_router(result, connector_config, transform)
    return result


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
        # None until the /topics endpoint has been probed once for this cluster
        self._topics_endpoint_supported = None

    def _infer_cdc_topics_from_server_name(self, database_server_name: str) -> Optional[List[KafkaConnectTopics]]:  # noqa: UP006, UP045
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
            logger.debug(f"CDC connector detected with server name: {database_server_name}")
            return None  # Topics will be matched via messaging service during lineage  # noqa: TRY300
        except Exception as exc:
            logger.debug(f"Unable to infer CDC topics: {exc}")
            return None

    def _enrich_connector_details(self, connector_details: KafkaConnectPipelineDetails, connector_name: str) -> None:
        """Helper method to enrich connector details with additional information."""
        # Config first: the topic listing needs it to recognise the connector's own
        # bookkeeping topics, and fetching it once here avoids a second round trip.
        connector_details.config = self.get_connector_config(connector=connector_name)
        connector_details.topics = self.get_connector_topics(
            connector=connector_name, connector_config=connector_details.config
        )
        if connector_details.config:
            connector_details.description = connector_details.config.get("description", None)

            # For CDC connectors without explicit topics, try to infer from server name.
            # Only while topics is None: an empty list is the runtime reporting no data
            # topics, and inferring against that would contradict it.
            if connector_details.topics is None and connector_details.conn_type.lower() == "source":
                database_server_name = connector_details.config.get(
                    "database.server.name"
                ) or connector_details.config.get("topic.prefix")
                if database_server_name:
                    inferred_topics = self._infer_cdc_topics_from_server_name(database_server_name) or None
                    if inferred_topics:
                        connector_details.topics = inferred_topics

    def get_cluster_info(self) -> Optional[dict]:  # noqa: UP045
        """
        Get the version and other details of the Kafka Connect cluster.

        For Confluent Cloud, the root endpoint is not supported, so we use
        the /connectors endpoint to verify authentication and connectivity.
        """
        if self.is_confluent_cloud:
            # Confluent Cloud doesn't support the root endpoint (/)
            # Use /connectors to test authentication and connectivity
            logger.info("Confluent Cloud detected - testing connection via connectors list endpoint")
            try:
                connectors = self.client.list_connectors()
                # Connection successful - return a valid response
                logger.info(
                    f"Confluent Cloud connection successful - found {len(connectors) if connectors else 0} connectors"
                )
                return {  # noqa: TRY300
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
        expand: str = None,  # noqa: RUF013
        pattern: str = None,  # noqa: RUF013
        state: str = None,  # noqa: RUF013
    ) -> dict:
        """
        Get the list of connectors from Kafka Connect cluster.
        """
        return self.client.list_connectors(expand=expand, pattern=pattern, state=state)

    def get_connectors(
        self,
        expand: str = None,  # noqa: RUF013
        pattern: str = None,  # noqa: RUF013
        state: str = None,  # noqa: RUF013
    ) -> Optional[dict]:  # noqa: UP045
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

    def get_connector_plugins(self) -> Optional[dict]:  # noqa: UP045
        """
        Get the list of connector plugins.
        """
        try:
            return self.client.list_connector_plugins()
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get connector plugins  {exc}")

    def get_connector_config(self, connector: str) -> Optional[dict]:  # noqa: UP045
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
                        if isinstance(item, dict) and "config" in item and "value" in item
                    }
                    return config_dict or None

            # Standard self-hosted Kafka Connect format
            return result.get("config")

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get connector configuration details {exc}")

        return None

    def extract_column_mappings(self, connector_config: dict) -> Optional[List[KafkaConnectColumnMapping]]:  # noqa: UP006, UP045
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
                transform_type = connector_config.get(f"transforms.{transform}.type", "")

                # ReplaceField transform can rename columns
                if "ReplaceField" in transform_type:
                    renames = connector_config.get(f"transforms.{transform}.renames", "")
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

            return column_mappings if column_mappings else None  # noqa: TRY300

        except (KeyError, AttributeError, ValueError) as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to extract column mappings: {exc}")

        return None

    def _list_topics_from_api(self, connector: str) -> Optional[List[KafkaConnectTopics]]:  # noqa: UP006, UP045
        """
        Ask the Connect runtime which topics the connector actually produced (KIP-558).

        This is the only reliable source for a connector whose destination topic is
        computed at runtime — a Debezium outbox EventRouter routing by a row value has
        no static topic name anywhere in its config.

        Not every deployment implements the endpoint, so the first response that says the
        route does not exist stops us asking for the rest of the run rather than issuing a
        doomed request per connector.

        Only a status that actually denotes a missing route latches that off. A timeout or
        5xx is transient and must not disable the endpoint for the whole run: the config
        fallback yields nothing for a connector that routes by row value, so treating one
        blip on whichever connector happens to be processed first as "unsupported" would
        silently drop lineage for every outbox connector behind it.
        """
        if self._topics_endpoint_supported is False:
            return None
        try:
            result = self.client.list_connector_topics(connector=connector).get(connector)
            self._topics_endpoint_supported = True
            if result:
                return [KafkaConnectTopics(name=topic) for topic in result.get("topics") or []]
        except Exception as exc:
            response = getattr(exc, "response", None)
            status_code = getattr(response, "status_code", None)
            tracking_disabled = status_code == 403 and TOPIC_TRACKING_DISABLED_MARKER in (
                f"{getattr(response, 'text', '')} {exc}".lower()
            )
            if status_code in UNSUPPORTED_ROUTE_STATUS_CODES or tracking_disabled:
                if self._topics_endpoint_supported is None:
                    self._topics_endpoint_supported = False
                    remedy = (
                        " The worker reports topic tracking as disabled: set "
                        "topic.tracking.enable=true on the Connect workers to restore it."
                        if tracking_disabled
                        else ""
                    )
                    logger.info(
                        f"Connect /connectors/{{name}}/topics is unavailable on this cluster ({exc})."
                        f"{remedy} Falling back to topic names declared in connector configs. "
                        "Connectors that route by row value (e.g. a Debezium outbox EventRouter) "
                        "cannot be resolved this way."
                    )
            else:
                logger.warning(
                    f"Transient failure listing topics for connector '{connector}' ({exc}); "
                    "will retry the endpoint for the next connector."
                )
            logger.debug(traceback.format_exc())
        return None

    def _list_data_topics_from_api(
        self,
        connector: str,
        connector_config: Optional[dict],  # noqa: UP045
    ) -> Optional[List[KafkaConnectTopics]]:  # noqa: UP006, UP045
        """
        The topics the Connect runtime says this connector touched, minus its own
        bookkeeping topics.

        Distinguishes two outcomes the caller must not conflate:

        - ``None``: the runtime told us nothing, either because the endpoint is
          unavailable or because the connector has not reported any active topic yet.
          The caller may fall back.
        - ``[]``: the runtime did report topics and every one was this connector's own
          bookkeeping. That is an authoritative "no data topics", so inferring some from
          the topic namespace would contradict what the runtime just said.
        """
        topics = self._list_topics_from_api(connector)
        if not topics:
            return None

        excluded = extract_internal_topic_names(connector_config)
        data_topics = [topic for topic in topics if topic.name not in excluded]
        dropped = len(topics) - len(data_topics)
        if dropped:
            logger.debug(
                f"Excluded {dropped} internal topic(s) from connector '{connector}': "
                f"{sorted(excluded & {topic.name for topic in topics})}"
            )
        return data_topics

    @staticmethod
    def _parse_topics_from_config(connector_config: Optional[dict]) -> Optional[List[KafkaConnectTopics]]:  # noqa: UP006, UP045
        """Topic names written explicitly in the connector config, as a sink's `topics` list is."""
        if not connector_config:
            return None

        topics = []
        for key in ConnectorConfigKeys.TOPIC_KEYS:
            topic_value = connector_config.get(key)
            # Either a single topic or a comma-separated list.
            if isinstance(topic_value, str):
                topics.extend(KafkaConnectTopics(name=name.strip()) for name in topic_value.split(",") if name.strip())
        return topics or None

    def get_connector_topics(
        self,
        connector: str,
        connector_config: Optional[dict] = None,  # noqa: UP045
    ) -> Optional[List[KafkaConnectTopics]]:  # noqa: UP006, UP045
        """
        Get the list of data topics for a connector, most authoritative source first.

        The Connect runtime knows what the connector actually produced or consumed,
        including a routed name that appears nowhere in the config, so it wins. The
        config-declared names are the fallback for deployments that do not serve it.

        Args:
            connector (str): The name of the connector.
            connector_config (dict): The connector's config, when the caller already
                holds it. Fetched on demand otherwise.

        Returns:
            Optional[List[KafkaConnectTopics]]: The connector's data topics. An empty list
                                            means the runtime reported none, which is an
                                            answer. None means neither source could say.
        """
        try:
            config = connector_config if connector_config is not None else self.get_connector_config(connector)

            topics = self._list_data_topics_from_api(connector, config)
            if topics is not None:
                # Empty is the runtime stating this connector has no data topics. Falling
                # through to config on that would contradict what it just told us.
                return topics

            topics = self._parse_topics_from_config(config)
            if topics:
                logger.info(f"Extracted {len(topics)} topics from connector config for {connector}")
                return topics
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get connector Topics {exc}")

        return None

    def get_connector_list(self) -> Optional[Iterable[KafkaConnectPipelineDetails]]:  # noqa: UP045
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
                    connector_details.status = status_info.get("connector", {}).get("state", "UNASSIGNED")
                    self._enrich_connector_details(connector_details, connector_name)
                    if connector_details:
                        yield connector_details
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get connector information {exc}")

        return None
