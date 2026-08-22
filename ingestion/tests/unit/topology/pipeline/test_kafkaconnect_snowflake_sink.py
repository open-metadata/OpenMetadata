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
import os
import re
import subprocess
import sys
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

import metadata
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
from metadata.generated.schema.type.schema import DataTypeTopic, FieldModel, SchemaType
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
    SnowflakeSinkResolver,
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

    def test_single_character_topic_is_not_a_valid_identifier(self):
        """The connector's isValidSnowflakeObjectIdentifier is ^([_a-zA-Z]{1}[_$a-zA-Z0-9]+)$:
        the trailing + requires a second character, so a one-character topic takes the
        sanitise-and-hash path. Reproducing that exactly is the whole point of computing
        the hash rather than guessing the table name."""
        assert snowflake_table_name("a") == f"A_{abs(java_string_hashcode('a'))}"
        assert snowflake_table_name("a") == "A_97"


class TestMappedTableNameIsFoldedLikeADerivedOne:
    """A topic2table.map value is written into CREATE TABLE as an unquoted identifier, so
    Snowflake stores it uppercased and OpenMetadata ingests it uppercased. Passing the
    configured value through verbatim made the two branches of the table-name expression
    fold case differently, and Priority 1 builds an exact FQN from it -- so a lowercase
    map value produced an FQN that only the ES pre-search inside fqn.build could rescue,
    on the very path this resolver exists to make deterministic."""

    def test_a_lowercase_map_value_is_uppercased(self):
        config = dict(BASE_SNOWFLAKE_CONFIG, **{"snowflake.topic2table.map": "order_events_flat:orders"})
        datasets = get_resolver("SnowflakeSink").resolve_datasets(config, [])
        assert {d.source_topic: d.table for d in datasets}["order_events_flat"] == "ORDERS"

    def test_a_quoted_map_value_keeps_its_case_and_loses_the_quotes(self):
        """A double-quoted identifier is the one way to make Snowflake preserve case, and
        the stored name has no quotes in it -- that is the form OpenMetadata ingests."""
        config = dict(BASE_SNOWFLAKE_CONFIG, **{"snowflake.topic2table.map": 'order_events_flat:"orders"'})
        datasets = get_resolver("SnowflakeSink").resolve_datasets(config, [])
        assert {d.source_topic: d.table for d in datasets}["order_events_flat"] == "orders"


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

    def test_registered_under_current_self_managed_fqcn(self):
        resolver = get_resolver("com.snowflake.kafka.connector.SnowflakeStreamingSinkConnector")
        assert isinstance(resolver, SnowflakeSinkResolver)

    def test_current_connector_preserves_generated_topic_name_by_default(self):
        config = {
            **BASE_SNOWFLAKE_CONFIG,
            "connector.class": "com.snowflake.kafka.connector.SnowflakeStreamingSinkConnector",
            "topics": "prod.orders",
        }
        datasets = get_resolver(config["connector.class"]).resolve_datasets(config, [])
        assert [(dataset.source_topic, dataset.table) for dataset in datasets] == [("prod.orders", "prod.orders")]

    def test_current_connector_honours_generated_name_sanitization_flag(self):
        config = {
            **BASE_SNOWFLAKE_CONFIG,
            "connector.class": "com.snowflake.kafka.connector.SnowflakeStreamingSinkConnector",
            "topics": "prod.orders",
            "snowflake.compatibility.enable.autogenerated.table.name.sanitization": "true",
        }
        datasets = get_resolver(config["connector.class"]).resolve_datasets(config, [])
        assert datasets[0].table == snowflake_table_name("prod.orders")

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

    def test_topic2table_map_accepts_quoted_commas_and_colons(self):
        config = dict(BASE_SNOWFLAKE_CONFIG, **{"snowflake.topic2table.map": '"topic,one":"Table:One"'})
        topics = [KafkaConnectTopics(name="topic,one")]
        datasets = get_resolver("SnowflakeSink").resolve_datasets(config, topics)
        assert [(dataset.source_topic, dataset.table) for dataset in datasets] == [("topic,one", "Table:One")]

    def test_exact_mapping_wins_before_regex_regardless_of_declaration_order(self):
        config = dict(
            BASE_SNOWFLAKE_CONFIG,
            topics="orange_cat",
            **{"snowflake.topic2table.map": ".*:CATCH_ALL,orange_cat:EXACT"},
        )
        datasets = get_resolver("SnowflakeSink").resolve_datasets(config, [])
        assert [(dataset.source_topic, dataset.table) for dataset in datasets] == [("orange_cat", "EXACT")]

    def test_regex_mapping_matches_concrete_topics_without_creating_a_pattern_topic(self):
        config = dict(
            BASE_SNOWFLAKE_CONFIG,
            topics="orange_cat,blue_dog",
            **{"snowflake.topic2table.map": ".*_cat:CAT_TABLE"},
        )
        datasets = get_resolver("SnowflakeSink").resolve_datasets(config, [])
        assert [(dataset.source_topic, dataset.table) for dataset in datasets] == [
            ("orange_cat", "CAT_TABLE"),
            ("blue_dog", "BLUE_DOG"),
        ]

    def test_regex_replacement_uses_java_style_capture_groups(self):
        config = dict(
            BASE_SNOWFLAKE_CONFIG,
            topics="orange_cat",
            **{
                "snowflake.topic2table.map": "(.*)_cat:$1",
                "snowflake.topic2table.map.regex.replacement": "true",
            },
        )
        datasets = get_resolver("SnowflakeSink").resolve_datasets(config, [])
        assert datasets[0].table == "ORANGE"

    def test_malformed_map_warns_and_does_not_invent_a_derived_target(self, caplog):
        config = dict(BASE_SNOWFLAKE_CONFIG, **{"snowflake.topic2table.map": 'orders:"unterminated'})
        with caplog.at_level(logging.WARNING):
            datasets = get_resolver("SnowflakeSink").resolve_datasets(config, [])
        assert datasets == []
        assert "Ignoring invalid snowflake.topic2table.map" in " ".join(record.message for record in caplog.records)

    def test_invalid_map_regex_does_not_invent_a_derived_target(self, caplog):
        config = dict(BASE_SNOWFLAKE_CONFIG, **{"snowflake.topic2table.map": "[orders:ORDERS"})
        with caplog.at_level(logging.WARNING):
            datasets = get_resolver("SnowflakeSink").resolve_datasets(config, [])
        assert datasets == []
        assert "invalid topic selector" in " ".join(record.message for record in caplog.records)

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


DATABASE_ONLY_CONFIG = {k: v for k, v in BASE_SNOWFLAKE_CONFIG.items() if k != "snowflake.schema.name"}
SCHEMA_ONLY_CONFIG = {k: v for k, v in BASE_SNOWFLAKE_CONFIG.items() if k != "snowflake.database.name"}


class TestPartialQualificationNeverMisplacesTheDatabase:
    """`fully_qualified` decides *which slot* `database` lands in, and for a Snowflake sink
    `database` is always a real database -- never a Debezium-style logical server name. Deciding
    it from `database and schema` conflated that with "are both parts present", so a sink that
    set only snowflake.database.name pushed its database into the schema slot and produced an
    FQN (<service>.<database>.<table>) that can never match the real table."""

    def test_a_database_only_config_is_still_qualified(self):
        dataset = get_resolver("SnowflakeSink").resolve_datasets(DATABASE_ONLY_CONFIG, [])[0]
        assert dataset.database == "EVENT_LANDING"
        assert dataset.schema is None
        assert dataset.fully_qualified is True

    def test_a_database_only_config_keeps_the_database_out_of_the_schema_slot(self):
        dataset = get_resolver("SnowflakeSink").resolve_datasets(DATABASE_ONLY_CONFIG, [])[0]
        kwargs = _priority_one_fqn_kwargs(
            dataset,
            KafkaConnectPipelineDetails(name="s", type="sink", config=DATABASE_ONLY_CONFIG),
            # Snowflake is a multi-database service; the point is that the slot survives
            # even so, since the shared rule drops it whenever the schema is absent.
            supports_database=True,
        )
        assert kwargs["database_name"] == "EVENT_LANDING"
        assert kwargs["schema_name"] is None
        assert kwargs["table_name"] == "ORDER_EVENTS_FLAT"

    def test_a_database_only_config_warns_and_names_the_missing_schema_key(self, caplog):
        with caplog.at_level(logging.WARNING):
            get_resolver("SnowflakeSink").resolve_datasets(DATABASE_ONLY_CONFIG, [])
        combined = " ".join(record.message for record in caplog.records)
        assert "snowflake.schema.name" in combined
        assert "snowflake-landing" in combined

    def test_a_schema_only_config_warns_and_names_the_missing_database_key(self, caplog):
        with caplog.at_level(logging.WARNING):
            get_resolver("SnowflakeSink").resolve_datasets(SCHEMA_ONLY_CONFIG, [])
        combined = " ".join(record.message for record in caplog.records)
        assert "snowflake.database.name" in combined

    def test_a_complete_config_does_not_warn(self, caplog):
        with caplog.at_level(logging.WARNING):
            get_resolver("SnowflakeSink").resolve_datasets(BASE_SNOWFLAKE_CONFIG, [])
        assert [record.message for record in caplog.records] == []


class TestMappedTopicsAreNeverDropped:
    """snowflake.topic2table.map is explicit user configuration naming a concrete topic->table
    pair. Building datasets only for topics in the discovered/configured topic list dropped every
    mapping whose topic was not in that list -- the case a topics.regex subscription produces when
    only some of its topics are discovered -- and dropped it silently, so the lost lineage was not
    even diagnosable."""

    def test_a_mapped_topic_absent_from_the_topic_list_still_yields_a_dataset(self):
        config = dict(BASE_SNOWFLAKE_CONFIG, **{"snowflake.topic2table.map": "prod.orders:ORDERS"})
        datasets = get_resolver("SnowflakeSink").resolve_datasets(config, [])
        assert {d.source_topic: d.table for d in datasets}["prod.orders"] == "ORDERS"

    def test_discovered_topics_keep_their_order_and_mapped_only_topics_follow(self):
        """Several assertions elsewhere pin the exact dataset order for discovered topics, so
        the recovered mappings are appended rather than interleaved."""
        config = dict(
            BASE_SNOWFLAKE_CONFIG,
            **{"snowflake.topic2table.map": "prod.orders:ORDERS,order_events_flat:FLAT,prod.items:ITEMS"},
        )
        datasets = get_resolver("SnowflakeSink").resolve_datasets(config, [])
        assert [d.source_topic for d in datasets] == [
            "order_events_flat",
            "om-lineage-test",
            "prod.orders",
            "prod.items",
        ]
        assert [d.table for d in datasets] == ["FLAT", "OM_LINEAGE_TEST_702890019", "ORDERS", "ITEMS"]

    def test_a_mapped_only_topic_is_qualified_like_every_other_dataset(self):
        """Without database/schema and fully_qualified the recovered dataset reaches Priority 1
        with an unusable FQN, so recovering it would buy no lineage."""
        config = dict(BASE_SNOWFLAKE_CONFIG, **{"snowflake.topic2table.map": "prod.orders:ORDERS"})
        dataset = next(
            d for d in get_resolver("SnowflakeSink").resolve_datasets(config, []) if d.source_topic == "prod.orders"
        )
        assert (dataset.database, dataset.schema) == ("EVENT_LANDING", "PUBLIC")
        assert dataset.fully_qualified is True

    def test_a_mapped_only_topic_is_recovered_alongside_a_discovered_topic_list(self):
        """The reported case: the connector subscribes by regex, only some concrete topics get
        discovered, and the map names the rest."""
        config = dict(BASE_SNOWFLAKE_CONFIG, **{"snowflake.topic2table.map": "prod.orders:ORDERS"})
        datasets = get_resolver("SnowflakeSink").resolve_datasets(config, [KafkaConnectTopics(name="prod.items")])
        assert [d.source_topic for d in datasets] == ["prod.items", "prod.orders"]

    def test_recovering_mapped_topics_is_logged(self, caplog):
        config = dict(BASE_SNOWFLAKE_CONFIG, **{"snowflake.topic2table.map": "prod.orders:ORDERS"})
        with caplog.at_level(logging.INFO):
            get_resolver("SnowflakeSink").resolve_datasets(config, [])
        combined = " ".join(record.message for record in caplog.records)
        assert "prod.orders" in combined
        assert "snowflake.topic2table.map" in combined

    def test_a_map_naming_only_discovered_topics_adds_nothing(self):
        config = dict(BASE_SNOWFLAKE_CONFIG, **{"snowflake.topic2table.map": "order_events_flat:ORDERS"})
        datasets = get_resolver("SnowflakeSink").resolve_datasets(config, [])
        assert [d.source_topic for d in datasets] == ["order_events_flat", "om-lineage-test"]


# A topics.regex subscription whose concrete topics were never discovered: no `topics` key,
# and get_connector_topics answered nothing. The map is then the only thing naming the tables.
REGEX_SUBSCRIPTION_CONFIG = {
    **{k: v for k, v in BASE_SNOWFLAKE_CONFIG.items() if k != "topics"},
    "topics.regex": "prod\\..*",
    "snowflake.topic2table.map": "prod.orders:ORDERS,prod.items:ITEMS",
}


class TestMappedTopicsSurviveAnEmptyTopicList:
    """The near-miss of the case above: with *no* topic discovered at all, resolution took the
    early-return branch and handed the config to DefaultResolver, which reads the map only for
    its table names and cannot pair them back to a topic. The datasets it returns carry no
    source_topic, so match_topic can only succeed where a topic happens to be named after its
    table -- which is exactly what topic2table.map exists to say is not the case."""

    def test_datasets_are_built_from_the_map_alone(self):
        datasets = get_resolver("SnowflakeSink").resolve_datasets(REGEX_SUBSCRIPTION_CONFIG, [])
        assert {d.source_topic: d.table for d in datasets} == {"prod.orders": "ORDERS", "prod.items": "ITEMS"}

    def test_the_topic_pairing_survives(self):
        """Without source_topic the dataset is dropped before an edge is built, so recovering
        the table name alone would buy no lineage."""
        datasets = get_resolver("SnowflakeSink").resolve_datasets(REGEX_SUBSCRIPTION_CONFIG, [])
        topic_entity = object()
        matched = get_resolver("SnowflakeSink").match_topic(
            datasets[0], {"prod.orders": topic_entity}, REGEX_SUBSCRIPTION_CONFIG
        )
        assert matched is topic_entity

    def test_datasets_stay_qualified(self):
        datasets = get_resolver("SnowflakeSink").resolve_datasets(REGEX_SUBSCRIPTION_CONFIG, [])
        assert all(d.fully_qualified for d in datasets)
        assert {(d.database, d.schema) for d in datasets} == {("EVENT_LANDING", "PUBLIC")}

    def test_no_topics_and_no_map_still_falls_back_to_the_key_list(self):
        """The fallback must stay reachable: a self-managed sink naming its target through the
        generic config keys had lineage before this resolver existed and must keep it."""
        config = {k: v for k, v in REGEX_SUBSCRIPTION_CONFIG.items() if k != "snowflake.topic2table.map"}
        with patch.object(DefaultResolver, "resolve_datasets", return_value=[]) as delegated:
            get_resolver("SnowflakeSink").resolve_datasets(config, [])
        delegated.assert_called_once()


LITERAL_MAP_CONFIG = dict(BASE_SNOWFLAKE_CONFIG, **{"snowflake.topic2table.map": "prod.orders:ORDERS"})


class TestLiteralMapKeysAreNotTreatedAsSelectors:
    """A metachar-free topic2table.map key names one topic; `_with_mapped_topics` already reads it
    that way, deliberately allowing the dots that are ordinary in Kafka topic names. Handing the
    same key to a regex compiler made those dots wildcards, so `prod.orders` fullmatched a real
    `prodXorders` -- first pulling that topic into discovery, then claiming it in `_mapped_table`
    -- and minted lineage into ORDERS for a topic the connector never consumes."""

    def test_a_literal_key_reaches_the_topic_search_escaped(self):
        (pattern,) = get_resolver("SnowflakeSink").topic_patterns(LITERAL_MAP_CONFIG)
        assert re.fullmatch(pattern, "prod.orders")
        assert not re.fullmatch(pattern, "prodXorders")

    def test_a_regex_key_still_reaches_the_topic_search_intact(self):
        config = dict(BASE_SNOWFLAKE_CONFIG, **{"snowflake.topic2table.map": ".*_cat:CAT_TABLE"})
        assert get_resolver("SnowflakeSink").topic_patterns(config) == [".*_cat"]

    def test_a_topic_a_literal_key_only_matches_as_regex_derives_its_own_table(self):
        """The second half of the same defect: even a topic discovered by the `topics` list --
        never by the map -- was captured by the regex fallback in `_mapped_table`."""
        config = dict(LITERAL_MAP_CONFIG, topics="prod.orders,prodXorders")
        datasets = get_resolver("SnowflakeSink").resolve_datasets(config, [])
        assert [(dataset.source_topic, dataset.table) for dataset in datasets] == [
            ("prod.orders", "ORDERS"),
            ("prodXorders", "PRODXORDERS"),
        ]

    def test_escaping_does_not_cost_the_literal_key_its_own_dataset(self):
        """Escaping must narrow the match, not drop the mapping: the key still names a topic."""
        datasets = get_resolver("SnowflakeSink").resolve_datasets(LITERAL_MAP_CONFIG, [])
        assert {d.source_topic: d.table for d in datasets}["prod.orders"] == "ORDERS"


SELF_MANAGED_SNOWFLAKE_CLASS = "com.snowflake.kafka.connector.SnowflakeSinkConnector"

# A self-managed sink using the shorter key variations (both are listed in
# ConnectorConfigKeys.SNOWFLAKE_DATABASE_KEYS / _SCHEMA_KEYS, so the key-list search read them).
SELF_MANAGED_VARIATION_CONFIG = {
    "connector.class": SELF_MANAGED_SNOWFLAKE_CLASS,
    "name": "self-managed-variations",
    "topics": "orders",
    "snowflake.database": "DB1",
    "snowflake.schema": "SCH1",
    "snowflake.topic2table.map": "orders:ORDERS_TBL",
}

# A self-managed sink subscribing by regex: no `topics` key exists to derive table names from,
# which is also what a failed /topics fetch looks like (get_connector_topics answers None).
SELF_MANAGED_REGEX_CONFIG = {
    "connector.class": SELF_MANAGED_SNOWFLAKE_CLASS,
    "name": "self-managed-regex",
    "topics.regex": r"prod\..*",
    "snowflake.database.name": "DB",
    "snowflake.schema.name": "SCH",
    "snowflake.topic2table.map": "prod.orders:ORDERS",
}


class TestSnowflakeResolverIsASupersetOfTheDefault:
    """Registering a connector class makes the generic key-list path unreachable for it, with
    no fallback, so anything DefaultResolver used to resolve has to still resolve here. Each
    test first asserts what DefaultResolver answers -- the behaviour self-managed sinks had
    before this resolver existed -- and then requires the same of the registered resolver."""

    def test_key_variations_still_populate_database_and_schema(self):
        old = DefaultResolver().resolve_datasets(SELF_MANAGED_VARIATION_CONFIG, [])
        assert [(d.table, d.database, d.schema) for d in old] == [("ORDERS_TBL", "DB1", "SCH1")]

        datasets = get_resolver(SELF_MANAGED_SNOWFLAKE_CLASS).resolve_datasets(SELF_MANAGED_VARIATION_CONFIG, [])
        assert [(d.table, d.database, d.schema) for d in datasets] == [("ORDERS_TBL", "DB1", "SCH1")]
        # Losing database/schema also loses fully_qualified, which drops the four-part FQN and
        # with it the Priority-1 table lookup, so lineage vanishes even though a table was named.
        assert datasets[0].fully_qualified is True
        assert datasets[0].source_topic == "orders"

    def test_the_documented_key_wins_when_both_forms_are_present(self):
        """Precedence matches the key-list order: the `.name` form is consulted first."""
        config = dict(BASE_SNOWFLAKE_CONFIG, **{"snowflake.database": "IGNORED", "snowflake.schema": "IGNORED"})
        dataset = get_resolver("SnowflakeSink").resolve_datasets(config, [])[0]
        assert (dataset.database, dataset.schema) == ("EVENT_LANDING", "PUBLIC")

    def test_topics_regex_still_yields_the_mapped_table(self):
        old = DefaultResolver().resolve_datasets(SELF_MANAGED_REGEX_CONFIG, [])
        assert [(d.table, d.database, d.schema) for d in old] == [("ORDERS", "DB", "SCH")]

        datasets = get_resolver(SELF_MANAGED_SNOWFLAKE_CLASS).resolve_datasets(SELF_MANAGED_REGEX_CONFIG, [])
        assert [(d.table, d.database, d.schema) for d in datasets] == [("ORDERS", "DB", "SCH")]
        # The map pairs the table back to its topic, which DefaultResolver's key-list read
        # cannot do -- and without that pairing match_topic has nothing exact to match on.
        assert datasets[0].source_topic == "prod.orders"

    def test_match_topic_falls_back_for_a_dataset_without_a_source_topic(self):
        """A config naming its table through the generic keys, with no topic list and no map,
        still takes the DefaultResolver fallback, so its datasets carry no source_topic. The
        resolver's match_topic must fall back too, or those datasets yield no edge at all."""
        config = {k: v for k, v in SELF_MANAGED_REGEX_CONFIG.items() if k != "snowflake.topic2table.map"}
        config["table.name.format"] = "ORDERS"
        resolver = get_resolver(SELF_MANAGED_SNOWFLAKE_CLASS)
        dataset = resolver.resolve_datasets(config, [])[0]
        assert dataset.source_topic is None
        topic_map = {"ORDERS": "<topic>"}
        assert resolver.match_topic(dataset, topic_map, config) == "<topic>"
        assert resolver.match_topic(dataset, topic_map, config) == DefaultResolver().match_topic(
            dataset, topic_map, config
        )

    def test_a_config_naming_neither_topics_nor_tables_still_yields_nothing(self):
        config = {"connector.class": "SnowflakeSink", "name": "empty"}
        assert get_resolver("SnowflakeSink").resolve_datasets(config, []) == []


class TestPackageImportRegistersTheResolvers:
    """Production reaches the resolvers through the `sinks` package, so both Snowflake keys are
    registered by the side-effect import in `sinks/__init__.py`. This test module imports
    `sinks.snowflake` directly at module scope and the registry is a module global, so every
    other assertion here passes even with that import removed -- while production would
    silently degrade to DefaultResolver and emit zero datasets. Only a fresh interpreter that
    imports the package alone can observe the registration."""

    @pytest.mark.parametrize("connector_class", ["SnowflakeSink", SELF_MANAGED_SNOWFLAKE_CLASS])
    def test_importing_only_the_package_registers_snowflake(self, connector_class):
        # Point the child at the same src tree this process imported: the venv also holds a
        # stale non-editable copy of `metadata` that would otherwise win.
        src_root = Path(metadata.__file__).resolve().parents[1]
        script = (
            "from metadata.ingestion.source.pipeline.kafkaconnect.sinks import get_resolver\n"
            f"resolver = get_resolver({connector_class!r})\n"
            "name = type(resolver).__name__\n"
            "assert name == 'SnowflakeSinkResolver', f'package import resolved {name}'\n"
        )
        result = subprocess.run(
            [sys.executable, "-c", script],
            capture_output=True,
            text=True,
            check=False,
            env={**os.environ, "PYTHONPATH": str(src_root)},
        )
        assert result.returncode == 0, f"{result.stdout}\n{result.stderr}"


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

    @staticmethod
    def _expand_selectors(config, available_topic_names):
        """Run the real discovery step against a messaging service holding `available_topic_names`,
        then resolve datasets from whatever it found -- the two halves of the sink path."""
        source = _new_source()
        source._topics_cache = {}
        source.metadata = MagicMock()
        available_topics = [
            Topic(
                id=uuid.uuid4(),
                name=name,
                fullyQualifiedName=FullyQualifiedEntityName(f"kafka.{name}"),
                partitions=1,
                service={"id": uuid.uuid4(), "type": "messagingService"},
            )
            for name in available_topic_names
        ]
        source.metadata.list_all_entities.return_value = available_topics
        source.metadata.get_by_name.side_effect = lambda **kwargs: next(
            (topic for topic in available_topics if model_str(topic.fullyQualifiedName) == kwargs["fqn"]), None
        )
        details = KafkaConnectPipelineDetails(name="snowflake", type="sink", config=config)
        resolver = source._resolver_for(details)

        result = source._parse_and_resolve_topics(
            pipeline_details=details,
            database_server_name=None,
            effective_messaging_service="kafka",
            is_storage_sink=False,
            sink_resolver=resolver,
        )
        return result, resolver.resolve_datasets(config, result.topics)

    def test_snowflake_selectors_are_expanded_before_dataset_resolution(self):
        config = {
            **BASE_SNOWFLAKE_CONFIG,
            "topics.regex": ".*_cat",
            "snowflake.topic2table.map": ".*_cat:CAT_TABLE",
        }
        config.pop("topics")

        result, datasets = self._expand_selectors(config, ("orange_cat", "blue_dog"))

        assert list(result.topic_entity_map) == ["orange_cat"]
        assert [(dataset.source_topic, dataset.table) for dataset in datasets] == [("orange_cat", "CAT_TABLE")]

    def test_a_literal_map_key_does_not_discover_topics_its_dots_would_match(self):
        """End-to-end through the discovery step the escaping exists to protect: a real
        `prodXorders` sitting in the same messaging service must not be pulled in by the
        `prod.orders` mapping, nor handed that mapping's table."""
        config = {
            **BASE_SNOWFLAKE_CONFIG,
            "topics.regex": "nothing_matches_this",
            "snowflake.topic2table.map": "prod.orders:ORDERS",
        }
        config.pop("topics")

        result, datasets = self._expand_selectors(config, ("prod.orders", "prodXorders"))

        assert list(result.topic_entity_map) == ["prod.orders"]
        assert [(dataset.source_topic, dataset.table) for dataset in datasets] == [("prod.orders", "ORDERS")]

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

    def test_current_self_managed_class_maps_to_snowflake(self):
        assert CONNECTOR_CLASS_TO_SERVICE_TYPE["SnowflakeStreamingSinkConnector"] == "Snowflake"

    def test_snowflake_hostname_key_is_url_name(self):
        assert "snowflake.url.name" in SERVICE_TYPE_HOSTNAME_KEYS["Snowflake"]

    def test_url_with_leading_whitespace_is_stripped(self):
        """Observed live: the Confluent UI stored the URL with a leading space, as
        '<account>.snowflakecomputing.com' (account anonymised here)."""
        extracted = KafkaconnectSource._extract_hostname(None, " EXAMPLE1-AB00000.snowflakecomputing.com")
        assert extracted == "EXAMPLE1-AB00000.snowflakecomputing.com"


# Observed live: Confluent reports "<account>.snowflakecomputing.com" (with a leading
# space, as the UI stored it) while the OpenMetadata service holds the bare account.
# The shape is what was captured; the account identifier itself is anonymised.
LIVE_SNOWFLAKE_URL = " EXAMPLE1-AB00000.snowflakecomputing.com"
LIVE_SNOWFLAKE_ACCOUNT = "EXAMPLE1-AB00000"


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
        source = _source_with_services([_snowflake_service(account="example1-ab00000")])
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


def _priority_one_fqn_kwargs(dataset, pipeline_details, supports_database=None) -> dict:
    """The keyword arguments Priority 1 of ``_get_table_entity`` passes to ``fqn.build``.

    ``supports_database`` stands in for the target service's class as
    ``_service_supports_database`` reports it: None when the service cannot be resolved
    (the wildcard case), True for a multi-database service, False for a single-database
    one. It is stubbed rather than derived so each test states the class it is about.
    """
    captured = []
    source = _new_source()
    source.metadata = MagicMock()
    # A miss on every lookup keeps all three priorities reachable, so captured[0]
    # is unambiguously the Priority 1 call.
    source.metadata.get_by_name.return_value = None
    source.metadata.search_in_any_service.return_value = None

    def fake_fqn_build(metadata=None, entity_type=None, **kwargs):
        captured.append(kwargs)
        return

    with (
        patch.object(
            KafkaconnectSource,
            "get_service_from_connector_config",
            return_value=MagicMock(database_service_name="matched_service"),
        ),
        patch.object(KafkaconnectSource, "get_db_service_names", return_value=[]),
        patch.object(KafkaconnectSource, "_service_supports_database", return_value=supports_database),
        patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.metadata.fqn.build",
            side_effect=fake_fqn_build,
        ),
    ):
        source._get_table_entity(pipeline_details, dataset)

    assert captured, "expected at least one fqn.build call"
    return captured[0]


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

    def test_qualified_dataset_builds_four_part_fqn(self):
        kwargs = _priority_one_fqn_kwargs(
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

    def test_qualified_dataset_with_no_schema_keeps_the_database_slot(self):
        """A Snowflake sink that names only snowflake.database.name is still qualified:
        the database slot must hold the database and the schema slot must stay empty for
        fqn.build to resolve it by search. This is the case the shared CDC rule gets
        wrong -- with `fully_qualified` ignored, `schema or database` slides the database
        into the schema slot and builds an FQN that names a database as a schema."""
        kwargs = _priority_one_fqn_kwargs(
            KafkaConnectDatasetDetails(
                table="ORDER_EVENTS_FLAT",
                database="EVENT_LANDING",
                source_topic="order_events_flat",
                fully_qualified=True,
            ),
            KafkaConnectPipelineDetails(name="s", type="sink", config=BASE_SNOWFLAKE_CONFIG),
        )
        assert kwargs["database_name"] == "EVENT_LANDING"
        assert kwargs["schema_name"] is None
        assert kwargs["table_name"] == "ORDER_EVENTS_FLAT"

    def test_unqualified_cdc_dataset_keeps_three_part_fqn(self):
        """Debezium's 'database' is the logical server name (topic.prefix), not a real
        database, so with no schema parsed it belongs in the schema slot with the
        database slot left empty."""
        kwargs = _priority_one_fqn_kwargs(
            KafkaConnectDatasetDetails(table="orders", database="inventory", fully_qualified=False),
            CDC_PIPELINE_DETAILS,
        )
        assert kwargs["database_name"] is None
        assert kwargs["schema_name"] == "inventory"
        assert kwargs["table_name"] == "orders"

    def test_unqualified_cdc_dataset_on_single_database_service_drops_the_database(self):
        """MySQL/ClickHouse ingest under a synthetic 'default' database, so a Debezium
        "database" there is only ever topic.prefix and constraining by it guarantees a
        miss. table.include.list is what reliably reports the schema."""
        kwargs = _priority_one_fqn_kwargs(
            KafkaConnectDatasetDetails(
                table="orders",
                database="inventory",
                schema="public",
                fully_qualified=False,
            ),
            CDC_PIPELINE_DETAILS,
            supports_database=False,
        )
        assert kwargs["database_name"] is None
        assert kwargs["schema_name"] == "public"
        assert kwargs["table_name"] == "orders"

    def test_unqualified_cdc_dataset_on_multi_database_service_tries_the_database_first(self):
        """On Postgres and friends `database` may be a real database.dbname, and a schema
        name like 'public' repeats across databases in one service -- so the qualified
        shape is tried first rather than assumed to be a topic.prefix."""
        kwargs = _priority_one_fqn_kwargs(
            KafkaConnectDatasetDetails(
                table="orders",
                database="inventory",
                schema="public",
                fully_qualified=False,
            ),
            CDC_PIPELINE_DETAILS,
            supports_database=True,
        )
        assert kwargs["database_name"] == "inventory"
        assert kwargs["schema_name"] == "public"
        assert kwargs["table_name"] == "orders"


class TestUnresolvableTableDiagnostics:
    def test_warning_names_db_service_names_setting(self, caplog):
        source = _new_source()
        source.metadata = MagicMock()
        source.metadata.get_by_name.return_value = None
        source.metadata.search_in_any_service.return_value = None

        dataset = KafkaConnectDatasetDetails(
            table="ORDER_EVENTS_FLAT",
            database="EXAMPLE_DB",
            schema="EXAMPLE_SCHEMA",
            source_topic="order_events_flat",
            fully_qualified=True,
        )
        with (
            patch.object(
                KafkaconnectSource,
                "get_service_from_connector_config",
                return_value=MagicMock(database_service_name=None),
            ),
            patch.object(KafkaconnectSource, "get_db_service_names", return_value=[]),
            patch.object(KafkaconnectSource, "_service_supports_database", return_value=None),
            caplog.at_level(logging.WARNING),
        ):
            source.get_dataset_entity(
                KafkaConnectPipelineDetails(name="s", type="sink", config=BASE_SNOWFLAKE_CONFIG),
                dataset,
            )

        combined = " ".join(record.message for record in caplog.records)
        assert "dbServiceNames" in combined
        assert "ORDER_EVENTS_FLAT" in combined


# The shape of a real GET /connect/v1/environments/{env}/connectors/{name} response, captured
# verbatim: the exact key set, secrets rendered as fixed-width masks rather than omitted, the
# leading space Confluent stores in snowflake.url.name, and the absence of every defaulted
# property (snowflake.enable.schematization, snowflake.ingestion.method). Those properties are
# what the tests below assert on; every credential, host, account and identifier is anonymised.
CAPTURED_CONFLUENT_CLOUD_RESPONSE = {
    "name": "SnowflakeSinkConnector_0",
    "type": "sink",
    "config": {
        "connector.class": "SnowflakeSink",
        "input.data.format": "AVRO",
        "kafka.api.key": "FAKEKEY123456789",
        "kafka.api.secret": "****************",
        "kafka.auth.mode": "KAFKA_API_KEY",
        "kafka.endpoint": "SASL_SSL://pkc-00000.eastus.azure.confluent.cloud:9092",
        "name": "SnowflakeSinkConnector_0",
        "snowflake.database.name": "EXAMPLE_DB",
        "snowflake.private.key": "****************",
        "snowflake.schema.name": "EXAMPLE_SCHEMA",
        "snowflake.url.name": " EXAMPLE1-AB00000.snowflakecomputing.com",
        "snowflake.user.name": "ETL_USER",
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
    client.client.get_connector.return_value = CAPTURED_CONFLUENT_CLOUD_RESPONSE
    return client


class TestConfluentCloudConfigShape:
    def test_flat_config_map_is_returned(self, monkeypatch):
        client = _confluent_cloud_client(monkeypatch)
        assert client.is_confluent_cloud is True
        config = client.get_connector_config("SnowflakeSinkConnector_0")
        assert config["connector.class"] == "SnowflakeSink"
        assert config["snowflake.database.name"] == "EXAMPLE_DB"

    def test_defaulted_properties_are_absent_not_false(self):
        """The API omits defaults, so presence checks are unsafe."""
        config = CAPTURED_CONFLUENT_CLOUD_RESPONSE["config"]
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

# The column set a live DESC TABLE returned, verbatim (database and schema anonymised).
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


# Field and column FQNs in exactly the form observed live on 2026-08-06, with the database and
# schema segments anonymised (the segment *structure* is what matters). The Avro record name
# (OrderEvent) is itself a level in the topic field FQN, so a topic field FQN is
# <messagingService>.<topic>.<recordName>.<field>.
TOPIC_FIELD_FQN_PREFIX = "confluent_kafka.order_events_nested"
TABLE_COLUMN_FQN_PREFIX = "snowflake.EXAMPLE_DB.EXAMPLE_SCHEMA.ORDER_EVENTS_NESTED"


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
    database="EXAMPLE_DB",
    schema="EXAMPLE_SCHEMA",
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
CAMEL_TABLE_COLUMN_FQN_PREFIX = "snowflake.EXAMPLE_DB.EXAMPLE_SCHEMA.CAMEL_EVENTS"


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
                database="EXAMPLE_DB",
                schema="EXAMPLE_SCHEMA",
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
        """The connector config keeps the shape of a live `GET /connectors/{name}` captured
        2026-08-05 (identifiers anonymised); the resulting lineage was re-verified live
        2026-08-06."""
        config = dict(
            CAPTURED_CONFLUENT_CLOUD_RESPONSE["config"],
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
        assert all(d.database == "EXAMPLE_DB" and d.schema == "EXAMPLE_SCHEMA" for d in datasets)
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
        # source_column is the dotted source path, not the bare leaf: see
        # TestSameNamedLeavesResolveDistinctly for why the bare name is not usable.
        assert ("address.street", "ADDRESS_STREET") in pairs
        assert ("address.city", "ADDRESS_CITY") in pairs
        assert ("address.zipcode", "ADDRESS_ZIPCODE") in pairs

    def test_flatten_leaves_top_level_fields_untouched(self):
        mappings = get_resolver("SnowflakeSink").column_mappings(FLATTEN_CONFIG, _nested_topic())
        pairs = {(m.source_column, m.target_column) for m in mappings}
        assert ("order_id", "ORDER_ID") in pairs

    def test_default_delimiter_is_a_dot(self):
        config = {k: v for k, v in FLATTEN_CONFIG.items() if k != "transforms.flatten.delimiter"}
        mappings = get_resolver("SnowflakeSink").column_mappings(config, _nested_topic())
        assert any(m.target_column == "ADDRESS.STREET" for m in mappings)

    def test_current_connector_preserves_flattened_column_case_by_default(self):
        config = dict(
            FLATTEN_CONFIG,
            **{"connector.class": "com.snowflake.kafka.connector.SnowflakeStreamingSinkConnector"},
        )
        mappings = get_resolver(config["connector.class"]).column_mappings(config, _nested_topic())
        assert any(mapping.target_column == "address_city" for mapping in mappings)

    def test_current_connector_honours_column_normalization_flag(self):
        config = dict(
            FLATTEN_CONFIG,
            **{
                "connector.class": "com.snowflake.kafka.connector.SnowflakeStreamingSinkConnector",
                "snowflake.compatibility.enable.column.identifier.normalization": "true",
            },
        )
        mappings = get_resolver(config["connector.class"]).column_mappings(config, _nested_topic())
        assert any(mapping.target_column == "ADDRESS_CITY" for mapping in mappings)

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

    def test_flatten_key_transform_is_not_applied_to_value_schema(self):
        config = dict(
            BASE_SNOWFLAKE_CONFIG,
            transforms="flatten",
            **{"transforms.flatten.type": "org.apache.kafka.connect.transforms.Flatten$Key"},
        )
        assert get_resolver("SnowflakeSink").column_mappings(config, _nested_topic()) == []

    @pytest.mark.parametrize("schema_type", [SchemaType.JSON, SchemaType.Protobuf])
    def test_non_avro_nested_fields_are_walked_directly(self, schema_type):
        topic = Topic(
            id=uuid.uuid4(),
            name="events",
            partitions=1,
            service={"id": uuid.uuid4(), "type": "messagingService"},
            messageSchema=TopicSchema(
                schemaType=schema_type,
                schemaFields=[
                    FieldModel(
                        name="Event",
                        dataType=DataTypeTopic.RECORD,
                        children=[
                            FieldModel(name="id", dataType=DataTypeTopic.STRING),
                            FieldModel(
                                name="address",
                                dataType=DataTypeTopic.RECORD,
                                children=[FieldModel(name="city", dataType=DataTypeTopic.STRING)],
                            ),
                        ],
                    )
                ],
            ),
        )
        mappings = get_resolver("SnowflakeSink").column_mappings(FLATTEN_CONFIG, topic)
        assert [(mapping.source_column, mapping.target_column) for mapping in mappings] == [
            ("id", "ID"),
            ("address.city", "ADDRESS_CITY"),
        ]

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
        assert ("address.street", "ADDRESS_STREET") in {(m.source_column, m.target_column) for m in mappings}

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
        database="EXAMPLE_DB",
        schema="EXAMPLE_SCHEMA",
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

    def test_a_missing_topic_yields_no_lineage_and_never_asks_the_resolver(self):
        """What the `matched_topic_entity is not None` half of the call-site guard actually
        buys: not crash avoidance (`column_mappings` reads messageSchema through getattr and
        answers [] for None) but not interrogating a topic that was never found, on a dataset
        whose edge is about to be skipped anyway."""
        with patch.object(SnowflakeSinkResolver, "column_mappings", autospec=True, return_value=[]) as mapper:
            _, requests = _run_sink_lineage(FLATTEN_CONFIG, None, _flattened_table_with_column_fqns())
        assert requests == []
        assert mapper.call_count == 0

    def test_an_explicit_mapping_is_not_overwritten_by_the_resolver(self):
        """The `not dataset_details.column_mappings` half of the guard. A mapping that arrived
        with the dataset is deliberate; dropping the condition lets the Flatten resolver
        replace that one edge with its own six."""
        preset = _flatten_dataset_details(
            [KafkaConnectColumnMapping(source_column="order_id", target_column="ORDER_ID")]
        )
        with patch.object(SnowflakeSinkResolver, "resolve_datasets", autospec=True, return_value=[preset]):
            edges = self._column_edges(
                FLATTEN_CONFIG,
                _with_nested_field_fqns(_nested_topic(), TOPIC_FIELD_FQN_PREFIX),
                _flattened_table_with_column_fqns(),
            )
        assert edges == {
            (
                f"{TOPIC_FIELD_FQN_PREFIX}.OrderEvent.order_id",
                f"{TABLE_COLUMN_FQN_PREFIX}.ORDER_ID",
            )
        }


def _avro_topic(topic_name: str, avro: str, prefix: str) -> Topic:
    """A Topic carrying `avro`, with field FQNs populated at every depth."""
    return _with_nested_field_fqns(
        Topic(
            id=uuid.uuid4(),
            name=topic_name,
            partitions=1,
            service={"id": uuid.uuid4(), "type": "messagingService"},
            messageSchema=TopicSchema(
                schemaText=avro,
                schemaType=SchemaType.Avro,
                schemaFields=parse_avro_schema(avro, cls=FieldModel),
            ),
        ),
        prefix,
    )


def _table_with_columns(table_name: str, column_names: list, prefix: str) -> Table:
    return Table(
        id=uuid.uuid4(),
        name=table_name,
        columns=[
            Column(
                name=name,
                dataType=DataType.VARCHAR,
                fullyQualifiedName=FullyQualifiedEntityName(f"{prefix}.{name}"),
            )
            for name in column_names
        ],
        databaseSchema={"id": uuid.uuid4(), "type": "databaseSchema"},
    )


def _flatten_edges(topic: Topic, table: Table) -> set:
    """column_mappings under the Flatten config, then straight through build_column_lineage."""
    mappings = get_resolver("SnowflakeSink").column_mappings(FLATTEN_CONFIG, topic)
    lineage = _new_source().build_column_lineage(
        from_entity=topic,
        to_entity=table,
        topic_entity=topic,
        pipeline_details=SNOWFLAKE_SINK_DETAILS,
        dataset_details=_flatten_dataset_details(mappings),
    )
    assert lineage is not None, "flattened mappings produced no edges at all"
    return {(model_str(edge.fromColumns[0]), model_str(edge.toColumn)) for edge in lineage}


# Two records under one root, each with a `city` leaf. A bare leaf name cannot distinguish
# them, so any by-name topic-field lookup hands one field to both target columns.
SIBLING_RECORDS_AVRO = json.dumps(
    {
        "type": "record",
        "name": "Root3",
        "fields": [
            {
                "name": "shipping",
                "type": {
                    "type": "record",
                    "name": "ShipAddr",
                    "fields": [{"name": "city", "type": "string"}],
                },
            },
            {
                "name": "billing",
                "type": {
                    "type": "record",
                    "name": "BillAddr",
                    "fields": [{"name": "city", "type": "string"}],
                },
            },
        ],
    }
)

# A nested leaf shadowing a top-level field of the same name.
SHADOWED_LEAF_AVRO = json.dumps(
    {
        "type": "record",
        "name": "Root7",
        "fields": [
            {"name": "city", "type": "string"},
            {
                "name": "address",
                "type": {
                    "type": "record",
                    "name": "Addr7",
                    "fields": [{"name": "city", "type": "string"}],
                },
            },
        ],
    }
)

SIBLING_TOPIC_PREFIX = "confluent_kafka.sibling_events"
SIBLING_TABLE_PREFIX = "snowflake.EXAMPLE_DB.EXAMPLE_SCHEMA.SIBLING_EVENTS"


class TestSameNamedLeavesResolveDistinctly:
    """Leaf names are not unique. `source_column` therefore carries the dotted source path and
    the topic-field lookup walks it, because a by-name search over either schema below has to
    pick one field and would publish it as the upstream of every column sharing the name --
    a wrong edge, which is worse than no edge."""

    def test_sibling_records_keep_their_own_city(self):
        topic = _avro_topic("sibling_events", SIBLING_RECORDS_AVRO, SIBLING_TOPIC_PREFIX)
        mappings = get_resolver("SnowflakeSink").column_mappings(FLATTEN_CONFIG, topic)
        assert [(m.source_column, m.target_column) for m in mappings] == [
            ("shipping.city", "SHIPPING_CITY"),
            ("billing.city", "BILLING_CITY"),
        ]
        table = _table_with_columns("SIBLING_EVENTS", ["SHIPPING_CITY", "BILLING_CITY"], SIBLING_TABLE_PREFIX)
        assert _flatten_edges(topic, table) == {
            (
                f"{SIBLING_TOPIC_PREFIX}.Root3.shipping.ShipAddr.city",
                f"{SIBLING_TABLE_PREFIX}.SHIPPING_CITY",
            ),
            (
                f"{SIBLING_TOPIC_PREFIX}.Root3.billing.BillAddr.city",
                f"{SIBLING_TABLE_PREFIX}.BILLING_CITY",
            ),
        }

    def test_a_nested_leaf_does_not_borrow_the_top_level_field_of_the_same_name(self):
        topic = _avro_topic("shadow_events", SHADOWED_LEAF_AVRO, SIBLING_TOPIC_PREFIX)
        mappings = get_resolver("SnowflakeSink").column_mappings(FLATTEN_CONFIG, topic)
        assert [(m.source_column, m.target_column) for m in mappings] == [
            ("city", "CITY"),
            ("address.city", "ADDRESS_CITY"),
        ]
        table = _table_with_columns("SHADOW_EVENTS", ["CITY", "ADDRESS_CITY"], SIBLING_TABLE_PREFIX)
        assert _flatten_edges(topic, table) == {
            (
                f"{SIBLING_TOPIC_PREFIX}.Root7.city",
                f"{SIBLING_TABLE_PREFIX}.CITY",
            ),
            (
                f"{SIBLING_TOPIC_PREFIX}.Root7.address.Addr7.city",
                f"{SIBLING_TABLE_PREFIX}.ADDRESS_CITY",
            ),
        }


# Flatten recurses into STRUCT only. `items` is copied through whole and lands as one VARIANT
# column; `tags` (MAP) likewise. `maybe` is a nullable record -- a STRUCT at runtime -- so it
# does flatten. `optional_items` is the same array as `items` declared the ordinary Avro way
# for an optional field: the parser types it UNION and hangs the item record off it, so only
# its display type still says array.
COLLECTIONS_AVRO = json.dumps(
    {
        "type": "record",
        "name": "Order",
        "fields": [
            {"name": "order_id", "type": "string"},
            {
                "name": "items",
                "type": {
                    "type": "array",
                    "items": {
                        "type": "record",
                        "name": "Item",
                        "fields": [{"name": "sku", "type": "string"}],
                    },
                },
            },
            {
                "name": "optional_items",
                "type": [
                    "null",
                    {
                        "type": "array",
                        "items": {
                            "type": "record",
                            "name": "OptionalItem",
                            "fields": [{"name": "sku", "type": "string"}],
                        },
                    },
                ],
            },
            {"name": "tags", "type": {"type": "map", "values": "string"}},
            {
                "name": "maybe",
                "type": [
                    "null",
                    {
                        "type": "record",
                        "name": "Maybe",
                        "fields": [{"name": "m", "type": "string"}],
                    },
                ],
            },
        ],
    }
)


class TestFlattenMatchesKafkaFlattenSemantics:
    @pytest.mark.parametrize("field", ["ITEMS", "OPTIONAL_ITEMS"])
    def test_an_array_of_records_is_one_column_and_is_not_descended_into(self, field):
        """Descending would emit <FIELD>_SKU, which matches no Snowflake column, and would omit
        <FIELD> -- losing a real edge, because a non-empty mapping list switches off the 1:1
        inference that would otherwise have covered it."""
        topic = _avro_topic("collection_events", COLLECTIONS_AVRO, SIBLING_TOPIC_PREFIX)
        targets = [m.target_column for m in get_resolver("SnowflakeSink").column_mappings(FLATTEN_CONFIG, topic)]
        assert field in targets
        assert f"{field}_SKU" not in targets

    def test_map_stays_one_column_and_nullable_records_still_flatten(self):
        topic = _avro_topic("collection_events", COLLECTIONS_AVRO, SIBLING_TOPIC_PREFIX)
        mappings = get_resolver("SnowflakeSink").column_mappings(FLATTEN_CONFIG, topic)
        assert [(m.source_column, m.target_column) for m in mappings] == [
            ("order_id", "ORDER_ID"),
            ("items", "ITEMS"),
            ("optional_items", "OPTIONAL_ITEMS"),
            ("tags", "TAGS"),
            ("maybe.m", "MAYBE_M"),
        ]

    @pytest.mark.parametrize("field", ["items", "optional_items"])
    def test_the_array_column_keeps_its_lineage_edge(self, field):
        topic = _avro_topic("collection_events", COLLECTIONS_AVRO, SIBLING_TOPIC_PREFIX)
        table = _table_with_columns(
            "COLLECTION_EVENTS",
            ["ORDER_ID", "ITEMS", "OPTIONAL_ITEMS", "TAGS", "MAYBE_M"],
            SIBLING_TABLE_PREFIX,
        )
        assert (
            f"{SIBLING_TOPIC_PREFIX}.Order.{field}",
            f"{SIBLING_TABLE_PREFIX}.{field.upper()}",
        ) in _flatten_edges(topic, table)


CDC_TOPIC_FQN_PREFIX = "confluent_kafka.inventory.public.orders"


def _debezium_envelope_topic() -> Topic:
    """A Debezium envelope with `before` AND `after` both populated, `before` declared first so
    declaration order is adversarial. The legacy CDC fixture leaves both `children = None`, so
    the after-over-before preference in `_get_topic_field_fqn` has no other coverage."""

    def column(name: str, parent_fqn: str) -> FieldModel:
        return FieldModel(
            name=name,
            dataType=DataTypeTopic.STRING,
            fullyQualifiedName=FullyQualifiedEntityName(f"{parent_fqn}.{name}"),
        )

    envelope_fqn = f"{CDC_TOPIC_FQN_PREFIX}.Envelope"
    before_fqn = f"{envelope_fqn}.before"
    after_fqn = f"{envelope_fqn}.after"
    envelope = FieldModel(
        name="Envelope",
        dataType=DataTypeTopic.RECORD,
        fullyQualifiedName=FullyQualifiedEntityName(envelope_fqn),
        children=[
            FieldModel(
                name="before",
                dataType=DataTypeTopic.RECORD,
                fullyQualifiedName=FullyQualifiedEntityName(before_fqn),
                children=[column("id", before_fqn), column("name", before_fqn)],
            ),
            FieldModel(
                name="after",
                dataType=DataTypeTopic.RECORD,
                fullyQualifiedName=FullyQualifiedEntityName(after_fqn),
                children=[column("id", after_fqn), column("name", after_fqn)],
            ),
            FieldModel(
                name="op",
                dataType=DataTypeTopic.STRING,
                fullyQualifiedName=FullyQualifiedEntityName(f"{envelope_fqn}.op"),
            ),
        ],
    )
    return Topic(
        id=uuid.uuid4(),
        name="inventory.public.orders",
        partitions=1,
        service={"id": uuid.uuid4(), "type": "messagingService"},
        messageSchema=TopicSchema(schemaType=SchemaType.Avro, schemaFields=[envelope]),
    )


def _debezium_envelope_topic_with_type_levels() -> Topic:
    """The same envelope as the Avro parser really emits it: a type-named level (`Value`) sits
    between before/after and the row's columns, putting the columns at depth four. `before`
    comes first, so any name-only descent that does not encode the after preference reports the
    pre-image as the upstream of every column."""

    def value_level(parent_fqn: str) -> FieldModel:
        value_fqn = f"{parent_fqn}.Value"
        return FieldModel(
            name="Value",
            dataType=DataTypeTopic.RECORD,
            fullyQualifiedName=FullyQualifiedEntityName(value_fqn),
            children=[
                FieldModel(
                    name=name,
                    dataType=DataTypeTopic.STRING,
                    fullyQualifiedName=FullyQualifiedEntityName(f"{value_fqn}.{name}"),
                )
                for name in ("id", "name")
            ],
        )

    envelope_fqn = f"{CDC_TOPIC_FQN_PREFIX}.Envelope"
    envelope = FieldModel(
        name="Envelope",
        dataType=DataTypeTopic.RECORD,
        fullyQualifiedName=FullyQualifiedEntityName(envelope_fqn),
        children=[
            FieldModel(
                name=image,
                dataType=DataTypeTopic.RECORD,
                fullyQualifiedName=FullyQualifiedEntityName(f"{envelope_fqn}.{image}"),
                children=[value_level(f"{envelope_fqn}.{image}")],
            )
            for image in ("before", "after")
        ],
    )
    return Topic(
        id=uuid.uuid4(),
        name="inventory.public.orders",
        partitions=1,
        service={"id": uuid.uuid4(), "type": "messagingService"},
        messageSchema=TopicSchema(schemaType=SchemaType.Avro, schemaFields=[envelope]),
    )


class TestCdcFieldResolutionIsUnchanged:
    """`_get_topic_field_fqn` prefers the post-image when a Debezium envelope carries both."""

    def test_a_bare_name_never_resolves_to_the_pre_image(self):
        """With the columns at depth four a bare name is genuinely ambiguous between the two
        images, so the only acceptable answers are the post-image or nothing resolvable. Naming
        the pre-image as a column's upstream would invert the direction of the change."""
        topic = _debezium_envelope_topic_with_type_levels()
        resolved = _new_source()._get_topic_field_fqn(topic, "id")
        assert resolved != f"{CDC_TOPIC_FQN_PREFIX}.Envelope.before.Value.id"

    def test_a_path_addresses_either_image_exactly_at_depth_four(self):
        topic = _debezium_envelope_topic_with_type_levels()
        source = _new_source()
        assert source._get_topic_field_fqn(topic, "after.id") == f"{CDC_TOPIC_FQN_PREFIX}.Envelope.after.Value.id"
        assert source._get_topic_field_fqn(topic, "before.id") == f"{CDC_TOPIC_FQN_PREFIX}.Envelope.before.Value.id"

    def test_a_bare_column_name_resolves_to_the_after_image(self):
        topic = _debezium_envelope_topic()
        assert _new_source()._get_topic_field_fqn(topic, "id") == f"{CDC_TOPIC_FQN_PREFIX}.Envelope.after.id"

    def test_an_explicit_path_can_still_address_the_before_image(self):
        """The dotted-path form is exact, so it reaches either image on request rather than
        depending on the after-over-before default."""
        topic = _debezium_envelope_topic()
        assert _new_source()._get_topic_field_fqn(topic, "before.id") == f"{CDC_TOPIC_FQN_PREFIX}.Envelope.before.id"
        assert _new_source()._get_topic_field_fqn(topic, "after.id") == f"{CDC_TOPIC_FQN_PREFIX}.Envelope.after.id"


class TestDebugHostnameDiagnostic:
    """Task 10: the NOT FOUND summary line hardcoded three CDC/JDBC-style config keys and
    never consulted SERVICE_TYPE_HOSTNAME_KEYS, so a managed Snowflake sink -- whose host
    lives under `snowflake.url.name` -- always reported 'hostname: NOT SET' even though the
    connector plainly declared one (observed live, with a leading space from the Confluent
    UI). That misleads support triage into thinking the connector never set a host."""

    def test_snowflake_sink_not_found_summary_reports_real_hostname(self):
        """End-to-end through yield_pipeline_lineage_details with the table intentionally
        unresolvable, exercising the exact summary line a support engineer would read."""
        source = _new_source()
        source._topics_cache = {}
        source.lineage_results = []
        source._database_services_cache = []  # no service can match -> "no service matched" branch
        source._messaging_services_cache = []
        source.context = MagicMock()
        source.context.get.return_value = SimpleNamespace(
            pipeline_service="KafkaConnectSvc", pipeline="SnowflakeSinkConnector_0"
        )
        source._resolve_messaging_service = lambda pipeline_details: None
        source.get_dataset_entity = lambda **kwargs: None  # table never resolves

        pipeline_entity = SimpleNamespace(id=SimpleNamespace(root=uuid.uuid4()))

        def _get_by_name(entity=None, fqn=None, **kwargs):
            return pipeline_entity if getattr(entity, "__name__", "") == "Pipeline" else None

        source.metadata = MagicMock()
        source.metadata.get_by_name.side_effect = _get_by_name
        source.metadata.search_in_any_service.return_value = None

        details = KafkaConnectPipelineDetails(
            name="SnowflakeSinkConnector_0",
            type="sink",
            config=CAPTURED_CONFLUENT_CLOUD_RESPONSE["config"],
        )

        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.metadata.fqn.build",
            return_value=None,
        ):
            list(source.yield_pipeline_lineage_details(details))

        assert source.lineage_results, "expected at least one lineage result entry"
        table_fqn = source.lineage_results[0]["table_fqn"]
        assert "NOT SET" not in table_fqn
        assert "hostname: EXAMPLE1-AB00000.snowflakecomputing.com" in table_fqn

    def test_cdc_style_connector_falls_back_to_database_hostname(self):
        """A connector class absent from CONNECTOR_CLASS_TO_SERVICE_TYPE (or a service type
        absent from SERVICE_TYPE_HOSTNAME_KEYS) must still surface its host via the legacy
        `database.hostname`/`database.server`/`connection.host` keys -- the fix must not
        regress connectors that are only ever matched by those."""
        details = KafkaConnectPipelineDetails(
            name="cdc",
            type="source",
            config={
                "connector.class": "SomeUnmappedCdcSource",
                "database.hostname": "cdc.example.com",
                "table.name.format": "orders",
            },
        )
        assert _new_source()._debug_hostname(details) == "cdc.example.com"
