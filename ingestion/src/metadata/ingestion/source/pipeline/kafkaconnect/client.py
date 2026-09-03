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
from collections.abc import Iterable
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import requests
from kafka_connect import KafkaConnect
from pydantic import ValidationError

from metadata.generated.schema.entity.services.connections.pipeline.kafkaConnectConnection import (
    KafkaConnectConnection,
)
from metadata.ingestion.source.pipeline.kafkaconnect.constants import (
    ConnectorConfigKeys,
)
from metadata.ingestion.source.pipeline.kafkaconnect.models import (
    ConfluentTelemetryRow,
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

# Confluent Cloud answers KIP-558 with 404, so a connector whose destination topic is
# chosen from a row value resolves nothing from its configuration. The telemetry Data Flow
# dataset reports which topic a producer client wrote to, and a managed connector produces
# under a client id carrying its own connector id, which is what ties the two together.
CONFLUENT_TELEMETRY_URL = "https://api.telemetry.confluent.cloud/v2/metrics/dataflow/query"

# Named from the CLUSTER's perspective, not the client's: received_records counts records
# the cluster received, which is what a producer wrote. The mirrored sent_records counts
# what the cluster sent to consumers and returns no producer clients at all, so it is the
# wrong end of the pipe for a source connector. The value itself is unused, only the
# topic-to-client pairing matters.
CONFLUENT_TELEMETRY_METRIC = "received_records"

# Confluent retains metrics for seven days. A shorter window keeps the response small and
# reduces how far back a since-deleted connector can appear.
CONFLUENT_TELEMETRY_WINDOW_HOURS = 24

CONFLUENT_TELEMETRY_TIMEOUT_SECONDS = 60

# The documented maximum number of groups per response. Higher values are currently
# tolerated by the service but are out of spec, and the response is paginated regardless,
# so there is nothing to gain by asking for more than the contract allows.
CONFLUENT_TELEMETRY_PAGE_LIMIT = 1000

# A cluster busy enough to need more pages than this is not one we can usefully enumerate,
# and an unbounded follow-the-cursor loop would hang ingestion on a malformed response.
CONFLUENT_TELEMETRY_MAX_PAGES = 50

# A managed connector's producer client is named connector-producer-<connector-id>-<task>.
# The convention is not documented, so it is matched rather than constructed, and a client
# id that does not match yields no attribution instead of a guess.
CONFLUENT_PRODUCER_CLIENT_PATTERN = re.compile(r"connector-producer-(?P<connector_id>lcc-[a-z0-9]+)-\d+$")

# Confluent Cloud Connect URLs end in /clusters/<kafka-cluster-id>, which is the id the
# telemetry query filters on.
CONFLUENT_CLUSTER_ID_PATTERN = re.compile(r"/clusters/(?P<cluster_id>lkc-[a-z0-9]+)")


def extract_internal_topic_names(connector_config: dict | None) -> set[str]:
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


def confluent_managed_internal_topic_names(connector_config: dict | None, connector_id: str) -> set[str]:
    """
    Bookkeeping topic names a Confluent managed connector produces, which its configuration
    does not state.

    ``extract_internal_topic_names`` covers the names configuration declares. Confluent
    derives these two from the connector id instead, which is assigned at runtime and
    appears in no config key, so they can only be reconstructed.

    The transaction topic is produced by the connector's own client, so attribution cannot
    separate it and excluding it by name is the only thing that does.

    Schema history arrives under a separate ``<prefix>-schemahistory`` client, which never
    matches the connector producer pattern, so attribution already removes it and this name
    is redundant today. It is returned anyway, because the client naming is Confluent's
    convention rather than a guarantee, and were schema history ever to move onto the
    connector's own client it would otherwise be emitted as lineage.
    """
    if not isinstance(connector_config, dict):
        return set()

    prefix = connector_config.get("topic.prefix") or connector_config.get("database.server.name")
    if not prefix:
        return set()

    return {
        f"{prefix}.{connector_id}.transaction",
        f"dbhistory.{prefix}.{connector_id}",
    }


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

        self._host_port = url
        # The telemetry call goes through requests directly rather than the Connect client,
        # so it has to honour this itself.
        self._verify_ssl = ssl_verify
        # Both telemetry lookups describe the whole cluster, not one connector, so they are
        # resolved once and reused. Each is a single snapshot replaced wholesale rather
        # than a cache accumulating an entry per item, and each is reduced to the
        # connectors this cluster actually has: the raw telemetry response also carries
        # every unrelated producer on the cluster, which is discarded at fetch time rather
        # than retained. Size is therefore bounded by the connector count, and the client
        # lives for a single ingestion run. None means not yet fetched.
        self._connector_ids: dict[str, str] | None = None
        self._telemetry_topics_by_connector_id: dict[str, set[str]] | None = None
        # The telemetry API takes the same Confluent Cloud key as the Connect API, so no
        # separate credential is needed. Held as a tuple because that call is made with
        # requests directly rather than through the Connect client. Both halves have to be
        # present: telemetry has no anonymous mode, so half a credential is worth the same
        # as none and is better refused here than sent.
        self._telemetry_auth: tuple[str, str] | None = None
        auth_config = config.KafkaConnectConfig
        if auth_config and auth_config.username and auth_config.password:
            self._telemetry_auth = (
                auth_config.username,
                auth_config.password.get_secret_value(),
            )

    def _confluent_kafka_cluster_id(self) -> str | None:
        """The Kafka cluster id the Connect URL points at, which scopes the telemetry query."""
        if not self.is_confluent_cloud:
            return None
        match = CONFLUENT_CLUSTER_ID_PATTERN.search(self._host_port)
        return match.group("cluster_id") if match else None

    def _connector_id_by_name(self) -> dict[str, str]:
        """
        Map connector name to the Confluent connector id its producer client is named after.

        `?expand=id` is served by the same Connect API already in use, so this needs no
        extra credentials. Resolving against the live list also bounds the telemetry
        result: a window wide enough to be useful still contains connectors deleted inside
        it, and those must not be attributed to anything.
        """
        if self._connector_ids is not None:
            return self._connector_ids

        result: dict[str, str] = {}
        try:
            response = self.get_connectors_list(expand="id")
            for name, block in (response or {}).items():
                connector_id = ((block or {}).get("id") or {}).get("id")
                if connector_id:
                    result[name] = connector_id
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.debug("Unable to list Confluent connector ids: %s", exc)

        self._connector_ids = result
        return result

    def _query_dataflow_topics_by_client(
        self, cluster_id: str, max_pages: int = CONFLUENT_TELEMETRY_MAX_PAGES
    ) -> dict[str, set[str]]:
        """
        Topics each connector producer wrote to on this cluster, from the telemetry API.

        Grouping by topic and client together is what makes the result attributable. The
        metric value is discarded: presence of the pair is the whole signal.

        Only clients named like a connector producer are kept. The query is cluster wide,
        so the response also describes every application producing to the cluster, and
        those can never be attributed to a connector.

        ``max_pages`` exists for the test-connection step, which only needs to know that
        the API answers. Resolution needs every page, but a reachability check that walked
        them all would spend a request per page against an endpoint that rate limits by the
        hour, for an answer the first response already gave.
        """
        now = datetime.now(timezone.utc).replace(microsecond=0)
        start = now - timedelta(hours=CONFLUENT_TELEMETRY_WINDOW_HOURS)
        interval = f"{start.isoformat().replace('+00:00', 'Z')}/{now.isoformat().replace('+00:00', 'Z')}"
        payload = {
            "aggregations": [{"metric": CONFLUENT_TELEMETRY_METRIC, "aggregations": ["SUM"]}],
            "filter": {
                "op": "AND",
                "filters": [{"field": "resource.kafka.id", "op": "EQ", "value": cluster_id}],
            },
            "granularity": "ALL",
            "group_by": ["metric.topic", "metric.client_id"],
            "intervals": [interval],
            "limit": CONFLUENT_TELEMETRY_PAGE_LIMIT,
        }

        by_client: dict[str, set[str]] = {}
        page_token = None
        for _ in range(max_pages):
            response = requests.post(
                CONFLUENT_TELEMETRY_URL,
                json=payload,
                params={"page_token": page_token} if page_token else None,
                auth=self._telemetry_auth,
                timeout=CONFLUENT_TELEMETRY_TIMEOUT_SECONDS,
                verify=self._verify_ssl,
            )
            response.raise_for_status()
            body = response.json() or {}

            skipped = 0
            for row in body.get("data") or []:
                try:
                    entry = ConfluentTelemetryRow.model_validate(row)
                except ValidationError:
                    # A row missing either half attributes nothing, and the rest of the
                    # page is still usable, so it is dropped rather than raised. Counted
                    # per page rather than logged per row: a response that changes shape
                    # would otherwise emit a line per pair on the whole cluster.
                    skipped += 1
                    continue
                # Discarded here rather than after the loop, because this map is held
                # across every page: on a busy cluster the applications producing to it
                # far outnumber the connectors, and none of them can ever be attributed.
                if not CONFLUENT_PRODUCER_CLIENT_PATTERN.match(entry.client_id):
                    continue
                by_client.setdefault(entry.client_id, set()).add(entry.topic)

            if skipped:
                logger.debug(
                    "Skipped %s unattributable Confluent telemetry rows out of %s for cluster %s",
                    skipped,
                    len(body.get("data") or []),
                    cluster_id,
                )

            # A cluster with more producer/topic pairs than fit in one page returns a
            # cursor. Stopping at the first page would drop topics silently, and a
            # connector resolving a partial set looks indistinguishable from a complete one.
            page_token = ((body.get("meta") or {}).get("pagination") or {}).get("next_page_token")
            if not page_token:
                break
        else:
            # Only when the full budget was asked for. A caller that deliberately reads one
            # page has not lost anything it wanted, and warning there would report a problem
            # during a test connection that ran exactly as intended.
            if max_pages == CONFLUENT_TELEMETRY_MAX_PAGES:
                logger.warning(
                    "Stopped reading Confluent telemetry after %s pages for cluster %s, topic resolution may be incomplete",
                    max_pages,
                    cluster_id,
                )

        return by_client

    def _telemetry_topics_for_connector_ids(self, cluster_id: str) -> dict[str, set[str]]:
        """
        Topics each connector produced to, keyed by connector id, fetched once per run.

        The telemetry response covers every producer on the cluster, most of which belong
        to applications that are not connectors at all, and the window outlives the
        connectors in it, so it also carries ones deleted since. Only clients belonging to
        a connector that currently exists are kept: a deleted connector could never be
        attributed anyway, and retaining it would grow this with churn rather than with the
        number of connectors the cluster has.
        """
        if self._telemetry_topics_by_connector_id is not None:
            return self._telemetry_topics_by_connector_id

        live_connector_ids = set(self._connector_id_by_name().values())
        by_connector: dict[str, set[str]] = {}
        try:
            for client_id, client_topics in self._query_dataflow_topics_by_client(cluster_id).items():
                match = CONFLUENT_PRODUCER_CLIENT_PATTERN.match(client_id)
                if match and match.group("connector_id") in live_connector_ids:
                    by_connector.setdefault(match.group("connector_id"), set()).update(client_topics)
        except Exception as exc:
            # Recorded as empty rather than left unset, so one failure does not become one
            # failed call per connector. The API is rate limited per hour, and a large
            # estate would spend that budget retrying a call that already failed.
            logger.warning("Confluent telemetry unavailable for cluster %s, topics not enriched: %s", cluster_id, exc)
            logger.debug(traceback.format_exc())

        self._telemetry_topics_by_connector_id = by_connector
        return by_connector

    def _list_topics_from_telemetry(
        self, connector: str, connector_config: dict | None = None
    ) -> list[KafkaConnectTopics] | None:
        """
        Topics this connector actually produced to, per Confluent's telemetry.

        This is the only source that knows a name chosen from row data, so it is consulted
        before the connector's declared configuration. It reports observed activity, so a
        connector that produced nothing in the window resolves nothing here and the
        declared names are still used.

        Returns None rather than raising: telemetry is additive, and a connector that
        cannot be attributed with confidence must contribute no edge at all.
        """
        if not self.is_confluent_cloud or not self._telemetry_auth:
            return None

        cluster_id = self._confluent_kafka_cluster_id()
        if not cluster_id:
            return None

        try:
            connector_id = self._connector_id_by_name().get(connector)
            if not connector_id:
                logger.debug("No Confluent connector id for '%s', skipping telemetry lookup", connector)
                return None

            topics = set(self._telemetry_topics_for_connector_ids(cluster_id).get(connector_id) or ())
            topics -= extract_internal_topic_names(connector_config)
            topics -= confluent_managed_internal_topic_names(connector_config, connector_id)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.debug("Confluent telemetry lookup failed for '%s': %s", connector, exc)
            return None

        if not topics:
            return None

        logger.info("Resolved %s topic(s) for '%s' from Confluent telemetry", len(topics), connector)
        return [KafkaConnectTopics(name=topic) for topic in sorted(topics)]

    def _infer_cdc_topics_from_server_name(self, database_server_name: str) -> list[KafkaConnectTopics] | None:
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

            # For CDC connectors without explicit topics, try to infer from server name
            if not connector_details.topics and (connector_details.conn_type or "").lower() == "source":
                database_server_name = connector_details.config.get(
                    "database.server.name"
                ) or connector_details.config.get("topic.prefix")
                if database_server_name:
                    inferred_topics = self._infer_cdc_topics_from_server_name(database_server_name) or None
                    if inferred_topics:
                        connector_details.topics = inferred_topics

    def get_cluster_info(self) -> dict | None:
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
    ) -> dict | None:
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

    def get_connector_plugins(self) -> dict | None:
        """
        Get the list of connector plugins.
        """
        try:
            return self.client.list_connector_plugins()
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get connector plugins  {exc}")

    def check_confluent_telemetry(self) -> bool:
        """
        Validate that the Telemetry API answers, for the test-connection step.

        Self-hosted Connect serves the topics endpoint directly and never consults
        telemetry, so there is nothing to validate and the step reports success rather than
        a failure the operator cannot act on.

        Unlike the resolution path this raises, because a test step reports failure by
        raising and the operator is the one who can fix the credentials.

        One page is read rather than all of them. Whether the API answers and accepts the
        credentials is settled by the first response, while walking the rest would spend a
        request per page against an endpoint that rate limits by the hour, and would leave
        an operator waiting on a check that has already learned its answer.
        """
        cluster_id = self._confluent_kafka_cluster_id()
        if not cluster_id or not self._telemetry_auth:
            return True

        self._query_dataflow_topics_by_client(cluster_id, max_pages=1)
        return True

    def get_connector_config(self, connector: str) -> dict | None:
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

    def extract_column_mappings(self, connector_config: dict) -> list[KafkaConnectColumnMapping] | None:
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

    def _list_topics_from_api(self, connector: str) -> list[KafkaConnectTopics] | None:
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
                        "Connect /connectors/{name}/topics is unavailable on this cluster (%s)."
                        "%s Falling back to topic names declared in connector configs. "
                        "Connectors that route by row value (e.g. a Debezium outbox EventRouter) "
                        "cannot be resolved this way.",
                        exc,
                        remedy,
                    )
            else:
                logger.warning(
                    "Transient failure listing topics for connector '%s' (%s); "
                    "will retry the endpoint for the next connector.",
                    connector,
                    exc,
                )
            logger.debug(traceback.format_exc())
        return None

    def _list_data_topics_from_api(
        self,
        connector: str,
        connector_config: dict | None,
    ) -> list[KafkaConnectTopics] | None:
        """
        The topics the Connect runtime says this connector touched, minus its own
        bookkeeping topics.

        Returns None when that leaves nothing, so the caller falls back to the
        config-declared names. Active-topic tracking records what a connector has
        touched so far, so a connector that has produced nothing, or so far only its own
        schema-change topic, is at a cold start rather than asserting it has no data
        topics. Its declared names are still the better answer.
        """
        topics = self._list_topics_from_api(connector)
        if not topics:
            return None

        excluded = extract_internal_topic_names(connector_config)
        data_topics = [topic for topic in topics if topic.name not in excluded]
        dropped = len(topics) - len(data_topics)
        if dropped:
            logger.debug(
                "Excluded %s internal topic(s) from connector '%s': %s",
                dropped,
                connector,
                sorted(excluded & {topic.name for topic in topics}),
            )
        return data_topics or None

    @staticmethod
    def _parse_topics_from_config(connector_config: dict | None) -> list[KafkaConnectTopics] | None:
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
        connector_config: dict | None = None,
    ) -> list[KafkaConnectTopics] | None:
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
            Optional[List[KafkaConnectTopics]]: The connector's data topics, or None when
                                            neither source names one.
        """
        try:
            config = connector_config if connector_config is not None else self.get_connector_config(connector)

            topics = self._list_data_topics_from_api(connector, config)
            if topics:
                return topics

            # Before the declared names, because both this and the runtime list describe
            # what the connector actually did, whereas the config only describes what it
            # was asked to do. On Confluent Cloud the runtime list is never available, so
            # for a connector routing by row value this is the only source that can answer.
            topics = self._list_topics_from_telemetry(connector, connector_config=config)
            if topics:
                return topics

            topics = self._parse_topics_from_config(config)
            if topics:
                logger.info(f"Extracted {len(topics)} topics from connector config for {connector}")
                return topics
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Unable to get connector Topics {exc}")

        return None

    def get_connector_list(self) -> Iterable[KafkaConnectPipelineDetails] | None:
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
