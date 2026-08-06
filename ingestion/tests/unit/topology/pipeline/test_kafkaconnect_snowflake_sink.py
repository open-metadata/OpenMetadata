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

import pytest

from metadata.ingestion.source.pipeline.kafkaconnect.models import (
    KafkaConnectDatasetDetails,
)
from metadata.ingestion.source.pipeline.kafkaconnect.sinks import (
    DefaultResolver,
    get_resolver,
)
from metadata.ingestion.source.pipeline.kafkaconnect.sinks.snowflake import (
    java_string_hashcode,
    snowflake_table_name,
)


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
