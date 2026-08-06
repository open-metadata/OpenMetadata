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
"""Tests for the Confluent Cloud Snowflake Sink dataset resolver."""

import json
import logging
import uuid
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.kafkaConnectConnection import (
    KafkaConnectConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.type.schema import FieldModel, SchemaType
from metadata.generated.schema.type.schema import Topic as TopicSchema
from metadata.ingestion.source.pipeline.kafkaconnect.client import KafkaConnectClient
from metadata.ingestion.source.pipeline.kafkaconnect.constants import (
    CONNECTOR_CLASS_TO_SERVICE_TYPE,
    SERVICE_TYPE_HOSTNAME_KEYS,
)
from metadata.ingestion.source.pipeline.kafkaconnect.metadata import KafkaconnectSource
from metadata.ingestion.source.pipeline.kafkaconnect.models import (
    KafkaConnectDatasetDetails,
    KafkaConnectPipelineDetails,
    KafkaConnectTopics,
)
from metadata.ingestion.source.pipeline.kafkaconnect.sinks import (
    DefaultResolver,
    get_resolver,
)
from metadata.ingestion.source.pipeline.kafkaconnect.sinks.snowflake import (
    java_string_hashcode,
    snowflake_table_name,
)
from metadata.parsers.avro_parser import parse_avro_schema


class TestJavaStringHashcode:
    def test_known_vector_from_live_snowflake(self):
        """Verified 2026-08-05: topic om-lineage-test produced table
        OM_LINEAGE_TEST_702890019 on a live managed Snowflake Sink."""
        assert java_string_hashcode("om-lineage-test") == 702890019

    def test_empty_string_is_zero(self):
        assert java_string_hashcode("") == 0

    def test_wraps_to_signed_32_bit(self):
        # Java hashCode overflows into negatives; Python ints do not.
        assert java_string_hashcode("order_events_flat") == -270008466
        assert java_string_hashcode("order_events_nested") == -1556990036


class TestSnowflakeTableName:
    @pytest.mark.parametrize(
        "topic,expected",
        [
            ("order_events_flat", "ORDER_EVENTS_FLAT"),
            ("order_events_nested", "ORDER_EVENTS_NESTED"),
            ("ALREADY_UPPER", "ALREADY_UPPER"),
            ("_leading_underscore", "_LEADING_UNDERSCORE"),
        ],
    )
    def test_valid_identifier_uppercases_with_no_suffix(self, topic, expected):
        assert snowflake_table_name(topic) == expected

    def test_invalid_identifier_sanitises_and_appends_hash(self):
        assert snowflake_table_name("om-lineage-test") == "OM_LINEAGE_TEST_702890019"

    def test_leading_digit_is_prefixed_before_hashing(self):
        result = snowflake_table_name("9lives")
        assert result.startswith("_9LIVES_")
        # hash is computed over the ORIGINAL topic, not the sanitised name
        assert result.endswith(str(abs(java_string_hashcode("9lives"))))

    def test_dotted_topic_is_sanitised(self):
        result = snowflake_table_name("prod.orders.v1")
        assert result.startswith("PROD_ORDERS_V1_")


class TestDatasetDetailsNewFields:
    def test_defaults_preserve_existing_behaviour(self):
        dataset = KafkaConnectDatasetDetails(table="ORDERS")
        assert dataset.source_topic is None
        assert dataset.fully_qualified is False

    def test_carries_originating_topic(self):
        dataset = KafkaConnectDatasetDetails(
            table="ORDERS",
            database="EVENT_LANDING",
            schema="PUBLIC",
            source_topic="orders_events",
            fully_qualified=True,
        )
        assert dataset.source_topic == "orders_events"
        assert dataset.fully_qualified is True


class TestResolverRegistry:
    def test_unknown_connector_class_falls_back_to_default(self):
        assert isinstance(get_resolver("SomeRandomSink"), DefaultResolver)

    def test_empty_connector_class_falls_back_to_default(self):
        assert isinstance(get_resolver(""), DefaultResolver)

    def test_fqcn_is_reduced_to_simple_name(self):
        resolver = get_resolver("io.confluent.connect.s3.S3SinkConnector")
        assert isinstance(resolver, DefaultResolver)


class TestDefaultResolverUnchanged:
    def test_jdbc_sink_table_name_format_still_parsed(self):
        config = {
            "connector.class": "JdbcSinkConnector",
            "topics": "orders",
            "table.name.format": "orders",
        }
        datasets = DefaultResolver().resolve_datasets(config, [])
        assert [d.table for d in datasets] == ["orders"]

    def test_schema_qualified_table_is_split(self):
        config = {"connector.class": "JdbcSinkConnector", "table.name.format": "public.orders"}
        datasets = DefaultResolver().resolve_datasets(config, [])
        assert datasets[0].schema == "public"
        assert datasets[0].table == "orders"

    def test_no_recognised_keys_yields_nothing(self):
        datasets = DefaultResolver().resolve_datasets({"connector.class": "SnowflakeSink"}, [])
        assert datasets == []

    def test_sink_matches_topic_by_exact_name(self):
        config = {"connector.class": "JdbcSinkConnector", "table.name.format": "orders"}
        dataset = DefaultResolver().resolve_datasets(config, [])[0]
        topic_map = {"orders": "<topic-entity>"}
        assert DefaultResolver().match_topic(dataset, topic_map, config) == "<topic-entity>"

    def test_column_mappings_default_to_empty(self):
        assert DefaultResolver().column_mappings({}, None) == []


BASE_SNOWFLAKE_CONFIG = {
    "connector.class": "SnowflakeSink",
    "name": "snowflake-landing",
    "topics": "order_events_flat,om-lineage-test",
    "input.data.format": "AVRO",
    "snowflake.url.name": "abc12345.snowflakecomputing.com",
    "snowflake.database.name": "EVENT_LANDING",
    "snowflake.schema.name": "PUBLIC",
    "tasks.max": "1",
}


class TestSnowflakeSinkResolver:
    def test_registered_under_managed_plugin_name(self):
        from metadata.ingestion.source.pipeline.kafkaconnect.sinks.snowflake import (
            SnowflakeSinkResolver,
        )

        assert isinstance(get_resolver("SnowflakeSink"), SnowflakeSinkResolver)

    def test_registered_under_self_managed_fqcn(self):
        from metadata.ingestion.source.pipeline.kafkaconnect.sinks.snowflake import (
            SnowflakeSinkResolver,
        )

        resolver = get_resolver("com.snowflake.kafka.connector.SnowflakeSinkConnector")
        assert isinstance(resolver, SnowflakeSinkResolver)

    def test_no_topic2table_map_derives_tables_from_topics(self):
        """The HDI case: 1:1 topic->table with no explicit mapping."""
        datasets = get_resolver("SnowflakeSink").resolve_datasets(BASE_SNOWFLAKE_CONFIG, [])
        assert [d.table for d in datasets] == ["ORDER_EVENTS_FLAT", "OM_LINEAGE_TEST_702890019"]
        assert [d.source_topic for d in datasets] == ["order_events_flat", "om-lineage-test"]

    def test_database_and_schema_are_populated_and_qualified(self):
        dataset = get_resolver("SnowflakeSink").resolve_datasets(BASE_SNOWFLAKE_CONFIG, [])[0]
        assert dataset.database == "EVENT_LANDING"
        assert dataset.schema == "PUBLIC"
        assert dataset.fully_qualified is True

    def test_topic2table_map_overrides_derivation(self):
        config = dict(BASE_SNOWFLAKE_CONFIG, **{"snowflake.topic2table.map": "order_events_flat:ORDERS"})
        datasets = get_resolver("SnowflakeSink").resolve_datasets(config, [])
        by_topic = {d.source_topic: d.table for d in datasets}
        assert by_topic["order_events_flat"] == "ORDERS"
        # unmapped topic still derives
        assert by_topic["om-lineage-test"] == "OM_LINEAGE_TEST_702890019"

    def test_topic2table_map_tolerates_whitespace(self):
        config = dict(BASE_SNOWFLAKE_CONFIG, **{"snowflake.topic2table.map": " order_events_flat : ORDERS "})
        datasets = get_resolver("SnowflakeSink").resolve_datasets(config, [])
        assert {d.source_topic: d.table for d in datasets}["order_events_flat"] == "ORDERS"

    def test_topics_come_from_discovered_list_when_present(self):
        topics = [KafkaConnectTopics(name="discovered_topic")]
        datasets = get_resolver("SnowflakeSink").resolve_datasets(BASE_SNOWFLAKE_CONFIG, topics)
        assert [d.source_topic for d in datasets] == ["discovered_topic"]

    def test_match_topic_is_an_exact_lookup_on_source_topic(self):
        """Renaming maps used to break matching because it re-derived by name."""
        config = dict(BASE_SNOWFLAKE_CONFIG, **{"snowflake.topic2table.map": "order_events_flat:ORDERS"})
        resolver = get_resolver("SnowflakeSink")
        dataset = next(d for d in resolver.resolve_datasets(config, []) if d.source_topic == "order_events_flat")
        topic_map = {"order_events_flat": "<topic>", "om-lineage-test": "<other>"}
        assert resolver.match_topic(dataset, topic_map, config) == "<topic>"

    def test_match_topic_returns_none_when_topic_absent(self):
        resolver = get_resolver("SnowflakeSink")
        dataset = resolver.resolve_datasets(BASE_SNOWFLAKE_CONFIG, [])[0]
        assert resolver.match_topic(dataset, {}, BASE_SNOWFLAKE_CONFIG) is None

    def test_missing_database_leaves_dataset_unqualified(self):
        config = {k: v for k, v in BASE_SNOWFLAKE_CONFIG.items() if k != "snowflake.database.name"}
        dataset = get_resolver("SnowflakeSink").resolve_datasets(config, [])[0]
        assert dataset.fully_qualified is False


def _new_source() -> KafkaconnectSource:
    """A KafkaconnectSource with __init__ bypassed, matching the idiom already
    used throughout tests/unit/topology/pipeline/test_kafkaconnect.py, so these
    unbound-style calls exercise real instance dispatch (subclass overrides of
    _resolver_for included) instead of a None stand-in."""
    return object.__new__(KafkaconnectSource)


class TestSourceDelegatesToResolver:
    def test_snowflake_config_now_produces_datasets(self):
        """Regression guard: this returned [] before the resolver registry."""
        details = KafkaConnectPipelineDetails(name="snowflake-landing", type="sink", config=BASE_SNOWFLAKE_CONFIG)
        resolver = _new_source()._resolver_for(details)
        datasets = resolver.resolve_datasets(details.config, details.topics)
        assert len(datasets) == 2

    def test_non_snowflake_sink_still_uses_default(self):
        details = KafkaConnectPipelineDetails(
            name="jdbc",
            type="sink",
            config={"connector.class": "JdbcSinkConnector", "table.name.format": "orders"},
        )
        resolver = _new_source()._resolver_for(details)
        assert isinstance(resolver, DefaultResolver)

    def test_missing_config_falls_back_to_default(self):
        details = KafkaConnectPipelineDetails(name="x", type="sink", config=None)
        assert isinstance(_new_source()._resolver_for(details), DefaultResolver)

    def test_sink_matching_uses_the_resolver(self):
        config = dict(BASE_SNOWFLAKE_CONFIG, **{"snowflake.topic2table.map": "order_events_flat:ORDERS"})
        details = KafkaConnectPipelineDetails(name="s", type="sink", config=config)
        resolver = _new_source()._resolver_for(details)
        dataset = next(d for d in resolver.resolve_datasets(config, []) if d.source_topic == "order_events_flat")
        matched = _new_source()._match_topic_to_dataset(dataset, {"order_events_flat": "<topic>"}, details, None)
        assert matched == "<topic>"


class TestSnowflakeServiceResolution:
    def test_managed_plugin_name_maps_to_snowflake(self):
        assert CONNECTOR_CLASS_TO_SERVICE_TYPE["SnowflakeSink"] == "Snowflake"

    def test_self_managed_class_maps_to_snowflake(self):
        assert CONNECTOR_CLASS_TO_SERVICE_TYPE["SnowflakeSinkConnector"] == "Snowflake"

    def test_snowflake_hostname_key_is_url_name(self):
        assert "snowflake.url.name" in SERVICE_TYPE_HOSTNAME_KEYS["Snowflake"]

    def test_url_with_leading_whitespace_is_stripped(self):
        """Observed live: the UI stored ' FMFAHQK-GI58232.snowflakecomputing.com'."""
        extracted = KafkaconnectSource._extract_hostname(None, " FMFAHQK-GI58232.snowflakecomputing.com")
        assert extracted == "FMFAHQK-GI58232.snowflakecomputing.com"


# Observed live: Confluent reports "<account>.snowflakecomputing.com" (with a leading
# space, as the UI stored it) while the OpenMetadata service holds the bare account.
LIVE_SNOWFLAKE_URL = " FMFAHQK-GI58232.snowflakecomputing.com"
LIVE_SNOWFLAKE_ACCOUNT = "FMFAHQK-GI58232"


def _database_service(name: str, service_type: DatabaseServiceType, config) -> DatabaseService:
    return DatabaseService(
        id=uuid.uuid4(),
        name=name,
        serviceType=service_type,
        connection=DatabaseConnection(config=config),
    )


def _snowflake_service(name: str = "snowflake_prod", account: str = LIVE_SNOWFLAKE_ACCOUNT) -> DatabaseService:
    return _database_service(
        name,
        DatabaseServiceType.Snowflake,
        SnowflakeConnection(username="etl_user", account=account, warehouse="COMPUTE_WH"),
    )


def _source_with_services(services) -> KafkaconnectSource:
    source = _new_source()
    source._database_services_cache = services
    source._messaging_services_cache = []
    return source


class TestSnowflakeHostnameMatching:
    """SnowflakeConnection has neither hostPort nor host, so hostname matching has to
    probe `account` and tolerate the .snowflakecomputing.com suffix — otherwise
    SERVICE_TYPE_HOSTNAME_KEYS["Snowflake"] extracts a value it can never match and
    dbServiceNames stays mandatory."""

    def test_account_matches_connector_url_with_domain_suffix(self):
        source = _source_with_services([_snowflake_service()])
        assert source.find_database_service_by_hostname("Snowflake", LIVE_SNOWFLAKE_URL) == "snowflake_prod"

    def test_account_matching_is_case_insensitive(self):
        source = _source_with_services([_snowflake_service(account="fmfahqk-gi58232")])
        assert source.find_database_service_by_hostname("Snowflake", LIVE_SNOWFLAKE_URL) == "snowflake_prod"

    def test_a_different_account_does_not_match(self):
        source = _source_with_services([_snowflake_service(account="OTHER-ACCOUNT")])
        assert source.find_database_service_by_hostname("Snowflake", LIVE_SNOWFLAKE_URL) is None

    def test_snowflake_service_resolves_from_connector_config(self):
        """End to end through the real config-key lookup: a live Confluent Snowflake Sink
        config must resolve its database service with no dbServiceNames configured."""
        source = _source_with_services([_snowflake_service()])
        details = KafkaConnectPipelineDetails(
            name="snowflake-landing",
            type="sink",
            config=dict(BASE_SNOWFLAKE_CONFIG, **{"snowflake.url.name": LIVE_SNOWFLAKE_URL}),
        )
        assert source.get_service_from_connector_config(details).database_service_name == "snowflake_prod"

    def test_host_port_matching_is_unchanged(self):
        """Regression guard: services that do expose hostPort must keep matching."""
        source = _source_with_services(
            [
                _database_service(
                    "mysql_prod",
                    DatabaseServiceType.Mysql,
                    MysqlConnection(
                        username="etl_user",
                        authType=BasicAuth(password="pwd"),
                        hostPort="mysql.example.com:3306",
                    ),
                )
            ]
        )
        matched = source.find_database_service_by_hostname("Mysql", "jdbc:mysql://mysql.example.com:3306/inventory")
        assert matched == "mysql_prod"


CDC_PIPELINE_DETAILS = KafkaConnectPipelineDetails(
    name="dbz",
    type="source",
    config={"connector.class": "MySqlCdcSource", "topic.prefix": "inventory"},
)


class TestDatasetFqnConstruction:
    """Pins the *slot* each value lands in by asserting on fqn.build's keyword arguments.

    Real fqn.build() only returns a raw-built string when database_name, schema_name AND
    service_name are all truthy (metadata.utils.fqn Table builder); for CDC database_name
    is intentionally None, so production resolution comes from an ES lookup a bare
    MagicMock can't simulate. Patching fqn.build lets us verify the arguments
    get_dataset_entity passes rather than ES's independent behaviour — and the arguments
    are what matter, because a joined FQN string is invariant under any permutation of
    the database/schema/table slots.
    """

    def _priority_one_kwargs(self, dataset, pipeline_details) -> dict:
        captured = []
        source = MagicMock(spec=KafkaconnectSource)
        source.metadata = MagicMock()
        # A miss on every lookup keeps all three priorities reachable, so captured[0]
        # is unambiguously the Priority 1 call.
        source.metadata.get_by_name.return_value = None
        source.get_service_from_connector_config.return_value = MagicMock(database_service_name="matched_service")
        source.get_db_service_names.return_value = []

        def fake_fqn_build(metadata=None, entity_type=None, **kwargs):
            captured.append(kwargs)
            return

        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.metadata.fqn.build",
            side_effect=fake_fqn_build,
        ):
            KafkaconnectSource.get_dataset_entity(source, pipeline_details, dataset)

        assert captured, "expected at least one fqn.build call"
        return captured[0]

    def test_qualified_dataset_builds_four_part_fqn(self):
        kwargs = self._priority_one_kwargs(
            KafkaConnectDatasetDetails(
                table="ORDER_EVENTS_FLAT",
                database="EVENT_LANDING",
                schema="PUBLIC",
                source_topic="order_events_flat",
                fully_qualified=True,
            ),
            KafkaConnectPipelineDetails(name="s", type="sink", config=BASE_SNOWFLAKE_CONFIG),
        )
        assert kwargs["service_name"] == "matched_service"
        assert kwargs["database_name"] == "EVENT_LANDING"
        assert kwargs["schema_name"] == "PUBLIC"
        assert kwargs["table_name"] == "ORDER_EVENTS_FLAT"

    def test_unqualified_cdc_dataset_keeps_three_part_fqn(self):
        """Debezium's 'database' is the logical server name (topic.prefix), not a real
        database, so it belongs in the schema slot with the database slot left empty."""
        kwargs = self._priority_one_kwargs(
            KafkaConnectDatasetDetails(table="orders", database="inventory", fully_qualified=False),
            CDC_PIPELINE_DETAILS,
        )
        assert kwargs["database_name"] is None
        assert kwargs["schema_name"] == "inventory"
        assert kwargs["table_name"] == "orders"

    def test_unqualified_cdc_dataset_with_schema_keeps_three_part_fqn(self):
        """table.include.list = "inventory.orders" populates `schema` while the dataset
        stays unqualified: the logical server name must still win the schema slot.
        Gating on `schema` instead of `fully_qualified` breaks exactly here."""
        kwargs = self._priority_one_kwargs(
            KafkaConnectDatasetDetails(
                table="orders",
                database="inventory",
                schema="public",
                fully_qualified=False,
            ),
            CDC_PIPELINE_DETAILS,
        )
        assert kwargs["database_name"] is None
        assert kwargs["schema_name"] == "inventory"
        assert kwargs["table_name"] == "orders"


class TestUnresolvableTableDiagnostics:
    def test_warning_names_db_service_names_setting(self, caplog):
        source = MagicMock(spec=KafkaconnectSource)
        source.metadata = MagicMock()
        source.metadata.get_by_name.return_value = None
        source.metadata.search_in_any_service.return_value = None
        source.get_service_from_connector_config.return_value = MagicMock(database_service_name=None)
        source.get_db_service_names.return_value = []

        dataset = KafkaConnectDatasetDetails(
            table="ORDER_EVENTS_FLAT",
            database="TEST_DB",
            schema="MAYUR_SCHEMA",
            source_topic="order_events_flat",
            fully_qualified=True,
        )
        with caplog.at_level(logging.WARNING):
            KafkaconnectSource.get_dataset_entity(
                source,
                KafkaConnectPipelineDetails(name="s", type="sink", config=BASE_SNOWFLAKE_CONFIG),
                dataset,
            )

        combined = " ".join(record.message for record in caplog.records)
        assert "dbServiceNames" in combined
        assert "ORDER_EVENTS_FLAT" in combined


# Captured verbatim from GET /connect/v1/environments/env-.../connectors/SnowflakeSinkConnector_0
REAL_CONFLUENT_CLOUD_RESPONSE = {
    "name": "SnowflakeSinkConnector_0",
    "type": "sink",
    "config": {
        "connector.class": "SnowflakeSink",
        "input.data.format": "AVRO",
        "kafka.api.key": "IWZOEA4Q46ZJDE52",
        "kafka.api.secret": "****************",
        "kafka.auth.mode": "KAFKA_API_KEY",
        "kafka.endpoint": "SASL_SSL://pkc-56d1g.eastus.azure.confluent.cloud:9092",
        "name": "SnowflakeSinkConnector_0",
        "snowflake.database.name": "TEST_DB",
        "snowflake.private.key": "****************",
        "snowflake.schema.name": "MAYUR_SCHEMA",
        "snowflake.url.name": " FMFAHQK-GI58232.snowflakecomputing.com",
        "snowflake.user.name": "MAYUR",
        "tasks.max": "1",
        "topics": "order_events_flat",
    },
    "tasks": [{"connector": "SnowflakeSinkConnector_0", "task": 0}],
}


def _confluent_cloud_client(monkeypatch):
    connection = KafkaConnectConnection(
        hostPort="https://api.confluent.cloud/connect/v1/environments/env-x/clusters/lkc-y"
    )
    client = KafkaConnectClient(connection)
    client.client = MagicMock()
    client.client.get_connector.return_value = REAL_CONFLUENT_CLOUD_RESPONSE
    return client


class TestConfluentCloudConfigShape:
    def test_flat_config_map_is_returned(self, monkeypatch):
        client = _confluent_cloud_client(monkeypatch)
        assert client.is_confluent_cloud is True
        config = client.get_connector_config("SnowflakeSinkConnector_0")
        assert config["connector.class"] == "SnowflakeSink"
        assert config["snowflake.database.name"] == "TEST_DB"

    def test_defaulted_properties_are_absent_not_false(self):
        """The API omits defaults, so presence checks are unsafe."""
        config = REAL_CONFLUENT_CLOUD_RESPONSE["config"]
        assert "snowflake.enable.schematization" not in config
        assert "snowflake.ingestion.method" not in config


# The Avro schema registered for order_events_nested in the live simulation.
NESTED_AVRO = json.dumps(
    {
        "type": "record",
        "name": "OrderEvent",
        "namespace": "com.example.events",
        "fields": [
            {"name": "order_id", "type": "string"},
            {"name": "customer_name", "type": "string"},
            {"name": "order_total", "type": "double"},
            {
                "name": "address",
                "type": {
                    "type": "record",
                    "name": "Address",
                    "fields": [
                        {"name": "street", "type": "string"},
                        {"name": "city", "type": "string"},
                        {"name": "zipcode", "type": "int"},
                    ],
                },
            },
        ],
    }
)

# Verbatim from DESC TABLE TEST_DB.MAYUR_SCHEMA.ORDER_EVENTS_NESTED
REAL_SNOWFLAKE_COLUMNS = [
    ("RECORD_METADATA", DataType.JSON),
    ("CUSTOMER_NAME", DataType.VARCHAR),
    ("ORDER_ID", DataType.VARCHAR),
    ("ORDER_TOTAL", DataType.FLOAT),
    ("ADDRESS", DataType.JSON),
]


def _nested_topic() -> Topic:
    return Topic(
        id=uuid.uuid4(),
        name="order_events_nested",
        partitions=1,
        service={"id": uuid.uuid4(), "type": "messagingService"},
        messageSchema=TopicSchema(
            schemaText=NESTED_AVRO,
            schemaType=SchemaType.Avro,
            schemaFields=parse_avro_schema(NESTED_AVRO, cls=FieldModel),
        ),
    )


def _nested_table() -> Table:
    return Table(
        id=uuid.uuid4(),
        name="ORDER_EVENTS_NESTED",
        columns=[Column(name=n, dataType=t) for n, t in REAL_SNOWFLAKE_COLUMNS],
        databaseSchema={"id": uuid.uuid4(), "type": "databaseSchema"},
    )


class TestObservedColumnShape:
    """Locks in the shapes measured against live Confluent Cloud + Snowflake on 2026-08-05:
    Snowflake schematization creates one column per top-level Avro field, uppercased, and a
    nested record becomes a single VARIANT column rather than being flattened."""

    def test_topic_exposes_only_top_level_avro_fields(self):
        columns = _new_source()._extract_columns_from_entity(_nested_topic())
        assert columns == ["order_id", "customer_name", "order_total", "address"]

    def test_nested_record_maps_to_one_variant_column(self):
        """Snowflake does not flatten nested records; ADDRESS is a single VARIANT."""
        source = _new_source()._extract_columns_from_entity(_nested_topic())
        target = _new_source()._extract_columns_from_entity(_nested_table())
        target_map = {c.lower(): c for c in target}
        matched = {s: target_map[s.lower()] for s in source if s.lower() in target_map}
        assert matched == {
            "order_id": "ORDER_ID",
            "customer_name": "CUSTOMER_NAME",
            "order_total": "ORDER_TOTAL",
            "address": "ADDRESS",
        }

    def test_record_metadata_produces_no_edge(self):
        """RECORD_METADATA has no source-side counterpart, so it must yield no edge."""
        source = _new_source()._extract_columns_from_entity(_nested_topic())
        assert "record_metadata" not in {s.lower() for s in source}

    def test_every_topic_field_finds_a_column(self):
        source = _new_source()._extract_columns_from_entity(_nested_topic())
        target = {c.lower() for c in _new_source()._extract_columns_from_entity(_nested_table())}
        assert [s for s in source if s.lower() not in target] == []


class TestEndToEndDatasetResolution:
    def test_real_connector_config_resolves_one_dataset_per_topic(self):
        config = dict(
            REAL_CONFLUENT_CLOUD_RESPONSE["config"],
            topics="order_events_flat,order_events_nested,om-lineage-test",
        )
        details = KafkaConnectPipelineDetails(name="s", type="sink", config=config)
        resolver = _new_source()._resolver_for(details)
        datasets = resolver.resolve_datasets(config, [])
        assert [d.table for d in datasets] == [
            "ORDER_EVENTS_FLAT",
            "ORDER_EVENTS_NESTED",
            "OM_LINEAGE_TEST_702890019",
        ]
        assert all(d.database == "TEST_DB" and d.schema == "MAYUR_SCHEMA" for d in datasets)
        assert all(d.fully_qualified for d in datasets)
