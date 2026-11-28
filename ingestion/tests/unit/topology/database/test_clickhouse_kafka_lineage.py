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
"""Unit tests for ClickHouse Kafka table engine lineage extraction (Issue #37172)."""

import logging
import uuid
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from cachetools import LRUCache
from sqlalchemy.exc import OperationalError

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    DataType,
    Table,
)
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
    KafkaConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.messagingService import (
    MessagingConnection,
    MessagingService,
    MessagingServiceType,
)
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
    DatabaseServiceQueryLineagePipeline,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Uuid,
)
from metadata.generated.schema.type.entityLineage import Source as LineageEdgeSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.generated.schema.type.schema import (
    DataTypeTopic,
    FieldModel,
    FieldName,
)
from metadata.generated.schema.type.schema import (
    Topic as MessageSchema,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.status import Status
from metadata.ingestion.models.ometa_lineage import OMetaLineageRequest
from metadata.ingestion.source.database.clickhouse.kafka_lineage import (
    CLICKHOUSE_KAFKA_VIRTUAL_COLUMNS,
    ClickhouseKafkaLineageExtractor,
    KafkaEngineConfig,
    extract_broker_endpoints,
    parse_kafka_engine_config,
    yield_kafka_engine_lineage,
)
from metadata.ingestion.source.database.clickhouse.lineage import ClickhouseLineageSource
from metadata.ingestion.source.database.clickhouse.queries import (
    CLICKHOUSE_KAFKA_ENGINE_TABLES,
)
from metadata.utils import fqn


def _make_messaging_service(name: str, bootstrap_servers: str) -> MessagingService:
    return MessagingService(
        id=Uuid(root=uuid.uuid4()),
        name=EntityName(root=name),
        fullyQualifiedName=FullyQualifiedEntityName(root=name),
        serviceType=MessagingServiceType.Kafka,
        connection=MessagingConnection(
            config=KafkaConnection(bootstrapServers=bootstrap_servers),
        ),
    )


def _make_topic(
    service_name: str,
    topic_name: str,
    fields: list[FieldModel] | None = None,
) -> Topic:
    topic_fqn = fqn._build(service_name, topic_name)
    populated_fields: list[FieldModel] = []
    for field in fields or []:
        field_fqn = (
            field.fullyQualifiedName.root
            if field.fullyQualifiedName
            else f"{topic_fqn}.{fqn.quote_name(field.name.root)}"
        )
        populated_fields.append(
            field.model_copy(update={"fullyQualifiedName": FullyQualifiedEntityName(root=field_fqn)})
        )
    message_schema = MessageSchema(schemaFields=populated_fields) if populated_fields else None
    return Topic(
        id=Uuid(root=uuid.uuid4()),
        name=EntityName(root=topic_name),
        fullyQualifiedName=FullyQualifiedEntityName(root=topic_fqn),
        service=EntityReference(
            id=Uuid(root=uuid.uuid4()),
            type="messagingService",
            name=service_name,
            fullyQualifiedName=service_name,
        ),
        partitions=1,
        messageSchema=message_schema,
    )


def _make_table(
    service_name: str,
    schema_name: str,
    table_name: str,
    column_names: list[str] | None = None,
    database_name: str = "default",
) -> Table:
    table_fqn = fqn._build(service_name, database_name, schema_name, table_name)
    columns = [
        Column(
            name=ColumnName(root=col_name),
            dataType=DataType.STRING,
            fullyQualifiedName=FullyQualifiedEntityName(root=f"{table_fqn}.{fqn.quote_name(col_name)}"),
        )
        for col_name in (column_names or [])
    ]
    return Table(
        id=Uuid(root=uuid.uuid4()),
        name=EntityName(root=table_name),
        fullyQualifiedName=FullyQualifiedEntityName(root=table_fqn),
        serviceType=DatabaseServiceType.Clickhouse,
        columns=columns,
    )


def _make_engine_with_rows(rows: list[dict[str, Any]]) -> MagicMock:
    engine = MagicMock()
    conn = MagicMock()
    row_objs = [SimpleNamespace(_asdict=lambda r=row: dict(r)) for row in rows]
    conn.execute.return_value = row_objs
    engine.connect.return_value.__enter__.return_value = conn
    return engine


def _build_mock_metadata(
    services: list[MessagingService] | None = None,
    topics: list[Topic] | None = None,
    tables: list[Table] | None = None,
) -> MagicMock:
    metadata = MagicMock()
    svc_by_fqn = {svc.fullyQualifiedName.root: svc for svc in (services or []) if svc.fullyQualifiedName}
    topic_by_fqn = {t.fullyQualifiedName.root: t for t in (topics or []) if t.fullyQualifiedName}
    table_by_fqn = {tbl.fullyQualifiedName.root: tbl for tbl in (tables or []) if tbl.fullyQualifiedName}

    metadata.list_all_entities.side_effect = lambda entity, **kwargs: (
        list(svc_by_fqn.values()) if entity is MessagingService else []
    )

    def _get_by_name(entity: Any, fqn: str, **kwargs: Any) -> Any:
        if entity is MessagingService:
            return svc_by_fqn.get(fqn)
        if entity is Topic:
            return topic_by_fqn.get(fqn)
        if entity is Table:
            return table_by_fqn.get(fqn)
        return None

    metadata.get_by_name.side_effect = _get_by_name
    return metadata


def _make_status() -> Status:
    return Status(
        records=[],
        updated_records=[],
        warnings=[],
        filtered=[],
        failures=[],
    )


def _make_lineage_source(
    rows: list[dict[str, Any]],
    metadata: MagicMock,
    source_config: DatabaseServiceQueryLineagePipeline | None = None,
    service_name: str = "ch-prod",
    database_name: str | None = None,
    database_schema: str | None = None,
) -> SimpleNamespace:
    engine = _make_engine_with_rows(rows)
    return SimpleNamespace(
        config=SimpleNamespace(serviceName=service_name),
        service_connection=SimpleNamespace(
            databaseName=database_name,
            databaseSchema=database_schema,
        ),
        source_config=source_config or DatabaseServiceQueryLineagePipeline(),
        metadata=metadata,
        engine=engine,
        get_engine=lambda: iter([engine]),
        status=_make_status(),
    )


def _unwrap_add_lineage(item: Either[Any]) -> AddLineageRequest:
    assert item.left is None
    assert item.right is not None
    if isinstance(item.right, OMetaLineageRequest):
        assert isinstance(item.right.lineage_request, AddLineageRequest)
        return item.right.lineage_request
    assert isinstance(item.right, AddLineageRequest)
    return item.right


class TestParseKafkaEngineConfig:
    """Validate token-safe parsing across all ClickHouse ENGINE = Kafka syntaxes."""

    def test_issue_37172_exact_ddl_syntax(self):
        ddl = """
        CREATE TABLE IF NOT EXISTS my_kafka_table ON CLUSTER my_cluster
        (
            `raw` String
        )
        ENGINE = Kafka
        SETTINGS
            kafka_broker_list   = 'kafka-cluster-kafka-bootstrap.kafka.svc.cluster.local:9095',
            kafka_topic_list    = 'my-kafka-topic',
            kafka_group_name    = 'my-consumer-group',
            kafka_format        = 'JSONAsString',
            kafka_num_consumers = 1
        """
        parsed = parse_kafka_engine_config(engine_full=None, create_table_query=ddl)
        assert parsed == KafkaEngineConfig(
            brokers=("kafka-cluster-kafka-bootstrap.kafka.svc.cluster.local:9095",),
            topics=("my-kafka-topic",),
            named_collection=None,
        )

    def test_empty_parens_settings_and_multi_topic_list(self):
        ddl = (
            "CREATE TABLE analytics.kafka_orders (`id` String) "
            "ENGINE = Kafka() "
            "SETTINGS kafka_num_consumers = 2, "
            "kafka_broker_list = 'b1:9092, b2:9092', "
            "kafka_topic_list = 'orders, payments, orders' "
            "COMMENT 'streaming table'"
        )
        parsed = parse_kafka_engine_config(engine_full=None, create_table_query=ddl)
        assert parsed == KafkaEngineConfig(
            brokers=("b1:9092", "b2:9092"),
            topics=("orders", "payments"),
            named_collection=None,
        )

    def test_kafka_topic_alias_setting(self):
        engine_full = "Kafka SETTINGS kafka_broker_list = 'broker:9092', kafka_topic = 'single-events'"
        parsed = parse_kafka_engine_config(engine_full=engine_full, create_table_query=None)
        assert parsed == KafkaEngineConfig(
            brokers=("broker:9092",),
            topics=("single-events",),
            named_collection=None,
        )

    def test_positional_arguments_with_escaped_quotes_and_column_comment_decoy(self):
        ddl = (
            "CREATE TABLE analytics.`kafka_events` "
            "(`payload` String DEFAULT 'ENGINE = Kafka(\\'fake:9092\\', \\'fake_topic\\')') "
            r"ENGINE = Kafka('b1:9092,b2:9092', 'topic_a, topic\'s_b, topic''s_c', 'cg,1', 'AvroConfluent')"
        )
        parsed = parse_kafka_engine_config(engine_full=None, create_table_query=ddl)
        assert parsed == KafkaEngineConfig(
            brokers=("b1:9092", "b2:9092"),
            topics=("topic_a", "topic's_b", "topic's_c"),
            named_collection=None,
        )

    @pytest.mark.parametrize(
        "engine_full,create_query,expected",
        [
            pytest.param(
                "Kafka(prod_kafka_collection, kafka_topic_list = 'events')",
                None,
                KafkaEngineConfig(
                    brokers=(),
                    topics=("events",),
                    named_collection="prod_kafka_collection",
                ),
                id="named-collection-inline-override",
            ),
            pytest.param(
                None,
                "CREATE TABLE db.t (`x` String) ENGINE = Kafka(prod_kafka_collection) SETTINGS kafka_topic_list = 'events'",
                KafkaEngineConfig(
                    brokers=(),
                    topics=("events",),
                    named_collection="prod_kafka_collection",
                ),
                id="named-collection-settings-clause",
            ),
            pytest.param(
                "Kafka(`quoted_collection`, kafka_topic = 'clicks')",
                None,
                KafkaEngineConfig(
                    brokers=(),
                    topics=("clicks",),
                    named_collection="quoted_collection",
                ),
                id="quoted-named-collection-with-topic-alias",
            ),
        ],
    )
    def test_named_collection_variants(self, engine_full, create_query, expected):
        assert parse_kafka_engine_config(engine_full, create_query) == expected

    @pytest.mark.parametrize(
        "ddl",
        [
            None,
            "",
            "CREATE TABLE db.t (`id` UInt64) ENGINE = MergeTree ORDER BY id",
            "CREATE MATERIALIZED VIEW db.mv TO db.target AS SELECT * FROM db.kafka_src",
        ],
    )
    def test_non_kafka_ddl_returns_none(self, ddl):
        assert parse_kafka_engine_config(engine_full=None, create_table_query=ddl) is None

    def test_merges_partial_engine_full_with_create_table_query_and_nested_settings(self):
        parsed = parse_kafka_engine_config(
            engine_full="Kafka(prod_collection)",
            create_table_query=(
                "CREATE TABLE db.t (`x` String) ENGINE = Kafka(prod_collection) "
                "SETTINGS kafka_consumers = (1), kafka_topic_list = 'events'"
            ),
        )
        assert parsed == KafkaEngineConfig(
            brokers=(),
            topics=("events",),
            named_collection="prod_collection",
        )


class TestBrokerEndpointNormalization:
    def test_strips_schemes_and_normalizes_host_and_port(self):
        endpoints = extract_broker_endpoints(
            [
                "",
                "SASL_SSL://Broker-1.Kafka.Local:9095, , PLAINTEXT://broker-2.kafka.local:9092/path",
                "SASL_PLAINTEXT://[::1]:9093, headless-broker.kafka.local",
            ]
        )
        assert endpoints.host_ports == frozenset(
            {
                "broker-1.kafka.local:9095",
                "broker-2.kafka.local:9092",
                "[::1]:9093",
            }
        )
        assert endpoints.hosts == frozenset(
            {
                "broker-1.kafka.local",
                "broker-2.kafka.local",
                "[::1]",
                "headless-broker.kafka.local",
            }
        )


class TestMultiClusterDisambiguation:
    """Enforce REVIEW.md: lineage never guesses across services when ambiguous."""

    def test_auto_discovers_unique_service_by_broker_intersection(self):
        kafka_dev = _make_messaging_service("kafka-dev", "PLAINTEXT://dev-broker:9092")
        kafka_prod = _make_messaging_service("kafka-prod", "SASL_SSL://prod-broker:9092")
        dev_topic = _make_topic("kafka-dev", "events")
        prod_topic = _make_topic("kafka-prod", "events")
        ch_table = _make_table("ch-prod", "analytics", "events_queue")

        rows = [
            {
                "database": "analytics",
                "name": "events_queue",
                "engine_full": "Kafka SETTINGS kafka_broker_list = 'prod-broker:9092', kafka_topic_list = 'events'",
                "create_table_query": "",
            }
        ]
        metadata = _build_mock_metadata(
            services=[kafka_dev, kafka_prod],
            topics=[dev_topic, prod_topic],
            tables=[ch_table],
        )
        source = _make_lineage_source(rows=rows, metadata=metadata)

        results = list(yield_kafka_engine_lineage(source))  # type: ignore[arg-type]
        assert len(results) == 1
        req = _unwrap_add_lineage(results[0])
        assert req.edge.fromEntity.id == prod_topic.id
        assert req.edge.fromEntity.type == "topic"
        assert req.edge.toEntity.id == ch_table.id
        assert req.edge.toEntity.type == "table"
        assert req.edge.lineageDetails is not None
        assert req.edge.lineageDetails.source == LineageEdgeSource.ExternalTableLineage

    def test_explicit_messaging_service_names_scopes_strictly(self):
        kafka_dev = _make_messaging_service("kafka-dev", "dev-broker:9092")
        kafka_prod = _make_messaging_service("kafka-prod", "prod-broker:9092")
        dev_topic = _make_topic("kafka-dev", "events")
        prod_topic = _make_topic("kafka-prod", "events")
        ch_table = _make_table("ch-dev", "analytics", "events_queue")

        rows = [
            {
                "database": "analytics",
                "name": "events_queue",
                "engine_full": "Kafka SETTINGS kafka_broker_list = 'internal-k8s-alias:9092', kafka_topic_list = 'events'",
                "create_table_query": "",
            }
        ]
        metadata = _build_mock_metadata(
            services=[kafka_dev, kafka_prod],
            topics=[dev_topic, prod_topic],
            tables=[ch_table],
        )
        cfg = DatabaseServiceQueryLineagePipeline(messagingServiceNames=["kafka-dev"])
        source = _make_lineage_source(rows=rows, metadata=metadata, source_config=cfg, service_name="ch-dev")

        results = list(yield_kafka_engine_lineage(source))  # type: ignore[arg-type]
        assert len(results) == 1
        req = _unwrap_add_lineage(results[0])
        assert req.edge.fromEntity.id == dev_topic.id
        assert req.edge.toEntity.id == ch_table.id

    @pytest.mark.parametrize(
        "config_kwargs",
        [
            pytest.param({"messagingServiceNames": ["prod-kafka"]}, id="messagingServiceNames"),
            pytest.param({"crossDatabaseServiceNames": ["prod-kafka"]}, id="crossDatabaseServiceNames-fallback"),
        ],
    )
    def test_named_collection_resolves_via_configured_service_names(self, config_kwargs):
        prod_kafka = _make_messaging_service("prod-kafka", "prod-broker:9092")
        other_kafka = _make_messaging_service("other-kafka", "other-broker:9092")
        prod_topic = _make_topic("prod-kafka", "prod.orders.v1")
        other_topic = _make_topic("other-kafka", "prod.orders.v1")
        ch_table = _make_table("ch-prod", "analytics", "orders_queue")

        rows = [
            {
                "database": "analytics",
                "name": "orders_queue",
                "engine_full": "Kafka(prod_kafka_collection, kafka_topic_list = 'prod.orders.v1')",
                "create_table_query": "",
            }
        ]
        metadata = _build_mock_metadata(
            services=[prod_kafka, other_kafka],
            topics=[prod_topic, other_topic],
            tables=[ch_table],
        )
        cfg = DatabaseServiceQueryLineagePipeline(**config_kwargs)
        source = _make_lineage_source(rows=rows, metadata=metadata, source_config=cfg)

        results = list(yield_kafka_engine_lineage(source))  # type: ignore[arg-type]
        assert len(results) == 1
        req = _unwrap_add_lineage(results[0])
        assert req.edge.fromEntity.id == prod_topic.id
        assert req.edge.toEntity.id == ch_table.id

    def test_non_messaging_cross_database_service_does_not_block_broker_autodiscovery(self):
        prod_kafka = _make_messaging_service("prod-kafka", "prod-broker:9092")
        prod_topic = _make_topic("prod-kafka", "events")
        ch_table = _make_table("ch-prod", "analytics", "events_queue")

        rows = [
            {
                "database": "analytics",
                "name": "events_queue",
                "engine_full": "Kafka('prod-broker:9092', 'events', 'cg1', 'JSONEachRow')",
                "create_table_query": "",
            }
        ]
        metadata = _build_mock_metadata(
            services=[prod_kafka],
            topics=[prod_topic],
            tables=[ch_table],
        )
        cfg = DatabaseServiceQueryLineagePipeline(
            processCrossDatabaseLineage=True,
            crossDatabaseServiceNames=["postgres-warehouse"],
        )
        source = _make_lineage_source(rows=rows, metadata=metadata, source_config=cfg)

        results = list(yield_kafka_engine_lineage(source))  # type: ignore[arg-type]
        assert len(results) == 1
        assert _unwrap_add_lineage(results[0]).edge.fromEntity.id == prod_topic.id

    def test_named_collection_without_configured_services_warns_and_emits_zero_edges(self, caplog):
        prod_kafka = _make_messaging_service("prod-kafka", "prod-broker:9092")
        prod_topic = _make_topic("prod-kafka", "events")
        ch_table = _make_table("ch-prod", "analytics", "events_queue")

        rows = [
            {
                "database": "analytics",
                "name": "events_queue",
                "engine_full": "Kafka(prod_kafka_collection) SETTINGS kafka_topic_list = 'events'",
                "create_table_query": "",
            }
        ]
        metadata = _build_mock_metadata(services=[prod_kafka], topics=[prod_topic], tables=[ch_table])
        source = _make_lineage_source(rows=rows, metadata=metadata)

        with caplog.at_level(logging.WARNING):
            results = list(yield_kafka_engine_lineage(source))  # type: ignore[arg-type]

        assert results == []
        assert any("messagingServiceNames" in rec.message for rec in caplog.records)

    def test_ambiguous_topic_across_multiple_candidate_services_warns_and_skips(self, caplog):
        kafka_a = _make_messaging_service("kafka-a", "broker-a:9092")
        kafka_b = _make_messaging_service("kafka-b", "broker-b:9092")
        topic_a = _make_topic("kafka-a", "events")
        topic_b = _make_topic("kafka-b", "events")
        ch_table = _make_table("ch-prod", "analytics", "events_queue")

        rows = [
            {
                "database": "analytics",
                "name": "events_queue",
                "engine_full": "Kafka(shared_named_collection, kafka_topic_list = 'events')",
                "create_table_query": "",
            }
        ]
        metadata = _build_mock_metadata(
            services=[kafka_a, kafka_b],
            topics=[topic_a, topic_b],
            tables=[ch_table],
        )
        cfg = DatabaseServiceQueryLineagePipeline(messagingServiceNames=["kafka-a", "kafka-b"])
        source = _make_lineage_source(rows=rows, metadata=metadata, source_config=cfg)

        with caplog.at_level(logging.WARNING):
            results = list(yield_kafka_engine_lineage(source))  # type: ignore[arg-type]

        assert results == []
        assert any("Ambiguous" in rec.message for rec in caplog.records)

    def test_port_match_breaks_tie_over_shared_hostname_and_unmatched_brokers_skip(self):
        kafka_9092 = _make_messaging_service("kafka-plain", "shared-broker.local:9092")
        kafka_9095 = _make_messaging_service("kafka-tls", "shared-broker.local:9095")
        topic_9092 = _make_topic("kafka-plain", "events")
        topic_9095 = _make_topic("kafka-tls", "events")
        table_matched = _make_table("ch-prod", "analytics", "tls_events")
        table_unmatched = _make_table("ch-prod", "analytics", "unknown_events")

        rows = [
            {
                "database": "analytics",
                "name": "tls_events",
                "engine_full": "Kafka('shared-broker.local:9095', 'events', 'cg1', 'JSONEachRow')",
                "create_table_query": "",
            },
            {
                "database": "analytics",
                "name": "unknown_events",
                "engine_full": "Kafka('completely-other-broker:9092', 'events', 'cg1', 'JSONEachRow')",
                "create_table_query": "",
            },
        ]
        metadata = _build_mock_metadata(
            services=[kafka_9092, kafka_9095],
            topics=[topic_9092, topic_9095],
            tables=[table_matched, table_unmatched],
        )
        source = _make_lineage_source(rows=rows, metadata=metadata)
        results = list(yield_kafka_engine_lineage(source))  # type: ignore[arg-type]
        assert len(results) == 1
        assert _unwrap_add_lineage(results[0]).edge.fromEntity.id == topic_9095.id

    def test_missing_configured_service_fails_closed_and_broker_narrows_explicit_list(self, caplog):
        kafka_dev = _make_messaging_service("kafka-dev", "dev-broker:9092")
        kafka_prod = _make_messaging_service("kafka-prod", "prod-broker:9092")
        dev_topic = _make_topic("kafka-dev", "events")
        prod_topic = _make_topic("kafka-prod", "events")
        ch_table = _make_table("ch-prod", "analytics", "events_queue")

        rows = [
            {
                "database": "analytics",
                "name": "events_queue",
                "engine_full": "Kafka('prod-broker:9092', 'events', 'cg1', 'JSONEachRow')",
                "create_table_query": "",
            }
        ]
        metadata = _build_mock_metadata(
            services=[kafka_dev, kafka_prod],
            topics=[dev_topic, prod_topic],
            tables=[ch_table],
        )

        # Typo in messagingServiceNames fails closed rather than scanning other clusters
        typo_cfg = DatabaseServiceQueryLineagePipeline(messagingServiceNames=["nonexistent-kafka"])
        typo_source = _make_lineage_source(rows=rows, metadata=metadata, source_config=typo_cfg)
        with caplog.at_level(logging.WARNING):
            assert list(yield_kafka_engine_lineage(typo_source)) == []  # type: ignore[arg-type]
        assert any("nonexistent-kafka" in rec.message for rec in caplog.records)

        # Multiple configured services get narrowed by broker intersection when brokers are present
        multi_cfg = DatabaseServiceQueryLineagePipeline(messagingServiceNames=["kafka-dev", "kafka-prod"])
        multi_source = _make_lineage_source(rows=rows, metadata=metadata, source_config=multi_cfg)
        results = list(yield_kafka_engine_lineage(multi_source))  # type: ignore[arg-type]
        assert len(results) == 1
        assert _unwrap_add_lineage(results[0]).edge.fromEntity.id == prod_topic.id

    def test_topic_lookup_failure_in_multi_service_scope_aborts_instead_of_guessing(self, caplog):
        kafka_a = _make_messaging_service("kafka-a", "broker-a:9092")
        kafka_b = _make_messaging_service("kafka-b", "broker-b:9092")
        topic_b = _make_topic("kafka-b", "events")
        ch_table = _make_table("ch-prod", "analytics", "events_queue")

        metadata = _build_mock_metadata(services=[kafka_a, kafka_b], topics=[topic_b], tables=[ch_table])
        original_get = metadata.get_by_name.side_effect

        def _flaky_get_by_name(entity: Any, fqn: str, **kwargs: Any) -> Any:
            if entity is Topic and fqn == "kafka-a.events":
                raise RuntimeError("transient API timeout")
            return original_get(entity=entity, fqn=fqn, **kwargs)

        metadata.get_by_name.side_effect = _flaky_get_by_name
        rows = [
            {
                "database": "analytics",
                "name": "events_queue",
                "engine_full": "Kafka(shared_collection, kafka_topic_list = 'events')",
                "create_table_query": "",
            }
        ]
        cfg = DatabaseServiceQueryLineagePipeline(messagingServiceNames=["kafka-a", "kafka-b"])
        source = _make_lineage_source(rows=rows, metadata=metadata, source_config=cfg)

        with caplog.at_level(logging.WARNING):
            results = list(yield_kafka_engine_lineage(source))  # type: ignore[arg-type]
        assert results == []
        assert any("Aborting resolution" in rec.message for rec in caplog.records)

    def test_service_lookup_api_error_in_messaging_service_names_fails_closed(self, caplog):
        kafka_a = _make_messaging_service("kafka-a", "broker-a:9092")
        kafka_b = _make_messaging_service("kafka-b", "broker-b:9092")
        topic_b = _make_topic("kafka-b", "events")
        ch_table = _make_table("ch-prod", "analytics", "events_queue")

        metadata = _build_mock_metadata(services=[kafka_a, kafka_b], topics=[topic_b], tables=[ch_table])
        original_get = metadata.get_by_name.side_effect

        def _failing_service_get(entity: Any, fqn: str, **kwargs: Any) -> Any:
            if entity is MessagingService and fqn == "kafka-a":
                raise RuntimeError("503 Service Unavailable")
            return original_get(entity=entity, fqn=fqn, **kwargs)

        metadata.get_by_name.side_effect = _failing_service_get
        rows = [
            {
                "database": "analytics",
                "name": "events_queue",
                "engine_full": "Kafka(shared_collection, kafka_topic_list = 'events')",
                "create_table_query": "",
            }
        ]
        cfg = DatabaseServiceQueryLineagePipeline(messagingServiceNames=["kafka-a", "kafka-b"])
        source = _make_lineage_source(rows=rows, metadata=metadata, source_config=cfg)
        extractor = ClickhouseKafkaLineageExtractor(source)  # type: ignore[arg-type]

        with caplog.at_level(logging.WARNING):
            results = list(extractor.iter_lineage())

        assert results == []
        assert metadata.list_all_entities.call_count == 0
        assert not any("not found" in rec.message for rec in caplog.records)
        # Cached entry preserves had_error=True rather than collapsing to (None, False)
        assert extractor._get_messaging_service("kafka-a") == (None, True)

    def test_service_lookup_api_error_in_cross_database_service_names_fails_closed(self):
        kafka_other = _make_messaging_service("kafka-other", "prod-broker:9092")
        other_topic = _make_topic("kafka-other", "events")
        ch_table = _make_table("ch-prod", "analytics", "events_queue")

        metadata = _build_mock_metadata(services=[kafka_other], topics=[other_topic], tables=[ch_table])
        original_get = metadata.get_by_name.side_effect

        def _failing_cross_db_get(entity: Any, fqn: str, **kwargs: Any) -> Any:
            if entity is MessagingService and fqn == "kafka-prod":
                raise RuntimeError("502 Bad Gateway")
            return original_get(entity=entity, fqn=fqn, **kwargs)

        metadata.get_by_name.side_effect = _failing_cross_db_get
        rows = [
            {
                "database": "analytics",
                "name": "events_queue",
                "engine_full": "Kafka('prod-broker:9092', 'events', 'cg1', 'JSONEachRow')",
                "create_table_query": "",
            }
        ]
        cfg = DatabaseServiceQueryLineagePipeline(crossDatabaseServiceNames=["kafka-prod"])
        source = _make_lineage_source(rows=rows, metadata=metadata, source_config=cfg)

        results = list(yield_kafka_engine_lineage(source))  # type: ignore[arg-type]
        assert results == []
        assert metadata.list_all_entities.call_count == 0

    def test_blank_messaging_service_names_fall_through_to_broker_autodiscovery(self):
        kafka_prod = _make_messaging_service("kafka-prod", "prod-broker:9092")
        prod_topic = _make_topic("kafka-prod", "events")
        ch_table = _make_table("ch-prod", "analytics", "events_queue")

        rows = [
            {
                "database": "analytics",
                "name": "events_queue",
                "engine_full": "Kafka('prod-broker:9092', 'events', 'cg1', 'JSONEachRow')",
                "create_table_query": "",
            }
        ]
        metadata = _build_mock_metadata(services=[kafka_prod], topics=[prod_topic], tables=[ch_table])
        cfg = DatabaseServiceQueryLineagePipeline(
            messagingServiceNames=["", "   "],
            crossDatabaseServiceNames=["\t", "  "],
        )
        source = _make_lineage_source(rows=rows, metadata=metadata, source_config=cfg)

        results = list(yield_kafka_engine_lineage(source))  # type: ignore[arg-type]
        assert len(results) == 1
        assert _unwrap_add_lineage(results[0]).edge.fromEntity.id == prod_topic.id


class TestSecretAndSecurityProtection:
    """Verify kafka_sasl_password or raw DDL never leaks into LineageDetails or logs."""

    def test_sasl_password_never_appears_in_lineage_details_or_logs(self, caplog):
        secret_value = "super-secret-password-99182"
        kafka_prod = _make_messaging_service("kafka-prod", "prod-broker:9092")
        prod_topic = _make_topic("kafka-prod", "secure-events")
        ch_table = _make_table("ch-prod", "analytics", "secure_queue")

        ddl_with_secret = (
            "CREATE TABLE analytics.secure_queue (`payload` String) "
            "ENGINE = Kafka SETTINGS "
            "kafka_broker_list = 'prod-broker:9092', "
            "kafka_topic_list = 'secure-events', "
            "kafka_security_protocol = 'SASL_SSL', "
            "kafka_sasl_mechanism = 'SCRAM-SHA-512', "
            "kafka_sasl_username = 'clickhouse_reader', "
            f"kafka_sasl_password = '{secret_value}'"
        )
        named_collection_ddl_with_secret = (
            "CREATE TABLE analytics.unmatched_queue (`payload` String) "
            "ENGINE = Kafka(hidden_brokers) SETTINGS "
            "kafka_topic_list = 'secure-events', "
            f"kafka_sasl_password = '{secret_value}'"
        )
        rows = [
            {
                "database": "analytics",
                "name": "secure_queue",
                "engine_full": ddl_with_secret,
                "create_table_query": ddl_with_secret,
            },
            {
                "database": "analytics",
                "name": "unmatched_queue",
                "engine_full": named_collection_ddl_with_secret,
                "create_table_query": named_collection_ddl_with_secret,
            },
        ]
        metadata = _build_mock_metadata(
            services=[kafka_prod],
            topics=[prod_topic],
            tables=[ch_table, _make_table("ch-prod", "analytics", "unmatched_queue")],
        )
        source = _make_lineage_source(rows=rows, metadata=metadata)

        with caplog.at_level(logging.DEBUG):
            results = list(yield_kafka_engine_lineage(source))  # type: ignore[arg-type]

        assert len(results) == 1
        req = _unwrap_add_lineage(results[0])
        assert req.edge.lineageDetails is not None
        assert req.edge.lineageDetails.sqlQuery is None
        assert secret_value not in req.model_dump_json()
        for record in caplog.records:
            assert secret_value not in record.getMessage()


class TestColumnLevelLineage:
    """Validate Topic.messageSchema -> Table.columns mapping and virtual column exclusion."""

    def test_maps_schema_fields_and_excludes_clickhouse_virtual_columns(self):
        kafka_prod = _make_messaging_service("kafka-prod", "prod-broker:9092")
        topic = _make_topic(
            "kafka-prod",
            "orders",
            fields=[
                FieldModel(name=FieldName(root="order_id"), dataType=DataTypeTopic.STRING),
                FieldModel(name=FieldName(root="OrderAmount"), dataType=DataTypeTopic.DOUBLE),
                FieldModel(name=FieldName(root="UserId"), dataType=DataTypeTopic.STRING),
                FieldModel(name=FieldName(root="userid"), dataType=DataTypeTopic.STRING),
                FieldModel(name=FieldName(root="DupCase"), dataType=DataTypeTopic.STRING),
                FieldModel(name=FieldName(root="DUPCASE"), dataType=DataTypeTopic.STRING),
                FieldModel(name=FieldName(root="_key"), dataType=DataTypeTopic.STRING),
                FieldModel(name=FieldName(root="_timestamp"), dataType=DataTypeTopic.TIMESTAMP),
            ],
        )
        table = _make_table(
            "ch-prod",
            "analytics",
            "orders_kafka",
            column_names=[
                "order_id",
                "orderamount",
                "userid",
                "dupcase",
                "unmatched_col",
                *sorted(CLICKHOUSE_KAFKA_VIRTUAL_COLUMNS),
            ],
        )

        rows = [
            {
                "database": "analytics",
                "name": "orders_kafka",
                "engine_full": "Kafka('prod-broker:9092', 'orders', 'cg1', 'AvroConfluent')",
                "create_table_query": "",
            }
        ]
        metadata = _build_mock_metadata(services=[kafka_prod], topics=[topic], tables=[table])
        source = _make_lineage_source(rows=rows, metadata=metadata)

        results = list(yield_kafka_engine_lineage(source))  # type: ignore[arg-type]
        assert len(results) == 1
        req = _unwrap_add_lineage(results[0])
        assert req.edge.lineageDetails is not None
        col_lineage = req.edge.lineageDetails.columnsLineage
        assert col_lineage is not None

        pairs = {
            col.toColumn.root: [src.root for src in (col.fromColumns or [])] for col in col_lineage if col.toColumn
        }
        assert pairs == {
            "ch-prod.default.analytics.orders_kafka.order_id": ["kafka-prod.orders.order_id"],
            "ch-prod.default.analytics.orders_kafka.orderamount": ["kafka-prod.orders.OrderAmount"],
            "ch-prod.default.analytics.orders_kafka.userid": ["kafka-prod.orders.userid"],
        }

    def test_unwraps_single_top_level_record_wrapper_schema_field(self):
        kafka_prod = _make_messaging_service("kafka-prod", "prod-broker:9092")
        envelope = FieldModel(
            name=FieldName(root="OrderEnvelope"),
            dataType=DataTypeTopic.RECORD,
            fullyQualifiedName=FullyQualifiedEntityName(root="kafka-prod.orders.OrderEnvelope"),
            children=[
                FieldModel(
                    name=FieldName(root="order_id"),
                    dataType=DataTypeTopic.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(root="kafka-prod.orders.OrderEnvelope.order_id"),
                ),
            ],
        )
        topic = _make_topic("kafka-prod", "orders", fields=[envelope])
        table = _make_table("ch-prod", "analytics", "orders_kafka", column_names=["order_id"])
        rows = [
            {
                "database": "analytics",
                "name": "orders_kafka",
                "engine_full": "Kafka('prod-broker:9092', 'orders', 'cg1', 'AvroConfluent')",
                "create_table_query": "",
            }
        ]
        metadata = _build_mock_metadata(services=[kafka_prod], topics=[topic], tables=[table])
        source = _make_lineage_source(rows=rows, metadata=metadata)
        results = list(yield_kafka_engine_lineage(source))  # type: ignore[arg-type]
        assert len(results) == 1
        col_lineage = _unwrap_add_lineage(results[0]).edge.lineageDetails.columnsLineage  # type: ignore[union-attr]
        assert col_lineage is not None
        assert len(col_lineage) == 1
        assert [c.root for c in (col_lineage[0].fromColumns or [])] == ["kafka-prod.orders.OrderEnvelope.order_id"]

    def test_single_top_level_array_field_with_children_is_not_unwrapped(self):
        kafka_prod = _make_messaging_service("kafka-prod", "prod-broker:9092")
        items_array = FieldModel(
            name=FieldName(root="items"),
            dataType=DataTypeTopic.ARRAY,
            fullyQualifiedName=FullyQualifiedEntityName(root="kafka-prod.orders.items"),
            children=[
                FieldModel(
                    name=FieldName(root="item_id"),
                    dataType=DataTypeTopic.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(root="kafka-prod.orders.items.item_id"),
                ),
            ],
        )
        topic = _make_topic("kafka-prod", "orders", fields=[items_array])
        table = _make_table("ch-prod", "analytics", "orders_kafka", column_names=["items", "item_id"])
        rows = [
            {
                "database": "analytics",
                "name": "orders_kafka",
                "engine_full": "Kafka('prod-broker:9092', 'orders', 'cg1', 'JSONEachRow')",
                "create_table_query": "",
            }
        ]
        metadata = _build_mock_metadata(services=[kafka_prod], topics=[topic], tables=[table])
        source = _make_lineage_source(rows=rows, metadata=metadata)

        results = list(yield_kafka_engine_lineage(source))  # type: ignore[arg-type]
        assert len(results) == 1
        col_lineage = _unwrap_add_lineage(results[0]).edge.lineageDetails.columnsLineage  # type: ignore[union-attr]
        assert col_lineage is not None
        pairs = {
            col.toColumn.root: [src.root for src in (col.fromColumns or [])] for col in col_lineage if col.toColumn
        }
        assert pairs == {
            "ch-prod.default.analytics.orders_kafka.items": ["kafka-prod.orders.items"],
        }

    def test_single_top_level_record_retains_wrapper_fallback_when_no_child_matches(self):
        kafka_prod = _make_messaging_service("kafka-prod", "prod-broker:9092")
        payload_record = FieldModel(
            name=FieldName(root="payload"),
            dataType=DataTypeTopic.RECORD,
            fullyQualifiedName=FullyQualifiedEntityName(root="kafka-prod.orders.payload"),
            children=[
                FieldModel(
                    name=FieldName(root="order_id"),
                    dataType=DataTypeTopic.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(root="kafka-prod.orders.payload.order_id"),
                ),
            ],
        )
        topic = _make_topic("kafka-prod", "orders", fields=[payload_record])
        raw_table = _make_table("ch-prod", "analytics", "orders_raw", column_names=["payload"])
        flat_table = _make_table("ch-prod", "analytics", "orders_flat", column_names=["order_id"])
        rows = [
            {
                "database": "analytics",
                "name": "orders_raw",
                "engine_full": "Kafka('prod-broker:9092', 'orders', 'cg1', 'JSONEachRow')",
                "create_table_query": "",
            },
            {
                "database": "analytics",
                "name": "orders_flat",
                "engine_full": "Kafka('prod-broker:9092', 'orders', 'cg2', 'JSONEachRow')",
                "create_table_query": "",
            },
        ]
        metadata = _build_mock_metadata(services=[kafka_prod], topics=[topic], tables=[raw_table, flat_table])
        source = _make_lineage_source(rows=rows, metadata=metadata)

        results = list(yield_kafka_engine_lineage(source))  # type: ignore[arg-type]
        assert len(results) == 2

        raw_cols = _unwrap_add_lineage(results[0]).edge.lineageDetails.columnsLineage  # type: ignore[union-attr]
        flat_cols = _unwrap_add_lineage(results[1]).edge.lineageDetails.columnsLineage  # type: ignore[union-attr]
        assert raw_cols is not None and len(raw_cols) == 1
        assert flat_cols is not None and len(flat_cols) == 1
        assert [c.root for c in (raw_cols[0].fromColumns or [])] == ["kafka-prod.orders.payload"]
        assert [c.root for c in (flat_cols[0].fromColumns or [])] == ["kafka-prod.orders.payload.order_id"]


class TestFiltersOverrideAndResilience:
    """Verify filters, overrideViewLineage, error isolation, and bounded LRU caches."""

    def test_schema_and_table_filters_and_custom_database_name(self):
        kafka_prod = _make_messaging_service("kafka-prod", "prod-broker:9092")
        topic_orders = _make_topic("kafka-prod", "orders")
        topic_payments = _make_topic("kafka-prod", "payments")
        allowed_table = _make_table(
            "ch-prod",
            "analytics",
            "orders_kafka",
            database_name="custom_catalog",
        )

        rows = [
            {
                "database": "ignored_schema",
                "name": "orders_kafka",
                "engine_full": "Kafka('prod-broker:9092', 'orders', 'cg1', 'JSONEachRow')",
                "create_table_query": "",
            },
            {
                "database": "analytics",
                "name": "tmp_staging_kafka",
                "engine_full": "Kafka('prod-broker:9092', 'orders', 'cg1', 'JSONEachRow')",
                "create_table_query": "",
            },
            {
                "database": "analytics",
                "name": "orders_kafka",
                "engine_full": "Kafka('prod-broker:9092', 'orders, payments', 'cg1', 'JSONEachRow')",
                "create_table_query": "",
            },
        ]
        metadata = _build_mock_metadata(
            services=[kafka_prod],
            topics=[topic_orders, topic_payments],
            tables=[allowed_table],
        )
        cfg = DatabaseServiceQueryLineagePipeline(
            schemaFilterPattern=FilterPattern(includes=["^analytics$"]),
            tableFilterPattern=FilterPattern(excludes=["^tmp_.*"]),
            overrideViewLineage=True,
        )
        source = _make_lineage_source(
            rows=rows,
            metadata=metadata,
            source_config=cfg,
            database_name="custom_catalog",
        )

        results = list(yield_kafka_engine_lineage(source))  # type: ignore[arg-type]
        assert len(results) == 2
        assert len(source.status.filtered) == 2

        first_wrap = results[0].right
        second_wrap = results[1].right
        assert isinstance(first_wrap, OMetaLineageRequest)
        assert isinstance(second_wrap, OMetaLineageRequest)
        assert first_wrap.override_lineage is True
        assert second_wrap.override_lineage is False

        first_edge = _unwrap_add_lineage(results[0]).edge
        second_edge = _unwrap_add_lineage(results[1]).edge
        assert {first_edge.fromEntity.id.root, second_edge.fromEntity.id.root} == {
            topic_orders.id.root,
            topic_payments.id.root,
        }
        assert first_edge.toEntity.id == allowed_table.id
        assert second_edge.toEntity.id == allowed_table.id

    def test_database_filter_schema_scope_missing_table_and_per_row_error_isolation(self):
        kafka_prod = _make_messaging_service("kafka-prod", "prod-broker:9092")
        topic_orders = _make_topic("kafka-prod", "orders")
        ingested_table = _make_table("ch-prod", "analytics", "valid_kafka")

        # 1. source.engine is None -> early no-op
        no_engine_source = _make_lineage_source(rows=[], metadata=_build_mock_metadata())
        no_engine_source.engine = None
        assert list(yield_kafka_engine_lineage(no_engine_source)) == []  # type: ignore[arg-type]

        # 2. databaseFilterPattern excluding database -> skips query completely
        db_excluded_cfg = DatabaseServiceQueryLineagePipeline(
            databaseFilterPattern=FilterPattern(excludes=["^default$"])
        )
        db_excluded_source = _make_lineage_source(
            rows=[], metadata=_build_mock_metadata(), source_config=db_excluded_cfg
        )
        assert list(yield_kafka_engine_lineage(db_excluded_source)) == []  # type: ignore[arg-type]

        # 3. Malformed row, wrong databaseSchema, topic-less row, un-ingested table, then valid row
        broken_row = MagicMock()
        broken_row._asdict.side_effect = ValueError("corrupted row")
        rows_mixed: list[Any] = [
            broken_row,
            {"database": "", "name": "", "engine_full": "", "create_table_query": ""},
            {
                "database": "other_schema",
                "name": "other_t",
                "engine_full": "Kafka('prod-broker:9092', 'orders', 'cg1', 'JSONEachRow')",
                "create_table_query": "",
            },
            {
                "database": "analytics",
                "name": "no_topic_t",
                "engine_full": "Kafka SETTINGS kafka_broker_list = 'prod-broker:9092'",
                "create_table_query": "",
            },
            {
                "database": "analytics",
                "name": "not_in_om_t",
                "engine_full": "Kafka('prod-broker:9092', 'orders', 'cg1', 'JSONEachRow')",
                "create_table_query": "",
            },
            {
                "database": "analytics",
                "name": "valid_kafka",
                "engine_full": "Kafka('prod-broker:9092', 'orders', 'cg1', 'JSONEachRow')",
                "create_table_query": "",
            },
        ]
        metadata = _build_mock_metadata(services=[kafka_prod], topics=[topic_orders], tables=[ingested_table])
        source = _make_lineage_source(
            rows=[],
            metadata=metadata,
            database_schema="analytics",
        )
        conn = source.engine.connect.return_value.__enter__.return_value
        conn.execute.return_value = [
            r if isinstance(r, MagicMock) else SimpleNamespace(_asdict=lambda d=r: dict(d)) for r in rows_mixed
        ]

        results = list(yield_kafka_engine_lineage(source))  # type: ignore[arg-type]
        assert len(results) == 1
        assert _unwrap_add_lineage(results[0]).edge.toEntity.id == ingested_table.id

    def test_bounded_lru_caches_store_hits_and_misses(self):
        kafka_prod = _make_messaging_service("kafka-prod", "prod-broker:9092")
        existing_topic = _make_topic("kafka-prod", "orders")
        t1 = _make_table("ch-prod", "analytics", "q1")
        t2 = _make_table("ch-prod", "analytics", "q2")

        rows = [
            {
                "database": "analytics",
                "name": "q1",
                "engine_full": "Kafka('prod-broker:9092', 'orders, missing_topic', 'cg1', 'JSONEachRow')",
                "create_table_query": "",
            },
            {
                "database": "analytics",
                "name": "q2",
                "engine_full": "Kafka('prod-broker:9092', 'orders, missing_topic', 'cg2', 'JSONEachRow')",
                "create_table_query": "",
            },
        ]
        metadata = _build_mock_metadata(services=[kafka_prod], topics=[existing_topic], tables=[t1, t2])
        source = _make_lineage_source(rows=rows, metadata=metadata)
        extractor = ClickhouseKafkaLineageExtractor(source)  # type: ignore[arg-type]

        assert isinstance(extractor._service_cache, LRUCache)
        assert isinstance(extractor._topic_cache, LRUCache)
        assert isinstance(extractor._table_cache, LRUCache)

        results = list(extractor.iter_lineage())
        assert len(results) == 2

        topic_calls = [call for call in metadata.get_by_name.call_args_list if call.kwargs.get("entity") is Topic]
        assert len(topic_calls) == 2

    def test_clickhouse_lineage_source_iter_isolates_system_tables_failure(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        sentinel_edge = Either(left=None, right=MagicMock(spec=AddLineageRequest))
        monkeypatch.setattr(
            "metadata.ingestion.source.database.lineage_source.LineageSource._iter",
            lambda self, *a, **kw: iter([sentinel_edge]),
        )

        failing_engine = MagicMock()
        failing_engine.connect.side_effect = OperationalError(
            CLICKHOUSE_KAFKA_ENGINE_TABLES, {}, Exception("connection reset")
        )

        source = ClickhouseLineageSource.__new__(ClickhouseLineageSource)
        source.config = SimpleNamespace(serviceName="ch-prod")  # type: ignore[assignment]
        source.service_connection = SimpleNamespace(  # type: ignore[assignment]
            databaseName=None, databaseSchema=None
        )
        source.source_config = DatabaseServiceQueryLineagePipeline()  # type: ignore[assignment]
        source.metadata = _build_mock_metadata()
        source.engine = failing_engine
        source.status = _make_status()

        emitted = list(source._iter())
        assert emitted == [sentinel_edge]

    @pytest.mark.parametrize(
        ("failing_topic_fqn", "expected_surviving"),
        [
            pytest.param("kafka-prod.payments", "orders", id="second-topic-fails"),
            pytest.param("kafka-prod.orders", "payments", id="first-topic-fails"),
        ],
    )
    def test_partial_topic_lookup_failure_disables_override_lineage_on_multi_topic_table(
        self,
        failing_topic_fqn: str,
        expected_surviving: str,
    ) -> None:
        kafka_prod = _make_messaging_service("kafka-prod", "prod-broker:9092")
        topic_orders = _make_topic("kafka-prod", "orders")
        topic_payments = _make_topic("kafka-prod", "payments")
        table = _make_table("ch-prod", "analytics", "events_kafka")

        metadata = _build_mock_metadata(
            services=[kafka_prod],
            topics=[topic_orders, topic_payments],
            tables=[table],
        )
        original_get = metadata.get_by_name.side_effect

        def _flaky_topic_get(entity: Any, fqn: str, **kwargs: Any) -> Any:
            if entity is Topic and fqn == failing_topic_fqn:
                raise RuntimeError("500 Internal Server Error")
            return original_get(entity=entity, fqn=fqn, **kwargs)

        metadata.get_by_name.side_effect = _flaky_topic_get
        rows = [
            {
                "database": "analytics",
                "name": "events_kafka",
                "engine_full": "Kafka('prod-broker:9092', 'orders, payments', 'cg1', 'JSONEachRow')",
                "create_table_query": "",
            }
        ]
        cfg = DatabaseServiceQueryLineagePipeline(overrideViewLineage=True)
        source = _make_lineage_source(rows=rows, metadata=metadata, source_config=cfg)

        results = list(yield_kafka_engine_lineage(source))  # type: ignore[arg-type]
        assert len(results) == 1
        assert isinstance(results[0].right, OMetaLineageRequest)
        assert results[0].right.override_lineage is False

        expected_topic = topic_orders if expected_surviving == "orders" else topic_payments
        assert _unwrap_add_lineage(results[0]).edge.fromEntity.id == expected_topic.id

    def test_list_all_messaging_services_failure_is_cached_once_per_run(self):
        t1 = _make_table("ch-prod", "analytics", "q1")
        t2 = _make_table("ch-prod", "analytics", "q2")
        t3 = _make_table("ch-prod", "analytics", "q3")
        rows = [
            {
                "database": "analytics",
                "name": name,
                "engine_full": "Kafka('prod-broker:9092', 'orders', 'cg1', 'JSONEachRow')",
                "create_table_query": "",
            }
            for name in ("q1", "q2", "q3")
        ]
        metadata = _build_mock_metadata(tables=[t1, t2, t3])
        metadata.list_all_entities.side_effect = RuntimeError("502 Bad Gateway")
        source = _make_lineage_source(rows=rows, metadata=metadata)

        assert list(yield_kafka_engine_lineage(source)) == []  # type: ignore[arg-type]
        assert metadata.list_all_entities.call_count == 1

    def test_invalid_topic_token_skips_bad_entry_without_aborting_siblings_or_override(self):
        kafka_prod = _make_messaging_service("kafka-prod", "prod-broker:9092")
        topic_orders = _make_topic("kafka-prod", "orders")
        topic_macro = _make_topic("kafka-prod", "bad_macro")
        table = _make_table("ch-prod", "analytics", "orders_kafka")

        rows = [
            {
                "database": "analytics",
                "name": "orders_kafka",
                "engine_full": "Kafka('prod-broker:9092', 'orders, \"bad_macro\", bad\"unbalanced', 'cg1', 'JSONEachRow')",
                "create_table_query": "",
            }
        ]
        metadata = _build_mock_metadata(
            services=[kafka_prod],
            topics=[topic_orders, topic_macro],
            tables=[table],
        )
        cfg = DatabaseServiceQueryLineagePipeline(overrideViewLineage=True)
        source = _make_lineage_source(rows=rows, metadata=metadata, source_config=cfg)

        results = list(yield_kafka_engine_lineage(source))  # type: ignore[arg-type]
        assert len(results) == 1
        assert isinstance(results[0].right, OMetaLineageRequest)
        assert results[0].right.override_lineage is True
        assert _unwrap_add_lineage(results[0]).edge.fromEntity.id == topic_orders.id

    def test_clickhouse_lineage_source_iter_emits_super_and_kafka_edges_and_executes_query(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        assert "FROM system.tables" in CLICKHOUSE_KAFKA_ENGINE_TABLES
        assert "engine = 'Kafka'" in CLICKHOUSE_KAFKA_ENGINE_TABLES
        assert "NOT LIKE '.inner%'" in CLICKHOUSE_KAFKA_ENGINE_TABLES

        sentinel_edge = Either(left=None, right=MagicMock(spec=AddLineageRequest))
        monkeypatch.setattr(
            "metadata.ingestion.source.database.lineage_source.LineageSource._iter",
            lambda self, *a, **kw: iter([sentinel_edge]),
        )

        kafka_prod = _make_messaging_service("kafka-prod", "prod-broker:9092")
        prod_topic = _make_topic("kafka-prod", "orders")
        ch_table = _make_table("ch-prod", "analytics", "orders_kafka")
        rows = [
            {
                "database": "analytics",
                "name": "orders_kafka",
                "engine_full": "Kafka('prod-broker:9092', 'orders', 'cg1', 'JSONEachRow')",
                "create_table_query": "",
            }
        ]
        engine = _make_engine_with_rows(rows)

        source = ClickhouseLineageSource.__new__(ClickhouseLineageSource)
        source.config = SimpleNamespace(serviceName="ch-prod")  # type: ignore[assignment]
        source.service_connection = SimpleNamespace(  # type: ignore[assignment]
            databaseName=None, databaseSchema=None
        )
        source.source_config = DatabaseServiceQueryLineagePipeline()  # type: ignore[assignment]
        source.metadata = _build_mock_metadata(
            services=[kafka_prod],
            topics=[prod_topic],
            tables=[ch_table],
        )
        source.engine = engine
        source.status = _make_status()

        emitted = list(source._iter())
        assert len(emitted) == 2
        assert emitted[0] is sentinel_edge
        assert isinstance(emitted[1].right, OMetaLineageRequest)
        emitted_edge = _unwrap_add_lineage(emitted[1]).edge
        assert emitted_edge.fromEntity.id == prod_topic.id
        assert emitted_edge.toEntity.id == ch_table.id
        assert emitted_edge.lineageDetails is not None
        assert emitted_edge.lineageDetails.source == LineageEdgeSource.ExternalTableLineage

        conn = engine.connect.return_value.__enter__.return_value
        assert conn.execute.call_count == 1
        assert str(conn.execute.call_args.args[0]) == CLICKHOUSE_KAFKA_ENGINE_TABLES
