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


if __name__ == "__main__":
    unittest.main()
