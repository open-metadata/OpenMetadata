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
Unit tests for Databricks Kafka lineage extraction
"""

import unittest
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.ingestion.source.pipeline.databrickspipeline.metadata import (
    DatabrickspipelineSource,
)


class TestKafkaTopicDiscovery(unittest.TestCase):
    """Test cases for Kafka topic discovery using ES search"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = MagicMock()
        self.mock_config = MagicMock()
        self.mock_config.serviceConnection.root.config = MagicMock()

        with patch.object(DatabrickspipelineSource, "__init__", lambda x, y, z: None):
            self.source = DatabrickspipelineSource(None, None)
            self.source.metadata = self.mock_metadata
            self.source._table_lookup_cache = {}
            self.source._dlt_table_cache = {}

    def test_find_topic_simple_name(self):
        """Test finding topic with simple name (no dots)"""
        # Mock ES response
        es_response = {
            "hits": {
                "hits": [
                    {"_source": {"fullyQualifiedName": "Confluent Kafka.events_topic"}}
                ]
            }
        }

        # Mock topic entity
        mock_topic = MagicMock(spec=Topic)
        mock_topic.fullyQualifiedName = FullyQualifiedEntityName(
            "Confluent Kafka.events_topic"
        )

        self.mock_metadata.client.get.return_value = es_response
        self.mock_metadata.get_by_name.return_value = mock_topic

        # Test
        result = self.source._find_kafka_topic("events_topic")

        # Verify
        self.assertIsNotNone(result)
        self.mock_metadata.client.get.assert_called_once()
        call_args = self.mock_metadata.client.get.call_args[0][0]
        self.assertIn("*.events_topic", call_args)

    def test_find_topic_with_dots(self):
        """Test finding topic with dots in name (quoted in FQN)"""
        # Mock ES response
        es_response = {
            "hits": {
                "hits": [
                    {
                        "_source": {
                            "fullyQualifiedName": 'Confluent Kafka."dev.example.transactions.customerEvent_v1"'
                        }
                    }
                ]
            }
        }

        mock_topic = MagicMock(spec=Topic)
        mock_topic.fullyQualifiedName = FullyQualifiedEntityName(
            'Confluent Kafka."dev.example.transactions.customerEvent_v1"'
        )

        self.mock_metadata.client.get.return_value = es_response
        self.mock_metadata.get_by_name.return_value = mock_topic

        # Test
        result = self.source._find_kafka_topic(
            "dev.example.transactions.customerEvent_v1"
        )

        # Verify
        self.assertIsNotNone(result)
        call_args = self.mock_metadata.client.get.call_args[0][0]
        # Should quote the topic name when it has dots
        self.assertIn('*."dev.example.transactions.customerEvent_v1"', call_args)

    def test_find_topic_not_found(self):
        """Test topic not found returns None"""
        # Mock empty ES response
        es_response = {"hits": {"hits": []}}

        self.mock_metadata.client.get.return_value = es_response

        # Test
        result = self.source._find_kafka_topic("nonexistent_topic")

        # Verify
        self.assertIsNone(result)

    def test_find_topic_es_error(self):
        """Test ES search error is handled gracefully"""
        # Mock ES error
        self.mock_metadata.client.get.side_effect = Exception("ES connection error")

        # Test - should not crash
        result = self.source._find_kafka_topic("test_topic")

        # Verify
        self.assertIsNone(result)


class TestDatabricksServiceCaching(unittest.TestCase):
    """Test cases for Databricks service caching"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = MagicMock()
        self.mock_config = MagicMock()

        with patch.object(DatabrickspipelineSource, "__init__", lambda x, y, z: None):
            self.source = DatabrickspipelineSource(None, None)
            self.source.metadata = self.mock_metadata
            self.source._databricks_services_cached = False
            self.source._databricks_services = []
            self.source._table_lookup_cache = {}
            self.source._dlt_table_cache = {}

    def test_get_databricks_services_caches_result(self):
        """Test that databricks services are cached"""
        # Mock database services
        mock_service_1 = MagicMock()
        mock_service_1.serviceType.value = "Databricks"
        mock_service_1.name = "databricks-prod"

        mock_service_2 = MagicMock()
        mock_service_2.serviceType.value = "UnityCatalog"
        mock_service_2.name = "unity-catalog-dev"

        mock_service_3 = MagicMock()
        mock_service_3.serviceType.value = "Postgres"
        mock_service_3.name = "postgres-db"

        self.mock_metadata.list_all_entities.return_value = [
            mock_service_1,
            mock_service_2,
            mock_service_3,
        ]

        # First call - should hit API
        result1 = self.source._get_databricks_services()

        # Verify results
        self.assertEqual(len(result1), 2)
        self.assertIn("databricks-prod", result1)
        self.assertIn("unity-catalog-dev", result1)
        self.assertNotIn("postgres-db", result1)

        # Verify caching flags
        self.assertTrue(self.source._databricks_services_cached)

        # Second call - should use cache
        result2 = self.source._get_databricks_services()

        # Verify same results
        self.assertEqual(result1, result2)

        # Verify API was only called once
        self.mock_metadata.list_all_entities.assert_called_once()

    def test_get_databricks_services_empty(self):
        """Test when no Databricks services exist"""
        self.mock_metadata.list_all_entities.return_value = []

        result = self.source._get_databricks_services()

        self.assertEqual(len(result), 0)
        self.assertTrue(self.source._databricks_services_cached)

    def test_get_databricks_services_api_error(self):
        """Test API error caches empty list"""
        self.mock_metadata.list_all_entities.side_effect = Exception("API error")

        result = self.source._get_databricks_services()

        # Should cache empty list on error
        self.assertEqual(len(result), 0)
        self.assertTrue(self.source._databricks_services_cached)


class TestDLTTableDiscovery(unittest.TestCase):
    """Test cases for DLT table discovery"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = MagicMock()

        with patch.object(DatabrickspipelineSource, "__init__", lambda x, y, z: None):
            self.source = DatabrickspipelineSource(None, None)
            self.source.metadata = self.mock_metadata
            self.source._databricks_services_cached = True
            self.source._databricks_services = ["databricks-prod", "databricks-dev"]
            self.source._table_lookup_cache = {}
            self.source._dlt_table_cache = {}

    def test_find_dlt_table_exact_match(self):
        """Test finding table with exact case match"""
        # Mock table entity
        mock_table = MagicMock(spec=Table)
        mock_table.fullyQualifiedName = FullyQualifiedEntityName(
            "databricks-prod.datamesh_dev.transactions.customerEvent"
        )

        # Configure the mock - first service returns None, second returns table
        # (2 services in cached list: databricks-prod, databricks-dev)
        self.mock_metadata.get_by_name.side_effect = [None, mock_table]

        # Test
        result = self.source._find_dlt_table(
            table_name="customerEvent", catalog="datamesh_dev", schema="transactions"
        )

        # Verify
        self.assertIsNotNone(result)
        self.assertEqual(result, mock_table)

    def test_find_dlt_table_lowercase_match(self):
        """Test finding table with lowercase match (Unity Catalog behavior)"""
        # Mock - exact case fails, lowercase succeeds
        mock_table = MagicMock(spec=Table)
        mock_table.fullyQualifiedName = FullyQualifiedEntityName(
            "databricks-prod.datamesh_dev.transactions.customerevent"
        )

        # First 4 calls fail (2 services x 2 exact case tries), then lowercase succeeds
        self.mock_metadata.get_by_name.side_effect = [
            None,
            None,  # Exact case tries
            None,
            mock_table,  # Lowercase tries
        ]

        # Test
        result = self.source._find_dlt_table(
            table_name="customerEvent", catalog="datamesh_dev", schema="transactions"
        )

        # Verify
        self.assertIsNotNone(result)

    def test_find_dlt_table_not_found(self):
        """Test table not found returns None"""
        # All lookups return None
        self.mock_metadata.get_by_name.return_value = None

        # Test
        result = self.source._find_dlt_table(
            table_name="nonexistent_table", catalog="test_catalog", schema="test_schema"
        )

        # Verify
        self.assertIsNone(result)

    def test_find_dlt_table_no_databricks_services(self):
        """Test behavior when no Databricks services configured"""
        self.source._databricks_services = []

        # Mock fallback to get_db_service_names
        with patch.object(self.source, "get_db_service_names", return_value=[]):
            result = self.source._find_dlt_table(
                table_name="test_table", catalog="test_catalog", schema="test_schema"
            )

        # Should return None
        self.assertIsNone(result)

    def test_find_dlt_table_uses_config_fallback(self):
        """Test fallback to configured dbServiceNames"""
        self.source._databricks_services = []

        # Don't cache so it tries the fallback
        self.source._databricks_services_cached = False

        mock_table = MagicMock(spec=Table)
        mock_table.fullyQualifiedName = FullyQualifiedEntityName(
            "configured-databricks.catalog.schema.test_table"
        )

        # Mock list_all_entities to return empty (simulating no Databricks services)
        self.mock_metadata.list_all_entities.return_value = []

        # Mock get_by_name to return table on first call to configured service
        self.mock_metadata.get_by_name.return_value = mock_table

        # Mock fallback to configured services
        with patch.object(
            self.source, "get_db_service_names", return_value=["configured-databricks"]
        ):
            result = self.source._find_dlt_table(
                table_name="test_table", catalog="catalog", schema="schema"
            )

        # Should find table using configured service
        self.assertIsNotNone(result)


class TestKafkaLineageIntegration(unittest.TestCase):
    """Integration tests for end-to-end Kafka lineage extraction"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = MagicMock()
        self.mock_client = MagicMock()

        with patch.object(DatabrickspipelineSource, "__init__", lambda x, y, z: None):
            self.source = DatabrickspipelineSource(None, None)
            self.source.metadata = self.mock_metadata
            self.source.client = self.mock_client
            self.source._databricks_services_cached = True
            self.source._databricks_services = ["databricks-prod"]
            self.source._table_lookup_cache = {}
            self.source._dlt_table_cache = {}

    def test_lineage_creation_flow(self):
        """Test complete flow: parse notebook -> find topic -> find table -> create lineage"""
        # Mock pipeline details
        mock_pipeline_details = MagicMock()
        mock_pipeline_details.pipeline_id = "test-pipeline-123"
        mock_pipeline_details.name = "Test DLT Pipeline"
        mock_pipeline_details.job_id = None

        # Mock pipeline entity
        mock_pipeline = MagicMock()
        mock_pipeline.id.root = "c3d4e5f6-a7b8-6c7d-0e9f-1a2b3c4d5e6f"

        # Mock pipeline config with notebook
        pipeline_config = {
            "spec": {
                "catalog": "datamesh_dev",
                "target": "transactions",
                "libraries": [{"notebook": {"path": "/notebooks/dlt_pipeline"}}],
            }
        }
        self.mock_client.get_pipeline_details.return_value = pipeline_config

        # Mock notebook source code - realistic DLT pattern with Kafka
        notebook_source = """
        import dlt

        topic_name = "dev.example.transactions.customerEvent_v1"
        entity_name = "customerEvent"

        @dlt.table(name="customerEvent")
        def event_log():
            return spark.readStream.format("kafka").option("subscribe", topic_name).load()
        """
        self.mock_client.export_notebook_source.return_value = notebook_source

        # Mock topic found
        mock_topic = MagicMock(spec=Topic)
        mock_topic.id = "a1b2c3d4-e5f6-4a5b-8c7d-9e8f7a6b5c4d"
        mock_topic.fullyQualifiedName = FullyQualifiedEntityName(
            'Confluent Kafka."dev.example.transactions.customerEvent_v1"'
        )

        # Mock table found
        mock_table = MagicMock(spec=Table)
        mock_table.id = MagicMock()
        mock_table.id.root = "b2c3d4e5-f6a7-5b6c-9d8e-0f9a8b7c6d5e"
        mock_table.fullyQualifiedName = FullyQualifiedEntityName(
            "databricks-prod.datamesh_dev.transactions.customerevent"
        )

        # Setup mocks
        self.mock_metadata.client.get.return_value = {
            "hits": {
                "hits": [
                    {
                        "_source": {
                            "fullyQualifiedName": 'Confluent Kafka."dev.example.transactions.customerEvent_v1"'
                        }
                    }
                ]
            }
        }
        self.mock_metadata.get_by_name.side_effect = [mock_topic, mock_table]

        # Test - call lineage extraction
        lineage_results = list(
            self.source._yield_kafka_lineage(mock_pipeline_details, mock_pipeline)
        )

        # Verify lineage was created
        self.assertGreater(len(lineage_results), 0)

        # Verify correct methods were called
        self.mock_client.get_pipeline_details.assert_called_once_with(
            "test-pipeline-123"
        )
        self.mock_client.export_notebook_source.assert_called_once_with(
            "/notebooks/dlt_pipeline"
        )


if __name__ == "__main__":
    unittest.main()
