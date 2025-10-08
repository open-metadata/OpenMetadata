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
from unittest.mock import MagicMock, Mock, patch

from metadata.generated.schema.entity.services.connections.pipeline.kafkaConnectConnection import (
    KafkaConnectConnection,
)
from metadata.ingestion.source.pipeline.kafkaconnect.client import KafkaConnectClient
from metadata.ingestion.source.pipeline.kafkaconnect.models import (
    KafkaConnectColumnMapping,
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


class TestConfluentCloudSupport(TestCase):
    """Test Confluent Cloud specific functionality"""

    def test_confluent_cloud_detection(self):
        """Test that Confluent Cloud URLs are detected correctly"""
        confluent_config = Mock(spec=KafkaConnectConnection)
        confluent_config.hostPort = "https://api.confluent.cloud/connect/v1/environments/env-123/clusters/lkc-456"
        confluent_config.verifySSL = True
        confluent_config.KafkaConnectConfig = None

        client = KafkaConnectClient(confluent_config)
        self.assertTrue(client.is_confluent_cloud)

    def test_self_hosted_detection(self):
        """Test that self-hosted Kafka Connect is detected correctly"""
        self_hosted_config = Mock(spec=KafkaConnectConnection)
        self_hosted_config.hostPort = "http://localhost:8083"
        self_hosted_config.verifySSL = False
        self_hosted_config.KafkaConnectConfig = None

        client = KafkaConnectClient(self_hosted_config)
        self.assertFalse(client.is_confluent_cloud)

    def test_confluent_cloud_get_cluster_info(self):
        """Test that get_cluster_info works for Confluent Cloud"""
        confluent_config = Mock(spec=KafkaConnectConnection)
        confluent_config.hostPort = "https://api.confluent.cloud/connect/v1/environments/env-123/clusters/lkc-456"
        confluent_config.verifySSL = True
        confluent_config.KafkaConnectConfig = None

        client = KafkaConnectClient(confluent_config)
        client.client.list_connectors = Mock(return_value=["connector1", "connector2"])

        result = client.get_cluster_info()
        self.assertIsNotNone(result)
        self.assertEqual(result["version"], "confluent-cloud")
        self.assertEqual(result["kafka_cluster_id"], "confluent-managed")

    def test_confluent_cloud_get_connector_topics_from_config(self):
        """Test extracting topics from Confluent Cloud connector config"""
        confluent_config = Mock(spec=KafkaConnectConnection)
        confluent_config.hostPort = "https://api.confluent.cloud/connect/v1/environments/env-123/clusters/lkc-456"
        confluent_config.verifySSL = True
        confluent_config.KafkaConnectConfig = None

        client = KafkaConnectClient(confluent_config)
        client.get_connector_config = Mock(return_value={"kafka.topic": "orders_topic"})

        topics = client.get_connector_topics("test-connector")
        self.assertIsNotNone(topics)
        self.assertEqual(len(topics), 1)
        self.assertEqual(topics[0].name, "orders_topic")

    def test_confluent_cloud_get_connector_topics_multiple(self):
        """Test extracting multiple topics from Confluent Cloud connector config"""
        confluent_config = Mock(spec=KafkaConnectConnection)
        confluent_config.hostPort = "https://api.confluent.cloud/connect/v1/environments/env-123/clusters/lkc-456"
        confluent_config.verifySSL = True
        confluent_config.KafkaConnectConfig = None

        client = KafkaConnectClient(confluent_config)
        client.get_connector_config = Mock(
            return_value={"topics": "topic1,topic2,topic3"}
        )

        topics = client.get_connector_topics("test-connector")
        self.assertIsNotNone(topics)
        self.assertEqual(len(topics), 3)
        self.assertEqual(topics[0].name, "topic1")
        self.assertEqual(topics[1].name, "topic2")
        self.assertEqual(topics[2].name, "topic3")

    def test_confluent_cloud_database_include_list(self):
        """Test extracting database from Confluent Cloud database.include.list field"""
        config = {"database.include.list": "mydb"}

        client_config = Mock(spec=KafkaConnectConnection)
        client_config.hostPort = "http://localhost:8083"
        client_config.verifySSL = False
        client_config.KafkaConnectConfig = None

        client = KafkaConnectClient(client_config)
        result = client.get_connector_dataset_info(config)

        self.assertIsNotNone(result)
        self.assertEqual(result.database, "mydb")

    def test_confluent_cloud_table_include_list(self):
        """Test extracting table from Confluent Cloud table.include.list field"""
        config = {"table.include.list": "mydb.customers,mydb.orders"}

        client_config = Mock(spec=KafkaConnectConnection)
        client_config.hostPort = "http://localhost:8083"
        client_config.verifySSL = False
        client_config.KafkaConnectConfig = None

        client = KafkaConnectClient(client_config)
        result = client.get_connector_dataset_info(config)

        self.assertIsNotNone(result)
        self.assertEqual(result.table, "mydb.customers,mydb.orders")

    def test_confluent_cloud_database_hostname(self):
        """Test extracting database from Confluent Cloud database.hostname field"""
        config = {"database.hostname": "mysql.example.com"}

        client_config = Mock(spec=KafkaConnectConnection)
        client_config.hostPort = "http://localhost:8083"
        client_config.verifySSL = False
        client_config.KafkaConnectConfig = None

        client = KafkaConnectClient(client_config)
        result = client.get_connector_dataset_info(config)

        self.assertIsNotNone(result)
        self.assertEqual(result.database, "mysql.example.com")

    def test_debezium_postgres_database_dbname(self):
        """Test extracting database from Debezium PostgreSQL database.dbname field"""
        config = {"database.dbname": "postgres"}

        client_config = Mock(spec=KafkaConnectConnection)
        client_config.hostPort = "http://localhost:8083"
        client_config.verifySSL = False
        client_config.KafkaConnectConfig = None

        client = KafkaConnectClient(client_config)
        result = client.get_connector_dataset_info(config)

        self.assertIsNotNone(result)
        self.assertEqual(result.database, "postgres")

    def test_debezium_topic_prefix(self):
        """Test extracting database from Debezium topic.prefix field"""
        config = {"topic.prefix": "dbserver1"}

        client_config = Mock(spec=KafkaConnectConnection)
        client_config.hostPort = "http://localhost:8083"
        client_config.verifySSL = False
        client_config.KafkaConnectConfig = None

        client = KafkaConnectClient(client_config)
        result = client.get_connector_dataset_info(config)

        self.assertIsNotNone(result)
        self.assertEqual(result.database, "dbserver1")

    def test_mysql_cdc_databases_include(self):
        """Test extracting database from MySQL CDC V2 databases.include field"""
        config = {"databases.include": "mydb1,mydb2"}

        client_config = Mock(spec=KafkaConnectConnection)
        client_config.hostPort = "http://localhost:8083"
        client_config.verifySSL = False
        client_config.KafkaConnectConfig = None

        client = KafkaConnectClient(client_config)
        result = client.get_connector_dataset_info(config)

        self.assertIsNotNone(result)
        self.assertEqual(result.database, "mydb1,mydb2")

    def test_mysql_cdc_tables_include(self):
        """Test extracting tables from MySQL CDC V2 tables.include field"""
        config = {"tables.include": "db1.users,db1.orders"}

        client_config = Mock(spec=KafkaConnectConnection)
        client_config.hostPort = "http://localhost:8083"
        client_config.verifySSL = False
        client_config.KafkaConnectConfig = None

        client = KafkaConnectClient(client_config)
        result = client.get_connector_dataset_info(config)

        self.assertIsNotNone(result)
        self.assertEqual(result.table, "db1.users,db1.orders")

    def test_snowflake_database_field(self):
        """Test extracting database from Snowflake snowflake.database field"""
        config = {"snowflake.database": "ANALYTICS_DB"}

        client_config = Mock(spec=KafkaConnectConnection)
        client_config.hostPort = "http://localhost:8083"
        client_config.verifySSL = False
        client_config.KafkaConnectConfig = None

        client = KafkaConnectClient(client_config)
        result = client.get_connector_dataset_info(config)

        self.assertIsNotNone(result)
        self.assertEqual(result.database, "ANALYTICS_DB")

    def test_snowflake_schema_field(self):
        """Test extracting table/schema from Snowflake snowflake.schema field"""
        config = {"snowflake.schema": "PUBLIC"}

        client_config = Mock(spec=KafkaConnectConnection)
        client_config.hostPort = "http://localhost:8083"
        client_config.verifySSL = False
        client_config.KafkaConnectConfig = None

        client = KafkaConnectClient(client_config)
        result = client.get_connector_dataset_info(config)

        self.assertIsNotNone(result)
        self.assertEqual(result.table, "PUBLIC")

    def test_sql_server_database_names(self):
        """Test extracting database from SQL Server database.names field"""
        config = {"database.names": "AdventureWorks,Northwind"}

        client_config = Mock(spec=KafkaConnectConnection)
        client_config.hostPort = "http://localhost:8083"
        client_config.verifySSL = False
        client_config.KafkaConnectConfig = None

        client = KafkaConnectClient(client_config)
        result = client.get_connector_dataset_info(config)

        self.assertIsNotNone(result)
        self.assertEqual(result.database, "AdventureWorks,Northwind")

    def test_s3_bucket_field(self):
        """Test extracting bucket from S3 s3.bucket field"""
        config = {"s3.bucket": "my-data-lake"}

        client_config = Mock(spec=KafkaConnectConnection)
        client_config.hostPort = "http://localhost:8083"
        client_config.verifySSL = False
        client_config.KafkaConnectConfig = None

        client = KafkaConnectClient(client_config)
        result = client.get_connector_dataset_info(config)

        self.assertIsNotNone(result)
        self.assertEqual(result.container_name, "my-data-lake")

    def test_gcs_bucket_field(self):
        """Test extracting bucket from GCS gcs.bucket.name field"""
        config = {"gcs.bucket.name": "my-gcs-bucket"}

        client_config = Mock(spec=KafkaConnectConnection)
        client_config.hostPort = "http://localhost:8083"
        client_config.verifySSL = False
        client_config.KafkaConnectConfig = None

        client = KafkaConnectClient(client_config)
        result = client.get_connector_dataset_info(config)

        self.assertIsNotNone(result)
        self.assertEqual(result.container_name, "my-gcs-bucket")

    def test_postgres_sink_connection_host(self):
        """Test extracting database from PostgreSQL Sink connection.host field"""
        config = {"connection.host": "postgres.example.com"}

        client_config = Mock(spec=KafkaConnectConnection)
        client_config.hostPort = "http://localhost:8083"
        client_config.verifySSL = False
        client_config.KafkaConnectConfig = None

        client = KafkaConnectClient(client_config)
        result = client.get_connector_dataset_info(config)

        self.assertIsNotNone(result)
        self.assertEqual(result.database, "postgres.example.com")

    def test_sink_fields_included(self):
        """Test extracting fields from Sink connector fields.included field"""
        config = {"fields.included": "id,name,email,created_at"}

        client_config = Mock(spec=KafkaConnectConnection)
        client_config.hostPort = "http://localhost:8083"
        client_config.verifySSL = False
        client_config.KafkaConnectConfig = None

        client = KafkaConnectClient(client_config)
        result = client.get_connector_dataset_info(config)

        self.assertIsNotNone(result)
        self.assertEqual(result.table, "id,name,email,created_at")

    def test_debezium_mysql_database_exclude_list(self):
        """Test extracting database from Debezium MySQL database.exclude.list field"""
        config = {"database.exclude.list": "test,temp"}

        client_config = Mock(spec=KafkaConnectConnection)
        client_config.hostPort = "http://localhost:8083"
        client_config.verifySSL = False
        client_config.KafkaConnectConfig = None

        client = KafkaConnectClient(client_config)
        result = client.get_connector_dataset_info(config)

        self.assertIsNotNone(result)
        self.assertEqual(result.database, "test,temp")

    def test_debezium_v1_database_server_name(self):
        """Test extracting database from Debezium V1 database.server.name field"""
        config = {"database.server.name": "mysql-server-1"}

        client_config = Mock(spec=KafkaConnectConnection)
        client_config.hostPort = "http://localhost:8083"
        client_config.verifySSL = False
        client_config.KafkaConnectConfig = None

        client = KafkaConnectClient(client_config)
        result = client.get_connector_dataset_info(config)

        self.assertIsNotNone(result)
        self.assertEqual(result.database, "mysql-server-1")

    def test_debezium_v2_topic_prefix(self):
        """Test extracting database from Debezium V2 topic.prefix field (already tested but documenting V2)"""
        config = {"topic.prefix": "postgres-server-1"}

        client_config = Mock(spec=KafkaConnectConnection)
        client_config.hostPort = "http://localhost:8083"
        client_config.verifySSL = False
        client_config.KafkaConnectConfig = None

        client = KafkaConnectClient(client_config)
        result = client.get_connector_dataset_info(config)

        self.assertIsNotNone(result)
        self.assertEqual(result.database, "postgres-server-1")


class TestKafkaConnectColumnLineage(TestCase):
    """Test KafkaConnect column-level lineage functionality"""

    def test_column_mapping_model(self):
        """Test KafkaConnectColumnMapping model creation"""
        mapping = KafkaConnectColumnMapping(source_column="id", target_column="user_id")
        self.assertEqual(mapping.source_column, "id")
        self.assertEqual(mapping.target_column, "user_id")

    def test_dataset_details_with_column_mappings(self):
        """Test KafkaConnectDatasetDetails with column mappings"""
        mappings = [
            KafkaConnectColumnMapping(source_column="id", target_column="user_id"),
            KafkaConnectColumnMapping(source_column="name", target_column="full_name"),
        ]
        dataset = KafkaConnectDatasetDetails(
            table="users", database="mydb", column_mappings=mappings
        )

        self.assertEqual(len(dataset.column_mappings), 2)
        self.assertEqual(dataset.column_mappings[0].source_column, "id")
        self.assertEqual(dataset.column_mappings[0].target_column, "user_id")

    def test_dataset_details_column_mappings_default(self):
        """Test KafkaConnectDatasetDetails column_mappings defaults to empty list"""
        dataset = KafkaConnectDatasetDetails(table="users")
        self.assertEqual(dataset.column_mappings, [])

    def test_extract_column_mappings_with_smt_renames(self):
        """Test extract_column_mappings with SMT ReplaceField transform"""
        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"
        ):
            mock_config = MagicMock(spec=KafkaConnectConnection)
            mock_config.hostPort = "http://localhost:8083"
            mock_config.verifySSL = True
            mock_config.KafkaConnectConfig = None

            client = KafkaConnectClient(mock_config)

            config = {
                "transforms": "rename",
                "transforms.rename.type": "org.apache.kafka.connect.transforms.ReplaceField$Value",
                "transforms.rename.renames": "id:user_id,name:full_name",
            }

            result = client.extract_column_mappings(config)

            self.assertIsNotNone(result)
            self.assertEqual(len(result), 2)
            self.assertEqual(result[0].source_column, "id")
            self.assertEqual(result[0].target_column, "user_id")
            self.assertEqual(result[1].source_column, "name")
            self.assertEqual(result[1].target_column, "full_name")

    def test_extract_column_mappings_no_transforms(self):
        """Test extract_column_mappings with no transforms"""
        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"
        ):
            mock_config = MagicMock(spec=KafkaConnectConnection)
            mock_config.hostPort = "http://localhost:8083"
            mock_config.verifySSL = True
            mock_config.KafkaConnectConfig = None

            client = KafkaConnectClient(mock_config)
            config = {"some.config": "value"}

            result = client.extract_column_mappings(config)

            self.assertIsNone(result)

    def test_extract_column_mappings_transform_without_renames(self):
        """Test extract_column_mappings with transform but no renames"""
        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"
        ):
            mock_config = MagicMock(spec=KafkaConnectConnection)
            mock_config.hostPort = "http://localhost:8083"
            mock_config.verifySSL = True
            mock_config.KafkaConnectConfig = None

            client = KafkaConnectClient(mock_config)

            config = {
                "transforms": "mask",
                "transforms.mask.type": "org.apache.kafka.connect.transforms.MaskField$Value",
            }

            result = client.extract_column_mappings(config)

            self.assertIsNone(result)

    def test_extract_column_mappings_multiple_transforms(self):
        """Test extract_column_mappings with multiple transforms"""
        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"
        ):
            mock_config = MagicMock(spec=KafkaConnectConnection)
            mock_config.hostPort = "http://localhost:8083"
            mock_config.verifySSL = True
            mock_config.KafkaConnectConfig = None

            client = KafkaConnectClient(mock_config)

            config = {
                "transforms": "rename,mask",
                "transforms.rename.type": "org.apache.kafka.connect.transforms.ReplaceField$Value",
                "transforms.rename.renames": "id:user_id",
                "transforms.mask.type": "org.apache.kafka.connect.transforms.MaskField$Value",
            }

            result = client.extract_column_mappings(config)

            self.assertIsNotNone(result)
            self.assertEqual(len(result), 1)
            self.assertEqual(result[0].source_column, "id")
            self.assertEqual(result[0].target_column, "user_id")

    def test_get_connector_dataset_info_includes_column_mappings(self):
        """Test get_connector_dataset_info includes column mappings"""
        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"
        ):
            mock_config = MagicMock(spec=KafkaConnectConnection)
            mock_config.hostPort = "http://localhost:8083"
            mock_config.verifySSL = True
            mock_config.KafkaConnectConfig = None

            client = KafkaConnectClient(mock_config)

            config = {
                "table": "users",
                "database": "mydb",
                "transforms": "rename",
                "transforms.rename.type": "org.apache.kafka.connect.transforms.ReplaceField$Value",
                "transforms.rename.renames": "id:user_id",
            }

            result = client.get_connector_dataset_info(config)

            self.assertIsNotNone(result)
            self.assertEqual(result.table, "users")
            self.assertIsNotNone(result.column_mappings)
            self.assertEqual(len(result.column_mappings), 1)
            self.assertEqual(result.column_mappings[0].source_column, "id")
            self.assertEqual(result.column_mappings[0].target_column, "user_id")

    def test_column_lineage_failure_gracefully_handled(self):
        """Test that column lineage building handles errors gracefully"""
        from metadata.generated.schema.entity.data.table import Table
        from metadata.generated.schema.entity.data.topic import Topic
        from metadata.ingestion.source.pipeline.kafkaconnect.metadata import (
            KafkaconnectSource,
        )

        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"
        ):
            # Create a minimal source instance
            mock_config = MagicMock(spec=KafkaConnectConnection)
            mock_config.hostPort = "http://localhost:8083"
            mock_config.verifySSL = True
            mock_config.KafkaConnectConfig = None
            mock_config.messagingServiceName = "test_kafka"

            mock_metadata = Mock()

            # Create source with minimal setup - we're only testing build_column_lineage
            source = Mock(spec=KafkaconnectSource)
            source._get_topic_field_fqn = (
                KafkaconnectSource._get_topic_field_fqn.__get__(
                    source, KafkaconnectSource
                )
            )
            source.build_column_lineage = (
                KafkaconnectSource.build_column_lineage.__get__(
                    source, KafkaconnectSource
                )
            )

            # Create mock entities
            mock_table_entity = Mock(spec=Table)
            mock_table_entity.columns = []

            mock_topic_entity = Mock(spec=Topic)
            mock_topic_name = Mock()
            mock_topic_name.root = "test-topic"
            mock_topic_entity.name = mock_topic_name
            # Missing messageSchema will cause column lineage to return None
            mock_topic_entity.messageSchema = None

            pipeline_details = KafkaConnectPipelineDetails(
                name="test-connector",
                status="RUNNING",
                conn_type="source",
            )

            # Test column lineage build - should return None gracefully without raising
            result = source.build_column_lineage(
                from_entity=mock_table_entity,
                to_entity=mock_topic_entity,
                topic_entity=mock_topic_entity,
                pipeline_details=pipeline_details,
            )

            # Should return None when no column lineage can be built
            self.assertIsNone(result)
