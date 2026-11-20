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
ClickHouse Kafka table engine lineage extraction.

ClickHouse streaming pipelines ingest from Kafka via `ENGINE = Kafka` tables before
materialized views move rows into MergeTree targets. Because `system.query_log` and
view definitions only capture the `Kafka Table -> Materialized View -> Target Table`
hops, this module reads `system.tables` for `engine = 'Kafka'` and links each uniquely
resolved OpenMetadata `Topic` upstream of the ClickHouse `Table`
(ADR:2026-11-13-clickhouse-kafka-lineage-requires-unique-service-resolution).
"""

import traceback
from collections import defaultdict
from collections.abc import Iterable
from typing import TYPE_CHECKING, Any, NamedTuple

from cachetools import LRUCache
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import Source as LineageEdgeSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.schema import DataTypeTopic, FieldModel
from metadata.ingestion.api.models import Either
from metadata.ingestion.models.ometa_lineage import OMetaLineageRequest
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.clickhouse.lineage_utils import (
    TOKEN_PATTERN,
    _identifier,
    _is_keyword,
)
from metadata.ingestion.source.database.clickhouse.queries import (
    CLICKHOUSE_KAFKA_ENGINE_TABLES,
)
from metadata.utils import fqn
from metadata.utils.filters import (
    filter_by_database,
    filter_by_schema,
    filter_by_table,
)
from metadata.utils.logger import ingestion_logger

if TYPE_CHECKING:
    from metadata.ingestion.source.database.clickhouse.lineage import (
        ClickhouseLineageSource,
    )

logger = ingestion_logger()

SERVICE_CACHE_MAX_SIZE = 128
TOPIC_CACHE_MAX_SIZE = 1024
TABLE_CACHE_MAX_SIZE = 512

# ClickHouse exposes Kafka message metadata through virtual columns on ENGINE = Kafka
# tables; they never originate from fields in the topic's message payload schema.
CLICKHOUSE_KAFKA_VIRTUAL_COLUMNS: frozenset[str] = frozenset(
    {
        "_topic",
        "_key",
        "_offset",
        "_partition",
        "_timestamp",
        "_timestamp_ms",
        "_headers.name",
        "_headers.value",
        "_raw_message",
        "_error",
    }
)


class KafkaEngineConfig(NamedTuple):
    """Parsed connection and topic settings from a ClickHouse `ENGINE = Kafka` clause."""

    brokers: tuple[str, ...]
    topics: tuple[str, ...]
    named_collection: str | None = None


class BrokerEndpoints(NamedTuple):
    """Normalized broker `host:port` pairs and bare hostnames for service matching."""

    host_ports: frozenset[str]
    hosts: frozenset[str]


def _unquote_string_literal(token: str | None) -> str | None:
    """Unescape a single-quoted ClickHouse SQL literal (`\\'` and `''` escapes)."""
    if not token or len(token) < 2 or token[0] != "'" or token[-1] != "'":
        return None
    inner = token[1:-1]
    chars: list[str] = []
    idx = 0
    length = len(inner)
    while idx < length:
        ch = inner[idx]
        if ch == "\\" and idx + 1 < length:
            chars.append(inner[idx + 1])
            idx += 2
        elif ch == "'" and idx + 1 < length and inner[idx + 1] == "'":
            chars.append("'")
            idx += 2
        else:
            chars.append(ch)
            idx += 1
    return "".join(chars)


def _split_csv_values(raw: str | None) -> tuple[str, ...]:
    if not raw:
        return ()
    items = [part.strip() for part in raw.split(",") if part.strip()]
    return tuple(dict.fromkeys(items))


def _locate_kafka_engine_tail(sql_fragment: str) -> list[str] | None:
    """Return the tokens immediately following `Kafka` in `engine_full` or `CREATE TABLE` DDL."""
    tokens = TOKEN_PATTERN.findall(sql_fragment)
    if not tokens:
        return None
    if _is_keyword(tokens[0], "KAFKA"):
        return tokens[1:]

    depth = 0
    for idx, token in enumerate(tokens):
        if token == "(":
            depth += 1
        elif token == ")" and depth > 0:
            depth -= 1
        elif (
            depth == 0
            and _is_keyword(token, "ENGINE")
            and idx + 2 < len(tokens)
            and tokens[idx + 1] == "="
            and _is_keyword(tokens[idx + 2], "KAFKA")
        ):
            return tokens[idx + 3 :]
    return None


def _consume_parenthesized(tokens: list[str], start: int) -> tuple[list[list[str]], int]:
    """Split top-level comma-separated argument token lists inside `(...)`."""
    args: list[list[str]] = []
    current: list[str] = []
    depth = 0
    idx = start
    while idx < len(tokens):
        tok = tokens[idx]
        if tok == "(":
            depth += 1
            if depth > 1:
                current.append(tok)
        elif tok == ")":
            depth -= 1
            if depth == 0:
                if current:
                    args.append(current)
                return args, idx + 1
            current.append(tok)
        elif tok == "," and depth == 1:
            args.append(current)
            current = []
        else:
            current.append(tok)
        idx += 1
    if current:
        args.append(current)
    return args, idx


def _parse_settings_clause(tokens: list[str], start: int) -> dict[str, str]:
    """Extract string-valued settings from a `SETTINGS k1 = 'v1', k2 = 2, ...` tail."""
    settings: dict[str, str] = {}
    idx = start
    length = len(tokens)
    while idx + 2 < length:
        key = _identifier(tokens[idx])
        if not key or tokens[idx + 1] != "=":
            break
        idx += 2
        val_tokens: list[str] = []
        depth = 0
        while idx < length:
            tok = tokens[idx]
            if tok in ("(", "["):
                depth += 1
                val_tokens.append(tok)
            elif tok in (")", "]") and depth > 0:
                depth -= 1
                val_tokens.append(tok)
            elif depth == 0 and (tok in (",", ";") or _is_keyword(tok, "COMMENT")):
                break
            else:
                val_tokens.append(tok)
            idx += 1

        if len(val_tokens) == 1:
            literal = _unquote_string_literal(val_tokens[0])
            if literal is not None:
                settings[key.lower()] = literal

        if idx < length and tokens[idx] == ",":
            idx += 1
        else:
            break
    return settings


def _parse_engine_arguments(
    arg_groups: list[list[str]],
) -> tuple[str | None, str | None, str | None, dict[str, str]]:
    """Parse positional or named-collection arguments inside `Kafka(...)`."""
    positional_brokers: str | None = None
    positional_topics: str | None = None
    named_collection: str | None = None
    settings: dict[str, str] = {}
    pos_idx = 0

    for group in arg_groups:
        if not group:
            continue
        if len(group) >= 3 and group[1] == "=":
            key = _identifier(group[0])
            literal = _unquote_string_literal(group[2]) if len(group) == 3 else None
            if key and literal is not None:
                settings[key.lower()] = literal
            continue

        if len(group) == 1:
            literal = _unquote_string_literal(group[0])
            if pos_idx == 0:
                if literal is not None:
                    positional_brokers = literal
                else:
                    named_collection = _identifier(group[0])
            elif pos_idx == 1 and named_collection is None and literal is not None:
                positional_topics = literal
        pos_idx += 1

    return positional_brokers, positional_topics, named_collection, settings


def _parse_single_fragment(fragment: str | None) -> KafkaEngineConfig | None:
    if not fragment:
        return None
    tail = _locate_kafka_engine_tail(fragment)
    if tail is None:
        return None

    positional_brokers: str | None = None
    positional_topics: str | None = None
    named_collection: str | None = None
    settings: dict[str, str] = {}

    idx = 0
    if idx < len(tail) and tail[idx] == "(":
        arg_groups, idx = _consume_parenthesized(tail, idx)
        (
            positional_brokers,
            positional_topics,
            named_collection,
            settings,
        ) = _parse_engine_arguments(arg_groups)

    depth = 0
    while idx < len(tail):
        tok = tail[idx]
        if tok == "(":
            depth += 1
        elif tok == ")" and depth > 0:
            depth -= 1
        elif depth == 0 and _is_keyword(tok, "SETTINGS"):
            settings.update(_parse_settings_clause(tail, idx + 1))
            break
        idx += 1

    raw_brokers = settings.get("kafka_broker_list") or positional_brokers
    raw_topics = settings.get("kafka_topic_list") or settings.get("kafka_topic") or positional_topics
    return KafkaEngineConfig(
        brokers=_split_csv_values(raw_brokers),
        topics=_split_csv_values(raw_topics),
        named_collection=named_collection,
    )


def parse_kafka_engine_config(
    engine_full: str | None,
    create_table_query: str | None,
) -> KafkaEngineConfig | None:
    """
    Parse broker and topic configuration from ClickHouse `system.tables` metadata.

    Prefers `engine_full` and falls back to `create_table_query` when `engine_full`
    is absent or lacks topic/broker overrides. Only non-sensitive routing tokens
    (`brokers`, `topics`, `named_collection`) are returned.
    """
    primary = _parse_single_fragment(engine_full)
    if primary is not None and primary.topics and (primary.brokers or primary.named_collection):
        return primary

    secondary = _parse_single_fragment(create_table_query)
    if primary is None:
        return secondary
    if secondary is None:
        return primary

    return KafkaEngineConfig(
        brokers=primary.brokers or secondary.brokers,
        topics=primary.topics or secondary.topics,
        named_collection=primary.named_collection or secondary.named_collection,
    )


def extract_broker_endpoints(raw_entries: Iterable[str]) -> BrokerEndpoints:
    """Normalize comma-separated broker lists (stripping `SASL_SSL://` etc.) into `host:port` and `host` sets."""
    host_ports: set[str] = set()
    hosts: set[str] = set()

    for entry in raw_entries:
        if not entry:
            continue
        for raw_item in entry.split(","):
            cleaned = raw_item.strip()
            if not cleaned:
                continue
            if "://" in cleaned:
                cleaned = cleaned.split("://", 1)[1]
            cleaned = cleaned.split("/", 1)[0].strip().lower()
            if not cleaned:
                continue

            if cleaned.startswith("["):
                bracket_end = cleaned.find("]")
                if bracket_end != -1:
                    ipv6_host = cleaned[: bracket_end + 1]
                    rest = cleaned[bracket_end + 1 :]
                    hosts.add(ipv6_host)
                    if rest.startswith(":") and rest[1:]:
                        host_ports.add(f"{ipv6_host}:{rest[1:]}")
                continue

            if ":" in cleaned:
                host, port = cleaned.rsplit(":", 1)
                host = host.strip()
                port = port.strip()
                if host:
                    hosts.add(host)
                    if port:
                        host_ports.add(f"{host}:{port}")
            else:
                hosts.add(cleaned)

    return BrokerEndpoints(
        host_ports=frozenset(host_ports),
        hosts=frozenset(hosts),
    )


def _candidate_schema_fields(topic: Topic) -> tuple[list[FieldModel], FieldModel | None]:
    """
    Return `(primary_fields, fallback_record_wrapper)`.

    Confluent Schema Registry topics often wrap message fields inside a single top-level
    `RECORD` field; we unwrap its children as primary candidates while retaining the
    wrapper `RECORD` itself as a fallback when a ClickHouse column maps to the whole
    record (e.g. `Tuple` / `JSON`). Single top-level `ARRAY` or `UNION` fields are NOT
    unwrapped so array/union columns match their top-level field rather than inner items.
    """
    if not topic.messageSchema or not topic.messageSchema.schemaFields:
        return [], None
    top_fields = list(topic.messageSchema.schemaFields)
    if len(top_fields) == 1 and top_fields[0].dataType == DataTypeTopic.RECORD and top_fields[0].children:
        return list(top_fields[0].children), top_fields[0]
    return top_fields, None


def _match_column_to_field(
    col_name: str,
    exact_fields: dict[str, FieldModel],
    lower_fields: dict[str, list[FieldModel]],
    fallback_wrapper: FieldModel | None,
) -> FieldModel | None:
    matched_field = exact_fields.get(col_name)
    if matched_field is None:
        ci_candidates = lower_fields.get(col_name.lower(), [])
        if len(ci_candidates) == 1:
            matched_field = ci_candidates[0]
    if matched_field is None and fallback_wrapper is not None:
        wrapper_name = model_str(fallback_wrapper.name)
        if wrapper_name and (wrapper_name == col_name or wrapper_name.lower() == col_name.lower()):
            matched_field = fallback_wrapper
    return matched_field


def build_topic_to_table_column_lineage(
    topic: Topic,
    table: Table,
) -> list[ColumnLineage]:
    """
    Match `Topic.messageSchema.schemaFields` to ClickHouse `Table.columns`.

    Excludes ClickHouse Kafka virtual columns (`_topic`, `_key`, `_offset`, ...).
    Prefers exact field-name match, falling back to case-insensitive match only
    when a single topic field matches unambiguously.
    """
    fields, fallback_wrapper = _candidate_schema_fields(topic)
    if (not fields and fallback_wrapper is None) or not table.columns:
        return []

    exact_fields: dict[str, FieldModel] = {}
    lower_fields: dict[str, list[FieldModel]] = defaultdict(list)
    for field in fields:
        field_name = model_str(field.name)
        if not field_name:
            continue
        exact_fields.setdefault(field_name, field)
        lower_fields[field_name.lower()].append(field)

    topic_fqn = model_str(topic.fullyQualifiedName)
    table_fqn = model_str(table.fullyQualifiedName)
    column_lineage: list[ColumnLineage] = []

    for col in table.columns:
        col_name = model_str(col.name)
        if not col_name or col_name.lower() in CLICKHOUSE_KAFKA_VIRTUAL_COLUMNS:
            continue

        matched_field = _match_column_to_field(
            col_name=col_name,
            exact_fields=exact_fields,
            lower_fields=lower_fields,
            fallback_wrapper=fallback_wrapper,
        )
        if matched_field is None:
            continue

        from_col_fqn = (
            model_str(matched_field.fullyQualifiedName)
            if matched_field.fullyQualifiedName
            else f"{topic_fqn}.{fqn.quote_name(model_str(matched_field.name))}"
        )
        to_col_fqn = (
            model_str(col.fullyQualifiedName) if col.fullyQualifiedName else f"{table_fqn}.{fqn.quote_name(col_name)}"
        )
        column_lineage.append(
            ColumnLineage(
                fromColumns=[FullyQualifiedEntityName(root=from_col_fqn)],
                toColumn=FullyQualifiedEntityName(root=to_col_fqn),
            )
        )

    return column_lineage


class ClickhouseKafkaLineageExtractor:
    """Extracts `Topic -> Table` lineage for ClickHouse `ENGINE = Kafka` tables."""

    def __init__(self, source: "ClickhouseLineageSource") -> None:
        self._source = source
        self._metadata = source.metadata
        self._service_name = str(source.config.serviceName)
        self._source_config = source.source_config
        self._service_connection = source.service_connection

        self._service_cache: LRUCache[str, tuple[MessagingService | None, bool]] = LRUCache(
            maxsize=SERVICE_CACHE_MAX_SIZE
        )
        self._broker_cache: LRUCache[str, BrokerEndpoints] = LRUCache(maxsize=SERVICE_CACHE_MAX_SIZE)
        self._topic_cache: LRUCache[str, Topic | None] = LRUCache(maxsize=TOPIC_CACHE_MAX_SIZE)
        self._table_cache: LRUCache[str, Table | None] = LRUCache(maxsize=TABLE_CACHE_MAX_SIZE)
        self._all_messaging_services: list[MessagingService] | None = None

    def _resolve_database_name(self) -> str:
        custom_db = getattr(self._service_connection, "databaseName", None)
        return str(custom_db) if custom_db else "default"

    def _get_messaging_service(self, name: str) -> tuple[MessagingService | None, bool]:
        if name in self._service_cache:
            return self._service_cache[name]
        try:
            service = self._metadata.get_by_name(entity=MessagingService, fqn=name)
        except Exception as exc:
            logger.warning(
                "Failed to fetch MessagingService [%s] from OpenMetadata: %s",
                name,
                exc,
            )
            logger.debug(traceback.format_exc())
            self._service_cache[name] = (None, True)
            return None, True
        self._service_cache[name] = (service, False)
        return service, False

    def _get_all_messaging_services(self) -> list[MessagingService]:
        if self._all_messaging_services is not None:
            return self._all_messaging_services
        try:
            services = list(self._metadata.list_all_entities(entity=MessagingService) or [])
        except Exception as exc:
            logger.warning(
                "Failed to list MessagingService entities for ClickHouse Kafka lineage: %s",
                exc,
            )
            logger.debug(traceback.format_exc())
            self._all_messaging_services = []
            return self._all_messaging_services
        for svc in services:
            svc_name = model_str(svc.name)
            if svc_name:
                self._service_cache[svc_name] = (svc, False)
        self._all_messaging_services = services
        return services

    def _get_service_brokers(self, service: MessagingService) -> BrokerEndpoints:
        svc_name = model_str(service.name)
        if svc_name in self._broker_cache:
            return self._broker_cache[svc_name]

        bootstrap_servers: str | None = None
        if service.connection and service.connection.config:
            bootstrap_servers = getattr(service.connection.config, "bootstrapServers", None)
        endpoints = (
            extract_broker_endpoints([bootstrap_servers])
            if bootstrap_servers
            else BrokerEndpoints(frozenset(), frozenset())
        )
        if svc_name:
            self._broker_cache[svc_name] = endpoints
        return endpoints

    def _match_services_by_brokers(
        self,
        services: list[MessagingService],
        ddl_brokers: tuple[str, ...],
    ) -> list[MessagingService]:
        ddl_endpoints = extract_broker_endpoints(ddl_brokers)
        if not ddl_endpoints.hosts and not ddl_endpoints.host_ports:
            return []

        exact_port_matches: list[MessagingService] = []
        host_only_matches: list[MessagingService] = []
        for svc in services:
            svc_endpoints = self._get_service_brokers(svc)
            if ddl_endpoints.host_ports & svc_endpoints.host_ports:
                exact_port_matches.append(svc)
            elif ddl_endpoints.hosts & svc_endpoints.hosts:
                host_only_matches.append(svc)

        return exact_port_matches or host_only_matches

    def _resolve_explicit_services(self) -> tuple[bool, list[MessagingService]]:
        """
        Return `(has_explicit_scope, resolved_services)`.

        `messagingServiceNames` (when containing at least one non-blank entry) always
        establishes an explicit scope so typos fail closed rather than scanning other
        clusters. `crossDatabaseServiceNames` contributes entries that resolve to a
        `MessagingService`, preserving broker auto-discovery when it holds only 404
        `DatabaseService` names. Any non-404 API error in either list fails closed
        (`(True, [])`) so transient server failures never collapse multi-service scopes
        or escape into global broker discovery.
        """
        configured_messaging = [
            s.strip() for s in (getattr(self._source_config, "messagingServiceNames", None) or []) if s and s.strip()
        ]
        configured_cross_db = [
            s.strip()
            for s in (getattr(self._source_config, "crossDatabaseServiceNames", None) or [])
            if s and s.strip()
        ]

        resolved: list[MessagingService] = []
        seen: set[str] = set()

        for name in configured_messaging:
            if name in seen:
                continue
            seen.add(name)
            svc, had_error = self._get_messaging_service(name)
            if had_error:
                logger.warning(
                    "Aborting ClickHouse Kafka lineage because configured messaging service [%s] "
                    "could not be fetched from OpenMetadata.",
                    name,
                )
                return True, []
            if svc is not None:
                resolved.append(svc)
            else:
                logger.warning(
                    "Configured messaging service [%s] not found in OpenMetadata",
                    name,
                )

        for name in configured_cross_db:
            if name in seen:
                continue
            svc, had_error = self._get_messaging_service(name)
            if had_error:
                logger.warning(
                    "Aborting ClickHouse Kafka lineage because configured cross-database "
                    "service [%s] could not be checked as a MessagingService.",
                    name,
                )
                return True, []
            if svc is not None:
                seen.add(name)
                resolved.append(svc)

        has_explicit_scope = bool(configured_messaging) or bool(resolved)
        return has_explicit_scope, resolved

    def _resolve_candidate_services(
        self,
        engine_config: KafkaEngineConfig,
        schema_name: str,
        table_name: str,
        has_explicit_scope: bool,
        explicit_services: list[MessagingService],
    ) -> list[MessagingService]:
        if has_explicit_scope:
            if not explicit_services:
                return []
            if engine_config.brokers:
                matched = self._match_services_by_brokers(explicit_services, engine_config.brokers)
                if matched:
                    return matched
            return explicit_services

        if not engine_config.brokers:
            logger.warning(
                "ClickHouse Kafka table [%s.%s] uses Named Collection [%s] without "
                "brokers in DDL and `messagingServiceNames` is not configured; "
                "skipping topic lineage to avoid cross-cluster guessing.",
                schema_name,
                table_name,
                engine_config.named_collection or "unknown",
            )
            return []

        matched = self._match_services_by_brokers(self._get_all_messaging_services(), engine_config.brokers)
        if not matched:
            ddl_hosts = sorted(extract_broker_endpoints(engine_config.brokers).hosts)
            logger.debug(
                "No MessagingService matched broker hosts %s for ClickHouse table [%s.%s]",
                ddl_hosts,
                schema_name,
                table_name,
            )
        return matched

    def _get_topic(self, service_name: str, topic_name: str) -> tuple[Topic | None, bool]:
        if not fqn.is_valid_entity_name(topic_name):
            logger.warning(
                "Skipping invalid Kafka topic name [%s] under service [%s]",
                topic_name,
                service_name,
            )
            return None, False
        try:
            topic_fqn = fqn._build(service_name, topic_name)
        except ValueError as exc:
            logger.warning(
                "Skipping malformed Kafka topic FQN for topic [%s] under service [%s]: %s",
                topic_name,
                service_name,
                exc,
            )
            return None, False

        if topic_fqn in self._topic_cache:
            return self._topic_cache[topic_fqn], False
        try:
            topic = self._metadata.get_by_name(entity=Topic, fqn=topic_fqn)
        except Exception as exc:
            logger.warning(
                "Failed to fetch Topic [%s] while resolving ClickHouse Kafka lineage: %s",
                topic_fqn,
                exc,
            )
            logger.debug(traceback.format_exc())
            return None, True
        self._topic_cache[topic_fqn] = topic
        return topic, False

    def _get_table(self, table_fqn: str) -> Table | None:
        if table_fqn in self._table_cache:
            return self._table_cache[table_fqn]
        try:
            table = self._metadata.get_by_name(entity=Table, fqn=table_fqn)
        except Exception as exc:
            logger.warning(
                "Failed to fetch ClickHouse Table [%s] from OpenMetadata: %s",
                table_fqn,
                exc,
            )
            logger.debug(traceback.format_exc())
            return None
        self._table_cache[table_fqn] = table
        return table

    def _resolve_unique_topic(
        self,
        topic_name: str,
        candidate_services: list[MessagingService],
        schema_name: str,
        table_name: str,
    ) -> tuple[Topic | None, bool]:
        matched_topics: list[tuple[str, Topic]] = []
        for service in candidate_services:
            service_name = model_str(service.name)
            if not service_name:
                continue
            topic, had_error = self._get_topic(service_name, topic_name)
            if had_error:
                if len(candidate_services) > 1:
                    logger.warning(
                        "Aborting resolution of Kafka topic [%s] for ClickHouse table [%s.%s] "
                        "because lookup in candidate service [%s] failed.",
                        topic_name,
                        schema_name,
                        table_name,
                        service_name,
                    )
                return None, True
            if topic is not None:
                matched_topics.append((service_name, topic))

        if not matched_topics:
            logger.debug(
                "Kafka topic [%s] for ClickHouse table [%s.%s] not found in candidate services %s",
                topic_name,
                schema_name,
                table_name,
                [model_str(s.name) for s in candidate_services],
            )
            return None, False

        if len(matched_topics) > 1:
            matched_names = [svc_name for svc_name, _ in matched_topics]
            logger.warning(
                "Ambiguous Kafka topic [%s] for ClickHouse table [%s.%s] matched multiple "
                "messaging services %s; skipping lineage edge.",
                topic_name,
                schema_name,
                table_name,
                matched_names,
            )
            return None, False

        return matched_topics[0][1], False

    def _resolve_table_topics(
        self,
        topic_names: tuple[str, ...],
        candidate_services: list[MessagingService],
        schema_name: str,
        table_name: str,
    ) -> tuple[list[Topic], bool]:
        resolved_topics: list[Topic] = []
        any_lookup_error = False
        for topic_name in topic_names:
            topic_entity, topic_had_error = self._resolve_unique_topic(
                topic_name=topic_name,
                candidate_services=candidate_services,
                schema_name=schema_name,
                table_name=table_name,
            )
            if topic_had_error:
                any_lookup_error = True
            if topic_entity is not None and topic_entity.id is not None:
                resolved_topics.append(topic_entity)
        return resolved_topics, any_lookup_error

    def _process_kafka_table_row(
        self,
        raw_row: Any,
        database_name: str,
        has_explicit_scope: bool,
        explicit_services: list[MessagingService],
        override_lineage: bool,
    ) -> Iterable[Either[OMetaLineageRequest]]:
        row_dict = raw_row._asdict() if hasattr(raw_row, "_asdict") else dict(raw_row)
        normalized = {str(k).lower(): v for k, v in row_dict.items()}
        schema_name = str(normalized.get("database") or "").strip()
        table_name = str(normalized.get("name") or "").strip()
        if not schema_name or not table_name:
            return

        configured_schema = getattr(self._service_connection, "databaseSchema", None)
        if configured_schema and schema_name != configured_schema:
            return

        if filter_by_schema(getattr(self._source_config, "schemaFilterPattern", None), schema_name) or filter_by_table(
            getattr(self._source_config, "tableFilterPattern", None), table_name
        ):
            self._source.status.filter(
                f"{schema_name}.{table_name}",
                "ClickHouse Kafka Table Filtered Out",
            )
            return

        engine_config = parse_kafka_engine_config(
            engine_full=normalized.get("engine_full"),
            create_table_query=normalized.get("create_table_query"),
        )
        if engine_config is None or not engine_config.topics:
            logger.debug(
                "No Kafka topics extracted from ClickHouse table [%s.%s]; skipping",
                schema_name,
                table_name,
            )
            return

        table_fqn = fqn.build(
            metadata=None,
            entity_type=Table,
            service_name=self._service_name,
            database_name=database_name,
            schema_name=schema_name,
            table_name=table_name,
            skip_es_search=True,
        )
        if not table_fqn:
            return
        table_entity = self._get_table(table_fqn)
        if table_entity is None or table_entity.id is None:
            logger.debug(
                "ClickHouse Kafka table [%s] is not ingested in OpenMetadata; skipping",
                table_fqn,
            )
            return

        candidate_services = self._resolve_candidate_services(
            engine_config=engine_config,
            schema_name=schema_name,
            table_name=table_name,
            has_explicit_scope=has_explicit_scope,
            explicit_services=explicit_services,
        )
        if not candidate_services:
            return

        resolved_topics, any_topic_error = self._resolve_table_topics(
            topic_names=engine_config.topics,
            candidate_services=candidate_services,
            schema_name=schema_name,
            table_name=table_name,
        )
        if not resolved_topics:
            return

        # Only clear existing ExternalTableLineage edges on the first emitted edge for
        # this table when every configured topic lookup completed without transient API
        # errors; otherwise override_lineage=True would delete healthy sibling topic edges.
        effective_override = override_lineage and not any_topic_error
        first_edge_for_table = True
        for topic_entity in resolved_topics:
            if topic_entity.id is None or table_entity.id is None:
                continue
            columns_lineage = build_topic_to_table_column_lineage(
                topic=topic_entity,
                table=table_entity,
            )
            # Never attach raw ClickHouse DDL to sqlQuery: ENGINE = Kafka SETTINGS can
            # contain plaintext `kafka_sasl_password`.
            add_lineage_request = AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(  # pyright: ignore[reportCallIssue]
                        id=topic_entity.id,
                        type="topic",
                    ),
                    toEntity=EntityReference(  # pyright: ignore[reportCallIssue]
                        id=table_entity.id,
                        type="table",
                    ),
                    lineageDetails=LineageDetails(  # pyright: ignore[reportCallIssue]
                        source=LineageEdgeSource.ExternalTableLineage,
                        sqlQuery=None,
                        columnsLineage=columns_lineage or None,
                    ),
                )
            )
            yield Either(
                left=None,
                right=OMetaLineageRequest(
                    lineage_request=add_lineage_request,
                    override_lineage=effective_override and first_edge_for_table,
                ),
            )
            first_edge_for_table = False

    def iter_lineage(self) -> Iterable[Either[OMetaLineageRequest]]:
        database_name = self._resolve_database_name()
        if filter_by_database(
            getattr(self._source_config, "databaseFilterPattern", None),
            database_name,
        ):
            logger.debug(
                "Database [%s] excluded by databaseFilterPattern; skipping ClickHouse Kafka lineage",
                database_name,
            )
            return

        has_explicit_scope, explicit_services = self._resolve_explicit_services()
        override_lineage = bool(getattr(self._source_config, "overrideViewLineage", False))

        try:
            for engine in self._source.get_engine():
                if engine is None:
                    continue
                with engine.connect() as conn:
                    rows = conn.execute(text(CLICKHOUSE_KAFKA_ENGINE_TABLES))
                    for raw_row in rows:
                        try:
                            yield from self._process_kafka_table_row(
                                raw_row=raw_row,
                                database_name=database_name,
                                has_explicit_scope=has_explicit_scope,
                                explicit_services=explicit_services,
                                override_lineage=override_lineage,
                            )
                        except Exception as row_exc:
                            logger.warning(
                                "Skipping ClickHouse Kafka table row due to error (%s)",
                                type(row_exc).__name__,
                            )
                            logger.debug(traceback.format_exc())
        except (SQLAlchemyError, OSError) as exc:
            logger.warning(
                "Failed to query system.tables for ClickHouse Kafka lineage (%s); skipping",
                type(exc).__name__,
            )
            logger.debug(traceback.format_exc())
        except Exception as exc:
            logger.warning(
                "Unexpected error extracting ClickHouse Kafka engine lineage (%s); skipping",
                type(exc).__name__,
            )
            logger.debug(traceback.format_exc())


def yield_kafka_engine_lineage(
    source: "ClickhouseLineageSource",
) -> Iterable[Either[OMetaLineageRequest]]:
    """Entry point invoked from `ClickhouseLineageSource._iter`."""
    if getattr(source, "engine", None) is None:
        return
    logger.info("Processing ClickHouse Kafka Engine Lineage")
    extractor = ClickhouseKafkaLineageExtractor(source)
    yield from extractor.iter_lineage()
