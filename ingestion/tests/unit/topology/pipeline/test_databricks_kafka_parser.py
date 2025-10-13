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
        entity_name = "moneyRequest"

        @dlt.table(name=materializer.generate_event_log_table_name())
        def event_log():
            return df
        """
        table_names = extract_dlt_table_names(source_code)
        # Should infer from entity_name variable
        self.assertEqual(len(table_names), 1)
        self.assertEqual(table_names[0], "moneyRequest")

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
        topic_name = "dev.ern.cashout.moneyRequest_v1"
        entity_name = "moneyRequest"

        # Kafka reading is abstracted in helper class
        materializer = KafkaMaterializer(topic_name, entity_name)
        """
        configs = extract_kafka_sources(source_code)
        self.assertEqual(len(configs), 1)
        self.assertEqual(configs[0].topics, ["dev.ern.cashout.moneyRequest_v1"])
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

        topic_name = "dev.ern.cashout.moneyRequest_v1"
        entity_name = "moneyRequest"

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
        self.assertEqual(kafka_configs[0].topics, ["dev.ern.cashout.moneyRequest_v1"])

        # Test DLT table extraction
        table_names = extract_dlt_table_names(source_code)
        self.assertEqual(len(table_names), 1)
        self.assertEqual(table_names[0], "moneyRequest")


if __name__ == "__main__":
    unittest.main()
