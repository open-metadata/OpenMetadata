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
from types import SimpleNamespace
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
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.schema import FieldModel, SchemaType
from metadata.generated.schema.type.schema import Topic as TopicSchema
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.pipeline.kafkaconnect.client import KafkaConnectClient
from metadata.ingestion.source.pipeline.kafkaconnect.constants import (
    CONNECTOR_CLASS_TO_SERVICE_TYPE,
    SERVICE_TYPE_HOSTNAME_KEYS,
)
from metadata.ingestion.source.pipeline.kafkaconnect.metadata import KafkaconnectSource
from metadata.ingestion.source.pipeline.kafkaconnect.models import (
    KafkaConnectColumnMapping,
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


# Field and column FQNs exactly as observed live on 2026-08-06. The Avro record name
# (OrderEvent) is itself a level in the topic field FQN, so a topic field FQN is
# <messagingService>.<topic>.<recordName>.<field>.
TOPIC_FIELD_FQN_PREFIX = "confluent_kafka.order_events_nested"
TABLE_COLUMN_FQN_PREFIX = "snowflake.TEST_DB.MAYUR_SCHEMA.ORDER_EVENTS_NESTED"


def _with_field_fqns(topic: Topic, prefix: str) -> Topic:
    """Populate the field FQNs a real topic ingestion writes. `build_column_lineage`
    resolves both ends of every edge through `fullyQualifiedName`, so a fixture without
    them silently produces zero edges."""
    for root_field in topic.messageSchema.schemaFields or []:
        root_fqn = f"{prefix}.{model_str(root_field.name)}"
        root_field.fullyQualifiedName = FullyQualifiedEntityName(root_fqn)
        for child in root_field.children or []:
            child.fullyQualifiedName = FullyQualifiedEntityName(f"{root_fqn}.{model_str(child.name)}")
    return topic


def _nested_topic_with_field_fqns() -> Topic:
    return _with_field_fqns(_nested_topic(), TOPIC_FIELD_FQN_PREFIX)


def _nested_table_with_column_fqns() -> Table:
    """`_nested_table()` plus the column FQNs a real Snowflake ingestion writes."""
    table = _nested_table()
    for column in table.columns or []:
        column.fullyQualifiedName = FullyQualifiedEntityName(f"{TABLE_COLUMN_FQN_PREFIX}.{model_str(column.name)}")
    return table


SNOWFLAKE_SINK_DETAILS = KafkaConnectPipelineDetails(
    name="snowflake_sink_avro",
    type="sink",
    config={"connector.class": "SnowflakeSink"},
)

NESTED_DATASET_DETAILS = KafkaConnectDatasetDetails(
    table="ORDER_EVENTS_NESTED",
    database="TEST_DB",
    schema="MAYUR_SCHEMA",
    source_topic="order_events_nested",
    fully_qualified=True,
)


class TestObservedColumnShape:
    """Locks in the shapes measured against live Confluent Cloud + Snowflake on 2026-08-05:
    Snowflake schematization creates one column per top-level Avro field, uppercased, and a
    nested record becomes a single VARIANT column rather than being flattened."""

    def test_topic_exposes_only_top_level_avro_fields(self):
        columns = _new_source()._extract_columns_from_entity(_nested_topic())
        assert columns == ["order_id", "customer_name", "order_total", "address"]

    def test_extractors_produce_the_observed_column_sets(self):
        """Both extractors, over the live shapes: the topic yields only the four
        top-level Avro fields (street/city/zipcode stay inside `address`) and the table
        yields the five Snowflake columns, `ADDRESS` being one VARIANT rather than three
        flattened columns. The name matching between the two sets is the product's job
        and is asserted through `build_column_lineage` in TestObservedColumnLineageEdges."""
        assert _new_source()._extract_columns_from_entity(_nested_topic()) == [
            "order_id",
            "customer_name",
            "order_total",
            "address",
        ]
        assert _new_source()._extract_columns_from_entity(_nested_table()) == [
            "RECORD_METADATA",
            "CUSTOMER_NAME",
            "ORDER_ID",
            "ORDER_TOTAL",
            "ADDRESS",
        ]

    def test_every_topic_field_finds_a_column(self):
        source = _new_source()._extract_columns_from_entity(_nested_topic())
        target = {c.lower() for c in _new_source()._extract_columns_from_entity(_nested_table())}
        # Without this guard an empty source list satisfies the claim vacuously.
        assert source
        assert [s for s in source if s.lower() not in target] == []


class TestObservedColumnLineageEdges:
    """The headline behaviour: `build_column_lineage` over the real observed topic and
    table shapes. Every edge below was produced by a live run against Confluent Cloud +
    Snowflake and re-verified 2026-08-06."""

    def _edges(self) -> set:
        topic = _nested_topic_with_field_fqns()
        table = _nested_table_with_column_fqns()
        lineage = _new_source().build_column_lineage(
            from_entity=topic,
            to_entity=table,
            topic_entity=topic,
            pipeline_details=SNOWFLAKE_SINK_DETAILS,
            dataset_details=NESTED_DATASET_DETAILS,
        )
        assert lineage is not None, "sink column lineage produced no edges at all"
        assert all(len(edge.fromColumns) == 1 for edge in lineage)
        # fromColumns entries and toColumn are RootModels; bare str() yields "root='...'".
        return {(model_str(edge.fromColumns[0]), model_str(edge.toColumn)) for edge in lineage}

    def test_sink_maps_every_topic_field_to_its_snowflake_column(self):
        assert self._edges() == {
            (
                f"{TOPIC_FIELD_FQN_PREFIX}.OrderEvent.order_id",
                f"{TABLE_COLUMN_FQN_PREFIX}.ORDER_ID",
            ),
            (
                f"{TOPIC_FIELD_FQN_PREFIX}.OrderEvent.customer_name",
                f"{TABLE_COLUMN_FQN_PREFIX}.CUSTOMER_NAME",
            ),
            (
                f"{TOPIC_FIELD_FQN_PREFIX}.OrderEvent.order_total",
                f"{TABLE_COLUMN_FQN_PREFIX}.ORDER_TOTAL",
            ),
            (
                f"{TOPIC_FIELD_FQN_PREFIX}.OrderEvent.address",
                f"{TABLE_COLUMN_FQN_PREFIX}.ADDRESS",
            ),
        }

    def test_nested_record_targets_one_variant_column(self):
        """Snowflake stores `address` as a single VARIANT, so exactly one edge lands on
        ADDRESS — not three edges onto flattened ADDRESS_STREET/CITY/ZIPCODE columns."""
        targets = [target for _, target in self._edges()]
        assert targets.count(f"{TABLE_COLUMN_FQN_PREFIX}.ADDRESS") == 1

    def test_record_metadata_is_never_a_lineage_target(self):
        """RECORD_METADATA is added by the sink itself and has no topic-side field, so
        no edge may claim it."""
        targets = {target for _, target in self._edges()}
        assert f"{TABLE_COLUMN_FQN_PREFIX}.RECORD_METADATA" not in targets


# The live schema is snake_case throughout, which leaves the source side of the matcher's
# case fold unexercised; camelCase Avro fields are common and Snowflake uppercases them.
CAMEL_CASE_AVRO = json.dumps(
    {
        "type": "record",
        "name": "CamelEvent",
        "namespace": "com.example.events",
        "fields": [{"name": "orderId", "type": "string"}],
    }
)
CAMEL_TOPIC_FIELD_FQN_PREFIX = "confluent_kafka.camel_events"
CAMEL_TABLE_COLUMN_FQN_PREFIX = "snowflake.TEST_DB.MAYUR_SCHEMA.CAMEL_EVENTS"


class TestColumnMatchingIsCaseInsensitiveOnBothSides:
    """Derived (not live-observed) case: matching is case-insensitive in both directions,
    so a camelCase topic field still reaches its uppercased Snowflake column."""

    def test_camel_case_field_matches_its_uppercased_column(self):
        topic = _with_field_fqns(
            Topic(
                id=uuid.uuid4(),
                name="camel_events",
                partitions=1,
                service={"id": uuid.uuid4(), "type": "messagingService"},
                messageSchema=TopicSchema(
                    schemaText=CAMEL_CASE_AVRO,
                    schemaType=SchemaType.Avro,
                    schemaFields=parse_avro_schema(CAMEL_CASE_AVRO, cls=FieldModel),
                ),
            ),
            CAMEL_TOPIC_FIELD_FQN_PREFIX,
        )
        table = Table(
            id=uuid.uuid4(),
            name="CAMEL_EVENTS",
            columns=[
                Column(
                    name="ORDERID",
                    dataType=DataType.VARCHAR,
                    fullyQualifiedName=f"{CAMEL_TABLE_COLUMN_FQN_PREFIX}.ORDERID",
                )
            ],
            databaseSchema={"id": uuid.uuid4(), "type": "databaseSchema"},
        )
        lineage = _new_source().build_column_lineage(
            from_entity=topic,
            to_entity=table,
            topic_entity=topic,
            pipeline_details=SNOWFLAKE_SINK_DETAILS,
            dataset_details=KafkaConnectDatasetDetails(
                table="CAMEL_EVENTS",
                database="TEST_DB",
                schema="MAYUR_SCHEMA",
                source_topic="camel_events",
                fully_qualified=True,
            ),
        )
        assert lineage is not None, "camelCase field produced no edge at all"
        assert [(model_str(edge.fromColumns[0]), model_str(edge.toColumn)) for edge in lineage] == [
            (
                f"{CAMEL_TOPIC_FIELD_FQN_PREFIX}.CamelEvent.orderId",
                f"{CAMEL_TABLE_COLUMN_FQN_PREFIX}.ORDERID",
            )
        ]


class TestEndToEndDatasetResolution:
    def test_real_connector_config_resolves_one_dataset_per_topic(self):
        """The connector config is verbatim from a live `GET /connectors/{name}` captured
        2026-08-05; the resulting lineage was re-verified live 2026-08-06."""
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
        # match_topic returns None without source_topic, so losing it silently kills lineage.
        assert [d.source_topic for d in datasets] == [
            "order_events_flat",
            "order_events_nested",
            "om-lineage-test",
        ]


FLATTEN_CONFIG = dict(
    BASE_SNOWFLAKE_CONFIG,
    topics="order_events_nested",
    transforms="flatten",
    **{
        "transforms.flatten.type": "io.confluent.connect.transforms.Flatten$Value",
        "transforms.flatten.delimiter": "_",
    },
)


class TestFlattenSmtColumnMappings:
    def test_no_smt_returns_empty_so_one_to_one_inference_applies(self):
        resolver = get_resolver("SnowflakeSink")
        assert resolver.column_mappings(BASE_SNOWFLAKE_CONFIG, _nested_topic()) == []

    def test_flatten_joins_nested_paths_with_the_configured_delimiter(self):
        mappings = get_resolver("SnowflakeSink").column_mappings(FLATTEN_CONFIG, _nested_topic())
        pairs = {(m.source_column, m.target_column) for m in mappings}
        assert ("street", "ADDRESS_STREET") in pairs
        assert ("city", "ADDRESS_CITY") in pairs
        assert ("zipcode", "ADDRESS_ZIPCODE") in pairs

    def test_flatten_leaves_top_level_fields_untouched(self):
        mappings = get_resolver("SnowflakeSink").column_mappings(FLATTEN_CONFIG, _nested_topic())
        pairs = {(m.source_column, m.target_column) for m in mappings}
        assert ("order_id", "ORDER_ID") in pairs

    def test_default_delimiter_is_a_dot(self):
        config = {k: v for k, v in FLATTEN_CONFIG.items() if k != "transforms.flatten.delimiter"}
        mappings = get_resolver("SnowflakeSink").column_mappings(config, _nested_topic())
        assert any(m.target_column == "ADDRESS.STREET" for m in mappings)

    def test_every_leaf_is_mapped_exactly_once_and_no_type_level_leaks_in(self):
        """The Avro parser puts a type-named level (OrderEvent, Address) between a record
        and its fields; leaking one in would produce ORDEREVENT_* / ADDRESS_ADDRESS_* targets
        that match no Snowflake column."""
        mappings = get_resolver("SnowflakeSink").column_mappings(FLATTEN_CONFIG, _nested_topic())
        assert [m.target_column for m in mappings] == [
            "ORDER_ID",
            "CUSTOMER_NAME",
            "ORDER_TOTAL",
            "ADDRESS_STREET",
            "ADDRESS_CITY",
            "ADDRESS_ZIPCODE",
        ]

    def test_a_non_flatten_transform_is_not_mistaken_for_flatten(self):
        config = dict(
            BASE_SNOWFLAKE_CONFIG,
            transforms="router",
            **{"transforms.router.type": "io.debezium.transforms.outbox.EventRouter"},
        )
        assert get_resolver("SnowflakeSink").column_mappings(config, _nested_topic()) == []

    def test_flatten_is_found_among_several_chained_transforms(self):
        config = dict(
            BASE_SNOWFLAKE_CONFIG,
            transforms=" router , flatten ",
            **{
                "transforms.router.type": "io.debezium.transforms.outbox.EventRouter",
                "transforms.flatten.type": "org.apache.kafka.connect.transforms.Flatten$Value",
                "transforms.flatten.delimiter": "_",
            },
        )
        mappings = get_resolver("SnowflakeSink").column_mappings(config, _nested_topic())
        assert ("street", "ADDRESS_STREET") in {(m.source_column, m.target_column) for m in mappings}

    def test_topic_without_a_schema_yields_no_mappings(self):
        """A topic ingested without Schema Registry credentials carries no schemaFields;
        that must degrade to [] rather than raise inside the lineage loop."""
        topic = Topic(
            id=uuid.uuid4(),
            name="order_events_nested",
            partitions=1,
            service={"id": uuid.uuid4(), "type": "messagingService"},
        )
        assert get_resolver("SnowflakeSink").column_mappings(FLATTEN_CONFIG, topic) == []

    def test_defaulted_schematization_properties_do_not_gate_mappings(self):
        """Confluent Cloud omits defaulted properties, so absence must not mean "off"."""
        assert "snowflake.enable.schematization" not in FLATTEN_CONFIG
        assert "snowflake.ingestion.method" not in FLATTEN_CONFIG
        assert get_resolver("SnowflakeSink").column_mappings(FLATTEN_CONFIG, _nested_topic())


def _with_nested_field_fqns(topic: Topic, prefix: str) -> Topic:
    """Populate field FQNs at every depth, the way ``TopicRepository.setFieldFQN`` does
    server-side (parentFQN + name, type-named levels included). ``_with_field_fqns`` stops at
    direct children, which covers the 1:1 path but leaves nested leaves unresolvable."""

    def descend(fields, parent_fqn):
        for field in fields or []:
            field_fqn = f"{parent_fqn}.{model_str(field.name)}"
            field.fullyQualifiedName = FullyQualifiedEntityName(field_fqn)
            descend(field.children, field_fqn)

    descend(topic.messageSchema.schemaFields, prefix)
    return topic


# What DESC TABLE returns once a Flatten SMT with delimiter "_" is in the connector chain:
# the nested record becomes three scalar columns instead of one VARIANT.
FLATTENED_SNOWFLAKE_COLUMNS = [
    ("RECORD_METADATA", DataType.JSON),
    ("ORDER_ID", DataType.VARCHAR),
    ("CUSTOMER_NAME", DataType.VARCHAR),
    ("ORDER_TOTAL", DataType.FLOAT),
    ("ADDRESS_STREET", DataType.VARCHAR),
    ("ADDRESS_CITY", DataType.VARCHAR),
    ("ADDRESS_ZIPCODE", DataType.NUMBER),
]


def _flattened_table_with_column_fqns() -> Table:
    table = Table(
        id=uuid.uuid4(),
        name="ORDER_EVENTS_NESTED",
        columns=[Column(name=n, dataType=t) for n, t in FLATTENED_SNOWFLAKE_COLUMNS],
        databaseSchema={"id": uuid.uuid4(), "type": "databaseSchema"},
    )
    for column in table.columns:
        column.fullyQualifiedName = FullyQualifiedEntityName(f"{TABLE_COLUMN_FQN_PREFIX}.{model_str(column.name)}")
    return table


def _flatten_dataset_details(column_mappings) -> KafkaConnectDatasetDetails:
    return KafkaConnectDatasetDetails(
        table="ORDER_EVENTS_NESTED",
        database="TEST_DB",
        schema="MAYUR_SCHEMA",
        source_topic="order_events_nested",
        fully_qualified=True,
        column_mappings=column_mappings,
    )


class TestExplicitColumnMappingBranch:
    """The explicit-mapping branch of ``build_column_lineage`` had never executed because
    nothing populated ``column_mappings``; it resolved topic fields through
    ``get_column_fqn(table_entity=topic)``, which cannot work because ``Topic`` has no
    ``.columns``."""

    def _edges(self, dataset_details) -> set:
        topic = _with_nested_field_fqns(_nested_topic(), TOPIC_FIELD_FQN_PREFIX)
        lineage = _new_source().build_column_lineage(
            from_entity=topic,
            to_entity=_flattened_table_with_column_fqns(),
            topic_entity=topic,
            pipeline_details=SNOWFLAKE_SINK_DETAILS,
            dataset_details=dataset_details,
        )
        assert lineage is not None, "explicit column mappings produced no edges at all"
        return {(model_str(edge.fromColumns[0]), model_str(edge.toColumn)) for edge in lineage}

    def test_explicit_mappings_reach_flattened_columns(self):
        details = _flatten_dataset_details(
            get_resolver("SnowflakeSink").column_mappings(FLATTEN_CONFIG, _nested_topic())
        )
        assert self._edges(details) == {
            (
                f"{TOPIC_FIELD_FQN_PREFIX}.OrderEvent.order_id",
                f"{TABLE_COLUMN_FQN_PREFIX}.ORDER_ID",
            ),
            (
                f"{TOPIC_FIELD_FQN_PREFIX}.OrderEvent.customer_name",
                f"{TABLE_COLUMN_FQN_PREFIX}.CUSTOMER_NAME",
            ),
            (
                f"{TOPIC_FIELD_FQN_PREFIX}.OrderEvent.order_total",
                f"{TABLE_COLUMN_FQN_PREFIX}.ORDER_TOTAL",
            ),
            (
                f"{TOPIC_FIELD_FQN_PREFIX}.OrderEvent.address.Address.street",
                f"{TABLE_COLUMN_FQN_PREFIX}.ADDRESS_STREET",
            ),
            (
                f"{TOPIC_FIELD_FQN_PREFIX}.OrderEvent.address.Address.city",
                f"{TABLE_COLUMN_FQN_PREFIX}.ADDRESS_CITY",
            ),
            (
                f"{TOPIC_FIELD_FQN_PREFIX}.OrderEvent.address.Address.zipcode",
                f"{TABLE_COLUMN_FQN_PREFIX}.ADDRESS_ZIPCODE",
            ),
        }

    def test_record_metadata_is_never_a_lineage_target(self):
        details = _flatten_dataset_details(
            get_resolver("SnowflakeSink").column_mappings(FLATTEN_CONFIG, _nested_topic())
        )
        targets = {target for _, target in self._edges(details)}
        assert f"{TABLE_COLUMN_FQN_PREFIX}.RECORD_METADATA" not in targets

    def test_a_mapping_onto_a_missing_column_is_dropped_not_fatal(self):
        details = _flatten_dataset_details(
            [
                KafkaConnectColumnMapping(source_column="order_id", target_column="ORDER_ID"),
                KafkaConnectColumnMapping(source_column="ghost", target_column="GHOST"),
            ]
        )
        assert self._edges(details) == {
            (
                f"{TOPIC_FIELD_FQN_PREFIX}.OrderEvent.order_id",
                f"{TABLE_COLUMN_FQN_PREFIX}.ORDER_ID",
            )
        }


def _run_sink_lineage(config, topic, table, topic_name="order_events_nested"):
    """Drive ``yield_pipeline_lineage_details`` with only the OpenMetadata REST client and
    ingestion context mocked, so dataset resolution, topic matching, ``column_mappings``
    population and edge construction all run for real."""
    source = _new_source()
    source._topics_cache = {}
    source.lineage_results = []
    source.context = MagicMock()
    source.context.get.return_value = SimpleNamespace(pipeline_service="KafkaConnectSvc", pipeline="snowflake-landing")
    source._resolve_messaging_service = lambda pipeline_details: "confluent_kafka"
    source.get_dataset_entity = lambda **kwargs: table

    pipeline_entity = SimpleNamespace(id=SimpleNamespace(root=uuid.uuid4()))

    def _get_by_name(entity=None, fqn=None, **kwargs):
        entity_name = getattr(entity, "__name__", "")
        if entity_name == "Pipeline":
            return pipeline_entity
        if entity_name == "Topic":
            return topic
        return None

    source.metadata = MagicMock()
    source.metadata.get_by_name.side_effect = _get_by_name

    details = KafkaConnectPipelineDetails(
        name="snowflake-landing",
        type="sink",
        config=config,
        topics=[KafkaConnectTopics(name=topic_name)],
    )

    with patch(
        "metadata.ingestion.source.pipeline.kafkaconnect.metadata.fqn.build",
        side_effect=lambda **kwargs: "confluent_kafka.order_events_nested",
    ):
        results = list(source.yield_pipeline_lineage_details(details))

    errors = [r.left for r in results if r.left is not None]
    assert not errors, f"lineage yielded errors: {errors}"
    return details, [r.right for r in results if r.right is not None]


class TestFlattenColumnMappingsAtTheCallSite:
    """Step 6 wiring: the lineage loop must ask the resolver for column mappings and the
    resulting edges must land on the flattened columns."""

    def _column_edges(self, config, topic, table):
        _, requests = _run_sink_lineage(config, topic, table)
        assert len(requests) == 1, f"expected one entity edge, got {len(requests)}"
        columns_lineage = requests[0].edge.lineageDetails.columnsLineage or []
        return {(model_str(c.fromColumns[0]), model_str(c.toColumn)) for c in columns_lineage}

    def test_flatten_config_produces_edges_onto_the_flattened_columns(self):
        edges = self._column_edges(
            FLATTEN_CONFIG,
            _with_nested_field_fqns(_nested_topic(), TOPIC_FIELD_FQN_PREFIX),
            _flattened_table_with_column_fqns(),
        )
        assert (
            f"{TOPIC_FIELD_FQN_PREFIX}.OrderEvent.address.Address.street",
            f"{TABLE_COLUMN_FQN_PREFIX}.ADDRESS_STREET",
        ) in edges
        assert len(edges) == 6

    def test_no_smt_still_uses_the_live_verified_one_to_one_path(self):
        """Regression guard for the shipped behaviour: without Flatten the four top-level
        fields map 1:1 and `address` lands on the single VARIANT column."""
        edges = self._column_edges(
            dict(BASE_SNOWFLAKE_CONFIG, topics="order_events_nested"),
            _nested_topic_with_field_fqns(),
            _nested_table_with_column_fqns(),
        )
        assert edges == {
            (
                f"{TOPIC_FIELD_FQN_PREFIX}.OrderEvent.order_id",
                f"{TABLE_COLUMN_FQN_PREFIX}.ORDER_ID",
            ),
            (
                f"{TOPIC_FIELD_FQN_PREFIX}.OrderEvent.customer_name",
                f"{TABLE_COLUMN_FQN_PREFIX}.CUSTOMER_NAME",
            ),
            (
                f"{TOPIC_FIELD_FQN_PREFIX}.OrderEvent.order_total",
                f"{TABLE_COLUMN_FQN_PREFIX}.ORDER_TOTAL",
            ),
            (
                f"{TOPIC_FIELD_FQN_PREFIX}.OrderEvent.address",
                f"{TABLE_COLUMN_FQN_PREFIX}.ADDRESS",
            ),
        }

    def test_a_missing_topic_warns_instead_of_raising(self):
        """`column_mappings` reads messageSchema off the matched topic, so an unguarded call
        would turn a missing-topic warning into a failed connector run."""
        _, requests = _run_sink_lineage(FLATTEN_CONFIG, None, _flattened_table_with_column_fqns())
        assert requests == []
