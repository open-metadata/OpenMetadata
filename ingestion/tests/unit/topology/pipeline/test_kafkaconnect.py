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
Test KafkaConnect client and models
"""
from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.services.connections.pipeline.kafkaConnectConnection import (
    KafkaConnectConnection,
)
from metadata.ingestion.source.pipeline.kafkaconnect.client import KafkaConnectClient
from metadata.ingestion.source.pipeline.kafkaconnect.models import (
    KafkaConnectDatasetDetails,
    KafkaConnectPipelineDetails,
    KafkaConnectTasks,
    KafkaConnectTopics,
)


class TestKafkaConnectModels(TestCase):
    """Test KafkaConnect data models"""

    def test_kafka_connect_tasks_model(self):
        """Test KafkaConnectTasks model creation and defaults"""
        task = KafkaConnectTasks(id=1, state="RUNNING", worker_id="worker-1")
        self.assertEqual(task.id, 1)
        self.assertEqual(task.state, "RUNNING")
        self.assertEqual(task.worker_id, "worker-1")

    def test_kafka_connect_tasks_defaults(self):
        """Test KafkaConnectTasks default values"""
        task = KafkaConnectTasks(id=1)
        self.assertEqual(task.id, 1)
        self.assertEqual(task.state, "UNASSIGNED")
        self.assertIsNone(task.worker_id)

    def test_kafka_connect_topics_model(self):
        """Test KafkaConnectTopics model creation"""
        topic = KafkaConnectTopics(name="test-topic")
        self.assertEqual(topic.name, "test-topic")

    def test_kafka_connect_dataset_details_table_type(self):
        """Test KafkaConnectDatasetDetails with table type"""
        dataset = KafkaConnectDatasetDetails(table="users", database="mydb")
        self.assertEqual(dataset.table, "users")
        self.assertEqual(dataset.database, "mydb")
        self.assertIsNone(dataset.container_name)

        # Import here to avoid circular dependency issues
        from metadata.generated.schema.entity.data.table import Table

        self.assertEqual(dataset.dataset_type, Table)

    def test_kafka_connect_dataset_details_container_type(self):
        """Test KafkaConnectDatasetDetails with container type"""
        dataset = KafkaConnectDatasetDetails(container_name="my-bucket")
        self.assertEqual(dataset.container_name, "my-bucket")
        self.assertIsNone(dataset.table)
        self.assertIsNone(dataset.database)

        # Import here to avoid circular dependency issues
        from metadata.generated.schema.entity.data.container import Container

        self.assertEqual(dataset.dataset_type, Container)

    def test_kafka_connect_dataset_details_no_type(self):
        """Test KafkaConnectDatasetDetails with no type"""
        dataset = KafkaConnectDatasetDetails()
        self.assertIsNone(dataset.table)
        self.assertIsNone(dataset.database)
        self.assertIsNone(dataset.container_name)
        self.assertIsNone(dataset.dataset_type)

    def test_kafka_connect_pipeline_details_model(self):
        """Test KafkaConnectPipelineDetails model with default factory"""
        pipeline = KafkaConnectPipelineDetails(name="test-connector")
        self.assertEqual(pipeline.name, "test-connector")
        self.assertEqual(pipeline.status, "UNASSIGNED")
        self.assertEqual(pipeline.conn_type, "UNKNOWN")
        self.assertEqual(pipeline.tasks, [])
        self.assertEqual(pipeline.topics, [])
        self.assertEqual(pipeline.config, {})
        self.assertIsNone(pipeline.description)
        self.assertIsNone(pipeline.dataset)

    def test_kafka_connect_pipeline_details_with_data(self):
        """Test KafkaConnectPipelineDetails with full data"""
        tasks = [KafkaConnectTasks(id=1, state="RUNNING")]
        topics = [KafkaConnectTopics(name="test-topic")]
        dataset = KafkaConnectDatasetDetails(table="users")

        pipeline = KafkaConnectPipelineDetails(
            name="test-connector",
            status="RUNNING",
            tasks=tasks,
            topics=topics,
            type="source",  # Using the alias 'type' instead of 'conn_type'
            description="Test connector",
            dataset=dataset,
            config={"key": "value"},
        )

        self.assertEqual(pipeline.name, "test-connector")
        self.assertEqual(pipeline.status, "RUNNING")
        self.assertEqual(pipeline.conn_type, "source")
        self.assertEqual(len(pipeline.tasks), 1)
        self.assertEqual(len(pipeline.topics), 1)
        self.assertEqual(pipeline.description, "Test connector")
        self.assertIsNotNone(pipeline.dataset)
        self.assertEqual(pipeline.config["key"], "value")


class TestKafkaConnectClient(TestCase):
    """Test KafkaConnect client functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_config = MagicMock(spec=KafkaConnectConnection)
        self.mock_config.hostPort = "http://localhost:8083"
        self.mock_config.verifySSL = True
        self.mock_config.KafkaConnectConfig = None

    def test_client_initialization_no_auth(self):
        """Test client initialization without authentication"""
        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"
        ) as mock_kafka_connect:
            client = KafkaConnectClient(self.mock_config)

            mock_kafka_connect.assert_called_once_with(
                url="http://localhost:8083", auth=None, ssl_verify=True
            )

    def test_client_initialization_with_auth(self):
        """Test client initialization with authentication"""
        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"
        ) as mock_kafka_connect:
            mock_auth_config = MagicMock()
            mock_auth_config.username = "user"
            mock_auth_config.password.get_secret_value.return_value = "pass"
            self.mock_config.KafkaConnectConfig = mock_auth_config

            client = KafkaConnectClient(self.mock_config)

            mock_kafka_connect.assert_called_once_with(
                url="http://localhost:8083", auth="user:pass", ssl_verify=True
            )

    def test_enrich_connector_details_helper(self):
        """Test _enrich_connector_details helper method"""
        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"
        ):
            client = KafkaConnectClient(self.mock_config)
            connector_details = KafkaConnectPipelineDetails(name="test-connector")

            # Mock the methods called by _enrich_connector_details
            client.get_connector_topics = MagicMock(
                return_value=[KafkaConnectTopics(name="topic1")]
            )
            client.get_connector_config = MagicMock(
                return_value={"description": "Test connector"}
            )
            client.get_connector_dataset_info = MagicMock(
                return_value=KafkaConnectDatasetDetails(table="users")
            )

            client._enrich_connector_details(connector_details, "test-connector")

            # Verify method calls
            client.get_connector_topics.assert_called_once_with(
                connector="test-connector"
            )
            client.get_connector_config.assert_called_once_with(
                connector="test-connector"
            )
            client.get_connector_dataset_info.assert_called_once_with(
                {"description": "Test connector"}
            )

            # Verify results
            self.assertEqual(len(connector_details.topics), 1)
            self.assertEqual(connector_details.description, "Test connector")
            self.assertIsNotNone(connector_details.dataset)

    def test_enrich_connector_details_no_config(self):
        """Test _enrich_connector_details with no config"""
        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"
        ):
            client = KafkaConnectClient(self.mock_config)
            connector_details = KafkaConnectPipelineDetails(name="test-connector")

            client.get_connector_topics = MagicMock(return_value=[])
            client.get_connector_config = MagicMock(return_value=None)
            client.get_connector_dataset_info = MagicMock()

            client._enrich_connector_details(connector_details, "test-connector")

            # Verify dataset info is not called when config is None
            client.get_connector_dataset_info.assert_not_called()
            self.assertIsNone(connector_details.description)
            self.assertIsNone(connector_details.dataset)

    def test_get_cluster_info(self):
        """Test get_cluster_info method"""
        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"
        ) as mock_kafka_connect:
            client = KafkaConnectClient(self.mock_config)
            mock_client = mock_kafka_connect.return_value
            mock_client.get_cluster_info.return_value = {"version": "3.0.0"}

            result = client.get_cluster_info()

            mock_client.get_cluster_info.assert_called_once()
            self.assertEqual(result, {"version": "3.0.0"})

    def test_get_connector_dataset_info_table(self):
        """Test get_connector_dataset_info with table configuration"""
        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"
        ):
            client = KafkaConnectClient(self.mock_config)
            config = {"table": "users", "database": "mydb"}

            result = client.get_connector_dataset_info(config)

            self.assertIsInstance(result, KafkaConnectDatasetDetails)
            self.assertEqual(result.table, "users")

    def test_get_connector_dataset_info_container(self):
        """Test get_connector_dataset_info with container configuration"""
        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"
        ):
            client = KafkaConnectClient(self.mock_config)
            config = {"s3.bucket.name": "my-bucket"}

            result = client.get_connector_dataset_info(config)

            self.assertIsInstance(result, KafkaConnectDatasetDetails)
            self.assertEqual(result.container_name, "my-bucket")

    def test_get_connector_dataset_info_no_match(self):
        """Test get_connector_dataset_info with no matching configuration"""
        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"
        ):
            client = KafkaConnectClient(self.mock_config)
            config = {"some.other.config": "value"}

            result = client.get_connector_dataset_info(config)

            self.assertIsNone(result)

    def test_supported_datasets_configuration(self):
        """Test supported dataset configurations are properly handled"""
        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"
        ):
            client = KafkaConnectClient(self.mock_config)

            # Test various supported dataset configurations
            test_configs = [
                # Table configurations
                ({"table": "users", "database": "mydb"}, "table", "users"),
                ({"collection": "users"}, "table", "users"),
                ({"snowflake.schema.name": "schema1"}, "table", "schema1"),
                ({"table.whitelist": "table1,table2"}, "table", "table1,table2"),
                ({"fields.whitelist": "field1,field2"}, "table", "field1,field2"),
                # Database configurations
                ({"database": "mydb"}, "database", "mydb"),
                ({"db.name": "testdb"}, "database", "testdb"),
                ({"snowflake.database.name": "snowdb"}, "database", "snowdb"),
                # Container configurations
                ({"s3.bucket.name": "my-bucket"}, "container_name", "my-bucket"),
            ]

            for config, expected_field, expected_value in test_configs:
                with self.subTest(config=config):
                    result = client.get_connector_dataset_info(config)
                    self.assertIsNotNone(result, f"Failed for config: {config}")
                    actual_value = getattr(result, expected_field)
                    self.assertEqual(
                        actual_value,
                        expected_value,
                        f"Expected {expected_field}={expected_value}, got {actual_value}",
                    )
