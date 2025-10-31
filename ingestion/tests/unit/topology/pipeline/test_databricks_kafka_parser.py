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
Unit tests for Databricks Kafka parser
"""

import unittest

from metadata.ingestion.source.pipeline.databrickspipeline.kafka_parser import (
    extract_dlt_table_dependencies,
    extract_dlt_table_names,
    extract_kafka_sources,
    get_pipeline_libraries,
)


class TestKafkaParser(unittest.TestCase):
    """Test cases for Kafka configuration parsing"""

    def test_basic_kafka_readstream(self):
        """Test basic Kafka readStream pattern"""
        source_code = """
        df = spark.readStream \\
            .format("kafka") \\
            .option("kafka.bootstrap.servers", "broker1:9092") \\
            .option("subscribe", "events_topic") \\
            .load()
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertEqual(configs[0].bootstrap_servers, "broker1:9092")
        self.assertEqual(configs[0].topics, ["events_topic"])

    def test_multiple_topics(self):
        """Test comma-separated topics"""
        source_code = """
        spark.readStream.format("kafka") \\
            .option("subscribe", "topic1,topic2,topic3") \\
            .load()
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertEqual(configs[0].topics, ["topic1", "topic2", "topic3"])

    def test_topics_option(self):
        """Test 'topics' option instead of 'subscribe'"""
        source_code = """
        df = spark.readStream.format("kafka") \\
            .option("topics", "single_topic") \\
            .load()
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertEqual(configs[0].topics, ["single_topic"])

    def test_group_id_prefix(self):
        """Test groupIdPrefix extraction"""
        source_code = """
        spark.readStream.format("kafka") \\
            .option("kafka.bootstrap.servers", "localhost:9092") \\
            .option("subscribe", "test_topic") \\
            .option("groupIdPrefix", "dlt-pipeline-123") \\
            .load()
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertEqual(configs[0].group_id_prefix, "dlt-pipeline-123")

    def test_multiple_kafka_sources(self):
        """Test multiple Kafka sources in same file"""
        source_code = """
        # First stream
        df1 = spark.readStream.format("kafka") \\
            .option("subscribe", "topic_a") \\
            .load()

        # Second stream
        df2 = spark.readStream.format("kafka") \\
            .option("subscribe", "topic_b") \\
            .load()
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 2)
        topics = [c.topics[0] for c in configs]
        self.assertIn("topic_a", topics)
        self.assertIn("topic_b", topics)

    def test_single_quotes(self):
        """Test single quotes in options"""
        source_code = """
        df = spark.readStream.format('kafka') \\
            .option('kafka.bootstrap.servers', 'broker:9092') \\
            .option('subscribe', 'my_topic') \\
            .load()
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertEqual(configs[0].bootstrap_servers, "broker:9092")
        self.assertEqual(configs[0].topics, ["my_topic"])

    def test_mixed_quotes(self):
        """Test mixed single and double quotes"""
        source_code = """
        df = spark.readStream.format("kafka") \\
            .option('subscribe', "topic_mixed") \\
            .load()
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertEqual(configs[0].topics, ["topic_mixed"])

    def test_compact_format(self):
        """Test compact single-line format"""
        source_code = """
        df = spark.readStream.format("kafka").option("subscribe", "compact_topic").load()
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertEqual(configs[0].topics, ["compact_topic"])

    def test_no_kafka_sources(self):
        """Test code with no Kafka sources"""
        source_code = """
        df = spark.read.parquet("/data/path")
        df.write.format("delta").save("/output")
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 0)

    def test_partial_kafka_config(self):
        """Test Kafka source with only topics (no brokers)"""
        source_code = """
        df = spark.readStream.format("kafka") \\
            .option("subscribe", "topic_only") \\
            .load()
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertIsNone(configs[0].bootstrap_servers)
        self.assertEqual(configs[0].topics, ["topic_only"])

    def test_malformed_kafka_incomplete(self):
        """Test incomplete Kafka configuration doesn't crash"""
        source_code = """
        df = spark.readStream.format("kafka")
        # No .load() - malformed
        """
        configs = extract_kafka_sources(source_code)
        # Should return empty list, not crash
        self.assertEqual(len(configs), 0)

    def test_special_characters_in_topic(self):
        """Test topics with special characters"""
        source_code = """
        df = spark.readStream.format("kafka") \\
            .option("subscribe", "topic-with-dashes_and_underscores.dots") \\
            .load()
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertEqual(configs[0].topics, ["topic-with-dashes_and_underscores.dots"])

    def test_whitespace_variations(self):
        """Test various whitespace patterns"""
        source_code = """
        df=spark.readStream.format(  "kafka"  ).option(  "subscribe"  ,  "topic"  ).load(  )
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertEqual(configs[0].topics, ["topic"])

    def test_case_insensitive_format(self):
        """Test case insensitive Kafka format"""
        source_code = """
        df = spark.readStream.format("KAFKA") \\
            .option("subscribe", "topic_upper") \\
            .load()
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertEqual(configs[0].topics, ["topic_upper"])

    def test_dlt_decorator_pattern(self):
        """Test DLT table decorator pattern"""
        source_code = """
        import dlt

        @dlt.table
        def bronze_events():
            return spark.readStream \\
                .format("kafka") \\
                .option("kafka.bootstrap.servers", "kafka:9092") \\
                .option("subscribe", "raw_events") \\
                .load()
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertEqual(configs[0].topics, ["raw_events"])

    def test_multiline_with_comments(self):
        """Test code with inline comments"""
        source_code = """
        df = (spark.readStream
            .format("kafka")  # Using Kafka source
            .option("kafka.bootstrap.servers", "broker:9092")  # Broker config
            .option("subscribe", "commented_topic")  # Topic name
            .load())  # Load the stream
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertEqual(configs[0].topics, ["commented_topic"])

    def test_empty_source_code(self):
        """Test empty source code"""
        configs = extract_kafka_sources("")
        self.assertEqual(len(configs), 0)

    def test_null_source_code(self):
        """Test None source code doesn't crash"""
        configs = extract_kafka_sources(None)
        self.assertEqual(len(configs), 0)

    def test_topics_with_whitespace(self):
        """Test topics with surrounding whitespace are trimmed"""
        source_code = """
        df = spark.readStream.format("kafka") \\
            .option("subscribe", " topic1 , topic2 , topic3 ") \\
            .load()
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertEqual(configs[0].topics, ["topic1", "topic2", "topic3"])

    def test_variable_topic_reference(self):
        """Test Kafka config with variable reference for topic"""
        source_code = """
        TOPIC = "events_topic"
        df = spark.readStream.format("kafka") \\
            .option("subscribe", TOPIC) \\
            .load()
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertEqual(configs[0].topics, ["events_topic"])

    def test_real_world_dlt_pattern(self):
        """Test real-world DLT pattern with variables"""
        source_code = """
        import dlt
        from pyspark.sql.functions import *

        TOPIC = "tracker-events"
        KAFKA_BROKER = spark.conf.get("KAFKA_SERVER")

        raw_kafka_events = (spark.readStream
            .format("kafka")
            .option("subscribe", TOPIC)
            .option("kafka.bootstrap.servers", KAFKA_BROKER)
            .option("startingOffsets", "earliest")
            .load()
        )

        @dlt.table(table_properties={"pipelines.reset.allowed":"false"})
        def kafka_bronze():
            return raw_kafka_events
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertEqual(configs[0].topics, ["tracker-events"])

    def test_multiple_variable_topics(self):
        """Test multiple topics defined as variables"""
        source_code = """
        TOPIC_A = "orders"
        TOPIC_B = "payments"

        df = spark.readStream.format("kafka") \\
            .option("subscribe", TOPIC_A) \\
            .load()

        df2 = spark.readStream.format("kafka") \\
            .option("topics", TOPIC_B) \\
            .load()
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 2)
        topics = [c.topics[0] for c in configs]
        self.assertIn("orders", topics)
        self.assertIn("payments", topics)

    def test_variable_not_defined(self):
        """Test variable reference without definition"""
        source_code = """
        df = spark.readStream.format("kafka") \\
            .option("subscribe", UNDEFINED_TOPIC) \\
            .load()
        """
        configs = extract_kafka_sources(source_code)
        # Should still find Kafka source but with empty topics
        self.assertEqual(len(configs), 0)


class TestPipelineLibraries(unittest.TestCase):
    """Test cases for pipeline library extraction"""

    def test_notebook_library(self):
        """Test notebook library extraction"""
        pipeline_config = {
            "libraries": [{"notebook": {"path": "/Workspace/dlt/bronze_pipeline"}}]
        }
        libraries = get_pipeline_libraries(pipeline_config)
        self.assertEqual(len(libraries), 1)
        self.assertEqual(libraries[0], "/Workspace/dlt/bronze_pipeline")

    def test_file_library(self):
        """Test file library extraction"""
        pipeline_config = {
            "libraries": [{"file": {"path": "/Workspace/scripts/etl.py"}}]
        }
        libraries = get_pipeline_libraries(pipeline_config)
        self.assertEqual(len(libraries), 1)
        self.assertEqual(libraries[0], "/Workspace/scripts/etl.py")

    def test_mixed_libraries(self):
        """Test mixed notebook and file libraries"""
        pipeline_config = {
            "libraries": [
                {"notebook": {"path": "/nb1"}},
                {"file": {"path": "/file1.py"}},
                {"notebook": {"path": "/nb2"}},
            ]
        }
        libraries = get_pipeline_libraries(pipeline_config)
        self.assertEqual(len(libraries), 3)
        self.assertIn("/nb1", libraries)
        self.assertIn("/file1.py", libraries)
        self.assertIn("/nb2", libraries)

    def test_empty_libraries(self):
        """Test empty libraries list"""
        pipeline_config = {"libraries": []}
        libraries = get_pipeline_libraries(pipeline_config)
        self.assertEqual(len(libraries), 0)

    def test_missing_libraries_key(self):
        """Test missing libraries key"""
        pipeline_config = {}
        libraries = get_pipeline_libraries(pipeline_config)
        self.assertEqual(len(libraries), 0)

    def test_library_with_no_path(self):
        """Test library entry with no path"""
        pipeline_config = {"libraries": [{"notebook": {}}, {"file": {}}]}
        libraries = get_pipeline_libraries(pipeline_config)
        # Should skip entries without paths
        self.assertEqual(len(libraries), 0)

    def test_unsupported_library_type(self):
        """Test unsupported library types are skipped"""
        pipeline_config = {
            "libraries": [
                {"jar": {"path": "/lib.jar"}},  # Not supported
                {"notebook": {"path": "/nb"}},  # Supported
                {"whl": {"path": "/wheel.whl"}},  # Not supported
            ]
        }
        libraries = get_pipeline_libraries(pipeline_config)
        self.assertEqual(len(libraries), 1)
        self.assertEqual(libraries[0], "/nb")


class TestDLTTableExtraction(unittest.TestCase):
    """Test cases for DLT table name extraction"""

    def test_literal_table_name(self):
        """Test DLT table with literal string name"""
        source_code = """
        import dlt

        @dlt.table(name="user_events_bronze")
        def bronze_events():
            return spark.readStream.format("kafka").load()
        """
        table_names = extract_dlt_table_names(source_code)
        self.assertEqual(len(table_names), 1)
        self.assertEqual(table_names[0], "user_events_bronze")

    def test_table_name_with_comment(self):
        """Test DLT table decorator with comment parameter"""
        source_code = """
        @dlt.table(
            name="my_table",
            comment="This is a test table"
        )
        def my_function():
            return df
        """
        table_names = extract_dlt_table_names(source_code)
        self.assertEqual(len(table_names), 1)
        self.assertEqual(table_names[0], "my_table")

    def test_multiple_dlt_tables(self):
        """Test multiple DLT table decorators"""
        source_code = """
        @dlt.table(name="bronze_table")
        def bronze():
            return spark.readStream.format("kafka").load()

        @dlt.table(name="silver_table")
        def silver():
            return dlt.read("bronze_table")
        """
        table_names = extract_dlt_table_names(source_code)
        self.assertEqual(len(table_names), 2)
        self.assertIn("bronze_table", table_names)
        self.assertIn("silver_table", table_names)

    def test_function_name_pattern(self):
        """Test DLT table with function call for name"""
        source_code = """
        entity_name = "customerEvent"

        @dlt.table(name=materializer.generate_event_log_table_name())
        def event_log():
            return df
        """
        table_names = extract_dlt_table_names(source_code)
        # Should infer from entity_name variable and function pattern
        self.assertEqual(len(table_names), 1)
        self.assertEqual(table_names[0], "customerevent_event_log")

    def test_no_name_parameter(self):
        """Test DLT table decorator without name parameter"""
        source_code = """
        @dlt.table(comment="No name specified")
        def my_function():
            return df
        """
        table_names = extract_dlt_table_names(source_code)
        # Should return empty list when no name found
        self.assertEqual(len(table_names), 0)

    def test_mixed_case_decorator(self):
        """Test case insensitive DLT decorator"""
        source_code = """
        @DLT.TABLE(name="CasedTable")
        def func():
            return df
        """
        table_names = extract_dlt_table_names(source_code)
        self.assertEqual(len(table_names), 1)
        self.assertEqual(table_names[0], "CasedTable")

    def test_empty_source_code(self):
        """Test empty source code"""
        table_names = extract_dlt_table_names("")
        self.assertEqual(len(table_names), 0)

    def test_null_source_code(self):
        """Test None source code doesn't crash"""
        table_names = extract_dlt_table_names(None)
        self.assertEqual(len(table_names), 0)


class TestKafkaFallbackPatterns(unittest.TestCase):
    """Test cases for Kafka fallback extraction patterns"""

    def test_topic_variable_fallback(self):
        """Test fallback to topic_name variable when no explicit Kafka pattern"""
        source_code = """
        topic_name = "dev.example.cashout.customerEvent_v1"
        entity_name = "customerEvent"

        # Kafka reading is abstracted in helper class
        materializer = KafkaMaterializer(topic_name, entity_name)
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertEqual(configs[0].topics, ["dev.example.cashout.customerEvent_v1"])
        self.assertIsNone(configs[0].bootstrap_servers)

    def test_subject_variable_fallback(self):
        """Test fallback to subject_name variable"""
        source_code = """
        subject_name = "user-events"
        # Using helper class
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertEqual(configs[0].topics, ["user-events"])

    def test_stream_variable_fallback(self):
        """Test fallback to stream variable"""
        source_code = """
        stream_topic = "payment-stream"
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertEqual(configs[0].topics, ["payment-stream"])

    def test_topic_with_dots(self):
        """Test topic names with dots (namespace pattern)"""
        source_code = """
        df = spark.readStream.format("kafka") \\
            .option("subscribe", "pre-prod.earnin.customer-experience.messages") \\
            .load()
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertEqual(
            configs[0].topics, ["pre-prod.earnin.customer-experience.messages"]
        )

    def test_multiple_topic_variables(self):
        """Test multiple topic variables"""
        source_code = """
        topic_name = "events_v1"
        stream_topic = "metrics_v1"
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        # Should find both topics
        self.assertEqual(len(configs[0].topics), 2)
        self.assertIn("events_v1", configs[0].topics)
        self.assertIn("metrics_v1", configs[0].topics)

    def test_no_fallback_when_explicit_kafka(self):
        """Test that fallback is not used when explicit Kafka pattern exists"""
        source_code = """
        topic_name = "fallback_topic"

        df = spark.readStream.format("kafka") \\
            .option("subscribe", "explicit_topic") \\
            .load()
        """
        configs = extract_kafka_sources(source_code)
        # Should find the explicit Kafka source, not the fallback
        self.assertEqual(len(configs), 1)
        self.assertEqual(configs[0].topics, ["explicit_topic"])

    def test_lowercase_variables(self):
        """Test lowercase variable names are captured"""
        source_code = """
        topic_name = "lowercase_topic"
        TOPIC_NAME = "uppercase_topic"
        """
        configs = extract_kafka_sources(source_code)
        # Should find both
        self.assertEqual(len(configs), 1)
        self.assertEqual(len(configs[0].topics), 2)

    def test_real_world_abstracted_pattern(self):
        """Test real-world pattern with abstracted Kafka reading"""
        source_code = """
        import dlt
        from shared.materializers import KafkaMaterializer

        topic_name = "dev.example.cashout.customerEvent_v1"
        entity_name = "customerEvent"

        materializer = KafkaMaterializer(
            topic_name=topic_name,
            entity_name=entity_name,
            spark=spark
        )

        @dlt.table(name=materializer.generate_event_log_table_name())
        def event_log():
            return materializer.read_stream()
        """
        # Test Kafka extraction
        kafka_configs = extract_kafka_sources(source_code)
        self.assertEqual(len(kafka_configs), 1)
        self.assertEqual(
            kafka_configs[0].topics, ["dev.example.cashout.customerEvent_v1"]
        )

        # Test DLT table extraction
        table_names = extract_dlt_table_names(source_code)
        self.assertEqual(len(table_names), 1)
        self.assertEqual(table_names[0], "customerevent_event_log")


class TestDLTTableDependencies(unittest.TestCase):
    """Test cases for DLT table dependency extraction"""

    def test_bronze_silver_pattern(self):
        """Test table dependency pattern with Kafka source and downstream table"""
        source_code = """
        import dlt
        from pyspark.sql.functions import *

        @dlt.table(name="orders_bronze")
        def bronze():
            return spark.readStream.format("kafka").option("subscribe", "orders").load()

        @dlt.table(name="orders_silver")
        def silver():
            return dlt.read_stream("orders_bronze").select("*")
        """
        deps = extract_dlt_table_dependencies(source_code)
        self.assertEqual(len(deps), 2)

        bronze = next(d for d in deps if d.table_name == "orders_bronze")
        self.assertTrue(bronze.reads_from_kafka)
        self.assertEqual(bronze.depends_on, [])

        silver = next(d for d in deps if d.table_name == "orders_silver")
        self.assertFalse(silver.reads_from_kafka)
        self.assertEqual(silver.depends_on, ["orders_bronze"])

    def test_kafka_view_bronze_silver(self):
        """Test Kafka view with multi-tier table dependencies"""
        source_code = """
        import dlt

        @dlt.view()
        def kafka_source():
            return spark.readStream.format("kafka").option("subscribe", "topic").load()

        @dlt.table(name="bronze_table")
        def bronze():
            return dlt.read_stream("kafka_source")

        @dlt.table(name="silver_table")
        def silver():
            return dlt.read_stream("bronze_table")
        """
        deps = extract_dlt_table_dependencies(source_code)

        bronze = next((d for d in deps if d.table_name == "bronze_table"), None)
        self.assertIsNotNone(bronze)
        self.assertEqual(bronze.depends_on, ["kafka_source"])
        self.assertFalse(bronze.reads_from_kafka)

        silver = next((d for d in deps if d.table_name == "silver_table"), None)
        self.assertIsNotNone(silver)
        self.assertEqual(silver.depends_on, ["bronze_table"])
        self.assertFalse(silver.reads_from_kafka)

    def test_multiple_dependencies(self):
        """Test table with multiple source dependencies"""
        source_code = """
        @dlt.table(name="source1")
        def s1():
            return spark.readStream.format("kafka").load()

        @dlt.table(name="source2")
        def s2():
            return spark.readStream.format("kafka").load()

        @dlt.table(name="merged")
        def merge():
            df1 = dlt.read_stream("source1")
            df2 = dlt.read_stream("source2")
            return df1.union(df2)
        """
        deps = extract_dlt_table_dependencies(source_code)

        merged = next((d for d in deps if d.table_name == "merged"), None)
        self.assertIsNotNone(merged)
        self.assertEqual(sorted(merged.depends_on), ["source1", "source2"])
        self.assertFalse(merged.reads_from_kafka)

    def test_no_dependencies(self):
        """Test table with no dependencies (reads from file)"""
        source_code = """
        @dlt.table(name="static_data")
        def static():
            return spark.read.parquet("/path/to/data")
        """
        deps = extract_dlt_table_dependencies(source_code)
        self.assertEqual(len(deps), 1)
        self.assertEqual(deps[0].table_name, "static_data")
        self.assertEqual(deps[0].depends_on, [])
        self.assertFalse(deps[0].reads_from_kafka)

    def test_function_name_as_table_name(self):
        """Test using function name when no explicit name in decorator"""
        source_code = """
        @dlt.table()
        def my_bronze_table():
            return spark.readStream.format("kafka").load()
        """
        deps = extract_dlt_table_dependencies(source_code)
        self.assertEqual(len(deps), 1)
        self.assertEqual(deps[0].table_name, "my_bronze_table")
        self.assertTrue(deps[0].reads_from_kafka)

    def test_empty_source_code(self):
        """Test empty source code returns empty list"""
        deps = extract_dlt_table_dependencies("")
        self.assertEqual(len(deps), 0)

    def test_real_world_pattern(self):
        """Test the exact pattern from user's example"""
        source_code = """
import dlt
from pyspark.sql.functions import *
from pyspark.sql.types import *

TOPIC = "orders"

@dlt.view(comment="Kafka source")
def kafka_orders_source():
    return (
        spark.readStream
        .format("kafka")
        .option("subscribe", TOPIC)
        .load()
    )

@dlt.table(name="orders_bronze")
def orders_bronze():
    return dlt.read_stream("kafka_orders_source").select("*")

@dlt.table(name="orders_silver")
def orders_silver():
    return dlt.read_stream("orders_bronze").select("*")
        """
        deps = extract_dlt_table_dependencies(source_code)

        # Should find bronze and silver (kafka_orders_source is a view, not a table)
        table_deps = [
            d for d in deps if d.table_name in ["orders_bronze", "orders_silver"]
        ]
        self.assertEqual(len(table_deps), 2)

    def test_materializer_event_log_snapshot_pattern(self):
        """Test Materializer pattern with event_log and snapshot tables"""
        source_code = """
import dlt
from materialization.materializer.materializer import Materializer

env = "dev"
entity_name = "customerEvent"
topic_name = "dev.example.cashout.customerEvent_v1"
schema_name = "dev.example.cashout.customerEvent_v1-value"
schema_format = "json"
snapshot_required = True
starting_offsets = "earliest"

materializer = Materializer(env, topic_name, schema_format, schema_name, entity_name,
                            dbutils.secrets.get, False, True, starting_offsets)

@dlt.table(name=materializer.generate_event_log_table_name())
@dlt.expect_all_or_drop(dq_rules)
def create_event_log_table():
    return materializer.build_event_log_dataframe(spark)

if snapshot_required:
    materializer.build_snapshot_dataframe()
        """
        deps = extract_dlt_table_dependencies(source_code)

        # Should find both event_log and snapshot tables
        self.assertEqual(len(deps), 2)

        # Check event_log table
        event_log = next((d for d in deps if "event_log" in d.table_name), None)
        self.assertIsNotNone(event_log)
        self.assertEqual(event_log.table_name, "customerevent_event_log")
        self.assertTrue(event_log.reads_from_kafka)
        self.assertEqual(event_log.depends_on, [])

        # Check snapshot table
        snapshot = next((d for d in deps if "snapshot" in d.table_name), None)
        self.assertIsNotNone(snapshot)
        self.assertEqual(snapshot.table_name, "customerevent_snapshot")
        self.assertFalse(snapshot.reads_from_kafka)
        self.assertEqual(snapshot.depends_on, ["customerevent_event_log"])


class TestS3SourceDetection(unittest.TestCase):
    """Test cases for S3 source detection"""

    def test_s3_json_source(self):
        """Test detecting S3 source with spark.read.json()"""
        source_code = """
        @dlt.view()
        def s3_source():
            return spark.read.json("s3://mybucket/data/")
        """
        deps = extract_dlt_table_dependencies(source_code)
        self.assertEqual(len(deps), 1)
        self.assertTrue(deps[0].reads_from_s3)
        self.assertEqual(deps[0].s3_locations, ["s3://mybucket/data/"])

    def test_s3_parquet_source(self):
        """Test detecting S3 source with spark.read.parquet()"""
        source_code = """
        @dlt.table(name="parquet_table")
        def load_parquet():
            return spark.read.parquet("s3a://bucket/path/file.parquet")
        """
        deps = extract_dlt_table_dependencies(source_code)
        self.assertEqual(len(deps), 1)
        self.assertTrue(deps[0].reads_from_s3)
        self.assertIn("s3a://bucket/path/file.parquet", deps[0].s3_locations)

    def test_s3_with_options(self):
        """Test S3 source with options"""
        source_code = """
        @dlt.view()
        def external_source():
            return (
                spark.read
                    .option("multiline", "true")
                    .json("s3://test-firehose-con-bucket/firehose_data/")
            )
        """
        deps = extract_dlt_table_dependencies(source_code)
        self.assertEqual(len(deps), 1)
        self.assertTrue(deps[0].reads_from_s3)
        self.assertEqual(
            deps[0].s3_locations, ["s3://test-firehose-con-bucket/firehose_data/"]
        )

    def test_s3_format_load(self):
        """Test S3 with format().load() pattern"""
        source_code = """
        @dlt.table(name="csv_data")
        def load_csv():
            return spark.read.format("csv").option("header", "true").load("s3://bucket/data.csv")
        """
        deps = extract_dlt_table_dependencies(source_code)
        self.assertEqual(len(deps), 1)
        self.assertTrue(deps[0].reads_from_s3)
        self.assertIn("s3://bucket/data.csv", deps[0].s3_locations)

    def test_dlt_read_batch(self):
        """Test dlt.read() for batch table dependencies"""
        source_code = """
        @dlt.table(name="bronze")
        def bronze_table():
            return dlt.read("source_view")
        """
        deps = extract_dlt_table_dependencies(source_code)
        self.assertEqual(len(deps), 1)
        self.assertEqual(deps[0].depends_on, ["source_view"])

    def test_mixed_dlt_read_and_read_stream(self):
        """Test both dlt.read() and dlt.read_stream() in same pipeline"""
        source_code = """
        @dlt.table(name="batch_table")
        def batch():
            return dlt.read("source1")

        @dlt.table(name="stream_table")
        def stream():
            return dlt.read_stream("source2")
        """
        deps = extract_dlt_table_dependencies(source_code)
        self.assertEqual(len(deps), 2)

        batch = next(d for d in deps if d.table_name == "batch_table")
        self.assertEqual(batch.depends_on, ["source1"])

        stream = next(d for d in deps if d.table_name == "stream_table")
        self.assertEqual(stream.depends_on, ["source2"])

    def test_user_s3_example(self):
        """Test the user's exact S3 example"""
        source_code = """
        import dlt
        from pyspark.sql.functions import col

        @dlt.view(comment="External source data from S3")
        def external_source():
            return (
                spark.read
                    .option("multiline", "true")
                    .json("s3://test-firehose-con-bucket/firehose_data/")
            )

        @dlt.table(name="bronze_firehose_data")
        def bronze_firehose_data():
            return dlt.read("external_source")

        @dlt.table(name="silver_firehose_data")
        def silver_firehose_data():
            return dlt.read("bronze_firehose_data")
        """
        deps = extract_dlt_table_dependencies(source_code)
        self.assertEqual(len(deps), 3)

        # Verify external_source
        external = next((d for d in deps if d.table_name == "external_source"), None)
        self.assertIsNotNone(external)
        self.assertTrue(external.reads_from_s3)
        self.assertIn(
            "s3://test-firehose-con-bucket/firehose_data/", external.s3_locations
        )

        # Verify bronze
        bronze = next((d for d in deps if d.table_name == "bronze_firehose_data"), None)
        self.assertIsNotNone(bronze)
        self.assertEqual(bronze.depends_on, ["external_source"])
        self.assertFalse(bronze.reads_from_s3)

        # Verify silver
        silver = next((d for d in deps if d.table_name == "silver_firehose_data"), None)
        self.assertIsNotNone(silver)
        self.assertEqual(silver.depends_on, ["bronze_firehose_data"])
        self.assertFalse(silver.reads_from_s3)


if __name__ == "__main__":
    unittest.main()
