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

from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, Mock, patch
from uuid import uuid4

import pytest

from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.pipeline.kafkaConnectConnection import (
    KafkaConnectConnection,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.pipeline.kafkaconnect.client import KafkaConnectClient
from metadata.ingestion.source.pipeline.kafkaconnect.models import (
    KafkaConnectColumnMapping,
    KafkaConnectDatasetDetails,
    KafkaConnectPipelineDetails,
    KafkaConnectTasks,
    KafkaConnectTopics,
    ServiceResolutionResult,
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
        self.assertEqual(pipeline.datasets, [])

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
            datasets=[dataset],
            config={"key": "value"},
        )

        self.assertEqual(pipeline.name, "test-connector")
        self.assertEqual(pipeline.status, "RUNNING")
        self.assertEqual(pipeline.conn_type, "source")
        self.assertEqual(len(pipeline.tasks), 1)
        self.assertEqual(len(pipeline.topics), 1)
        self.assertEqual(pipeline.description, "Test connector")
        self.assertIsNotNone(pipeline.datasets)
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
        with patch("metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect") as mock_kafka_connect:
            client = KafkaConnectClient(self.mock_config)  # noqa: F841

            mock_kafka_connect.assert_called_once_with(url="http://localhost:8083", auth=None, ssl_verify=True)

    def test_client_initialization_with_auth(self):
        """Test client initialization with authentication"""
        with patch("metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect") as mock_kafka_connect:
            mock_auth_config = MagicMock()
            mock_auth_config.username = "user"
            mock_auth_config.password.get_secret_value.return_value = "pass"
            self.mock_config.KafkaConnectConfig = mock_auth_config

            client = KafkaConnectClient(self.mock_config)  # noqa: F841

            mock_kafka_connect.assert_called_once_with(url="http://localhost:8083", auth="user:pass", ssl_verify=True)

    def test_get_cluster_info(self):
        """Test get_cluster_info method"""
        with patch("metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect") as mock_kafka_connect:
            client = KafkaConnectClient(self.mock_config)
            mock_client = mock_kafka_connect.return_value
            mock_client.get_cluster_info.return_value = {"version": "3.0.0"}

            result = client.get_cluster_info()

            mock_client.get_cluster_info.assert_called_once()
            self.assertEqual(result, {"version": "3.0.0"})


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
        client.get_connector_config = Mock(return_value={"topics": "topic1,topic2,topic3"})

        topics = client.get_connector_topics("test-connector")
        self.assertIsNotNone(topics)
        self.assertEqual(len(topics), 3)
        self.assertEqual(topics[0].name, "topic1")
        self.assertEqual(topics[1].name, "topic2")
        self.assertEqual(topics[2].name, "topic3")


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
        dataset = KafkaConnectDatasetDetails(table="users", database="mydb", column_mappings=mappings)

        self.assertEqual(len(dataset.column_mappings), 2)
        self.assertEqual(dataset.column_mappings[0].source_column, "id")
        self.assertEqual(dataset.column_mappings[0].target_column, "user_id")

    def test_dataset_details_column_mappings_default(self):
        """Test KafkaConnectDatasetDetails column_mappings defaults to empty list"""
        dataset = KafkaConnectDatasetDetails(table="users")
        self.assertEqual(dataset.column_mappings, [])

    def test_extract_column_mappings_with_smt_renames(self):
        """Test extract_column_mappings with SMT ReplaceField transform"""
        with patch("metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"):
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
        with patch("metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"):
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
        with patch("metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"):
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
        with patch("metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"):
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

    def test_column_lineage_failure_gracefully_handled(self):
        """Test that column lineage building handles errors gracefully"""
        from metadata.generated.schema.entity.data.table import Table
        from metadata.ingestion.source.pipeline.kafkaconnect.metadata import (
            KafkaconnectSource,
        )

        with patch("metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"):
            # Create a minimal source instance
            mock_config = MagicMock(spec=KafkaConnectConnection)
            mock_config.hostPort = "http://localhost:8083"
            mock_config.verifySSL = True
            mock_config.KafkaConnectConfig = None
            mock_config.messagingServiceName = "test_kafka"

            mock_metadata = Mock()  # noqa: F841

            # Create source with minimal setup - we're only testing build_column_lineage
            source = Mock(spec=KafkaconnectSource)
            source._get_topic_field_fqn = KafkaconnectSource._get_topic_field_fqn.__get__(source, KafkaconnectSource)
            source.build_column_lineage = KafkaconnectSource.build_column_lineage.__get__(source, KafkaconnectSource)

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

            dataset_details = KafkaConnectDatasetDetails(table="users", database="mydb")

            # Test column lineage build - should return None gracefully without raising
            result = source.build_column_lineage(
                from_entity=mock_table_entity,
                to_entity=mock_topic_entity,
                topic_entity=mock_topic_entity,
                pipeline_details=pipeline_details,
                dataset_details=dataset_details,
            )

            # Should return None when no column lineage can be built
            self.assertIsNone(result)


class TestCDCTopicParsing(TestCase):
    """Test CDC topic name parsing functionality"""

    def test_parse_cdc_topic_three_parts_standard(self):
        """Test parsing CDC topic with 3 parts: {server}.{database}.{table}"""
        from metadata.ingestion.source.pipeline.kafkaconnect.client import (
            parse_cdc_topic_name,
        )

        result = parse_cdc_topic_name("MysqlKafkaV2.ecommerce.orders", "MysqlKafkaV2")
        self.assertEqual(result, {"database": "ecommerce", "table": "orders"})

    def test_parse_cdc_topic_three_parts_postgres(self):
        """Test parsing PostgreSQL CDC topic with schema.database.table"""
        from metadata.ingestion.source.pipeline.kafkaconnect.client import (
            parse_cdc_topic_name,
        )

        result = parse_cdc_topic_name("PostgresKafkaCDC.public.orders", "PostgresKafkaCDC")
        self.assertEqual(result, {"database": "public", "table": "orders"})

    def test_parse_cdc_topic_two_parts(self):
        """Test parsing CDC topic with 2 parts: {database}.{table}"""
        from metadata.ingestion.source.pipeline.kafkaconnect.client import (
            parse_cdc_topic_name,
        )

        result = parse_cdc_topic_name("ecommerce.customers")
        self.assertEqual(result, {"database": "ecommerce", "table": "customers"})

    def test_parse_cdc_topic_single_part_with_server_name(self):
        """Test parsing CDC topic with 1 part when server name is provided"""
        from metadata.ingestion.source.pipeline.kafkaconnect.client import (
            parse_cdc_topic_name,
        )

        result = parse_cdc_topic_name("orders", "MysqlKafkaV2")
        self.assertEqual(result, {"database": "MysqlKafkaV2", "table": "orders"})

    def test_parse_cdc_topic_single_part_without_server_name(self):
        """Test parsing CDC topic with 1 part without server name returns empty"""
        from metadata.ingestion.source.pipeline.kafkaconnect.client import (
            parse_cdc_topic_name,
        )

        result = parse_cdc_topic_name("orders")
        self.assertEqual(result, {})

    def test_parse_cdc_topic_skip_internal_topics(self):
        """Test that internal topics are skipped"""
        from metadata.ingestion.source.pipeline.kafkaconnect.client import (
            parse_cdc_topic_name,
        )

        # Kafka internal topics
        self.assertEqual(parse_cdc_topic_name("_schemas"), {})
        self.assertEqual(parse_cdc_topic_name("__consumer_offsets"), {})
        self.assertEqual(parse_cdc_topic_name("dbhistory.mysql"), {})

    def test_parse_cdc_topic_empty_input(self):
        """Test parsing empty topic name returns empty dict"""
        from metadata.ingestion.source.pipeline.kafkaconnect.client import (
            parse_cdc_topic_name,
        )

        result = parse_cdc_topic_name("")
        self.assertEqual(result, {})

        result = parse_cdc_topic_name(None)
        self.assertEqual(result, {})

    def test_parse_cdc_topic_case_insensitive_server_match(self):
        """Test that server name matching is case-insensitive"""
        from metadata.ingestion.source.pipeline.kafkaconnect.client import (
            parse_cdc_topic_name,
        )

        # Three part topic with different case
        result = parse_cdc_topic_name("mysqlkafkav2.ecommerce.orders", "MysqlKafkaV2")
        self.assertEqual(result, {"database": "ecommerce", "table": "orders"})

        # Two part topic with different case
        result = parse_cdc_topic_name("mysqlkafkav2.orders", "MysqlKafkaV2")
        self.assertEqual(result, {"database": "mysqlkafkav2", "table": "orders"})

    def test_parse_cdc_topic_sql_server_pattern(self):
        """Test parsing SQL Server CDC topic patterns"""
        from metadata.ingestion.source.pipeline.kafkaconnect.client import (
            parse_cdc_topic_name,
        )

        # SQL Server typically uses dbo schema
        result = parse_cdc_topic_name("SqlServerCDC.dbo.users", "SqlServerCDC")
        self.assertEqual(result, {"database": "dbo", "table": "users"})

    def test_parse_cdc_topic_mongodb_pattern(self):
        """Test parsing MongoDB CDC topic patterns"""
        from metadata.ingestion.source.pipeline.kafkaconnect.client import (
            parse_cdc_topic_name,
        )

        # MongoDB uses database.collection
        result = parse_cdc_topic_name("MongoCDC.mydb.users", "MongoCDC")
        self.assertEqual(result, {"database": "mydb", "table": "users"})

    def test_parse_cdc_topic_server_name_with_dots(self):
        """Test parsing CDC topics when server name contains dots"""
        from metadata.ingestion.source.pipeline.kafkaconnect.client import (
            parse_cdc_topic_name,
        )

        # Server name with dots: myapp.payments.prod
        # Full topic: myapp.payments.prod.transactions.orders
        # Expected: database=transactions, table=orders
        result = parse_cdc_topic_name("myapp.payments.prod.transactions.orders", "myapp.payments.prod")
        self.assertEqual(result, {"database": "transactions", "table": "orders"})

        # Server name with dots and only table (no schema)
        # Full topic: myapp.payments.prod.users
        # Expected: database=myapp.payments.prod, table=users
        result = parse_cdc_topic_name("myapp.payments.prod.users", "myapp.payments.prod")
        self.assertEqual(result, {"database": "myapp.payments.prod", "table": "users"})

        # Multiple level server name
        # Server: app.service.env.region
        # Topic: app.service.env.region.schema1.table1
        result = parse_cdc_topic_name("app.service.env.region.schema1.table1", "app.service.env.region")
        self.assertEqual(result, {"database": "schema1", "table": "table1"})


class TestKafkaConnectCDCColumnExtraction(TestCase):
    """Test CDC column extraction from Debezium schema"""

    def _create_mock_source(self):
        """Helper to create a minimal mock source for testing"""
        from metadata.ingestion.source.pipeline.kafkaconnect.metadata import (
            KafkaconnectSource,
        )

        # Create a mock source that bypasses __init__
        source = object.__new__(KafkaconnectSource)
        return source  # noqa: RET504

    def setUp(self):
        """Set up test fixtures"""
        # Create a mock Debezium CDC topic with nested envelope structure
        self.cdc_topic = MagicMock()
        self.cdc_topic.name = "MysqlKafkaV2.ecommerce.orders"
        self.cdc_topic.fullyQualifiedName.root = 'KafkaProd."MysqlKafkaV2.ecommerce.orders"'

        # Mock message schema with CDC structure
        self.cdc_topic.messageSchema = MagicMock()
        self.cdc_topic.messageSchema.schemaText = '{"type":"object","title":"MysqlKafkaV2.ecommerce.orders.Envelope","properties":{"op":{"type":"string"},"before":{"oneOf":[{"type":"null"},{"type":"object","properties":{"id":{"type":"integer"},"order_number":{"type":"string"},"customer_name":{"type":"string"}}}]},"after":{"oneOf":[{"type":"null"},{"type":"object","properties":{"id":{"type":"integer"},"order_number":{"type":"string"},"customer_name":{"type":"string"},"customer_email":{"type":"string"},"product_name":{"type":"string"}}}]},"source":{"type":"object","properties":{"version":{"type":"string"}}},"ts_ms":{"type":"integer"}}}'

        # Mock schema fields - single envelope with CDC children
        # Use a helper function to create field names with root attribute
        def create_field_name(name_str):
            name_obj = MagicMock()
            name_obj.root = name_str
            return name_obj

        envelope_field = MagicMock()
        envelope_field.name = create_field_name("MysqlKafkaV2.ecommerce.orders.Envelope")
        envelope_field.fullyQualifiedName.root = (
            'KafkaProd."MysqlKafkaV2.ecommerce.orders".MysqlKafkaV2.ecommerce.orders.Envelope'
        )

        # CDC envelope children
        op_field = MagicMock()
        op_field.name = create_field_name("op")
        op_field.children = None
        op_field.fullyQualifiedName.root = (
            'KafkaProd."MysqlKafkaV2.ecommerce.orders".MysqlKafkaV2.ecommerce.orders.Envelope.op'
        )

        before_field = MagicMock()
        before_field.name = create_field_name("before")
        before_field.children = None
        before_field.fullyQualifiedName.root = (
            'KafkaProd."MysqlKafkaV2.ecommerce.orders".MysqlKafkaV2.ecommerce.orders.Envelope.before'
        )

        after_field = MagicMock()
        after_field.name = create_field_name("after")
        after_field.children = None
        after_field.fullyQualifiedName.root = (
            'KafkaProd."MysqlKafkaV2.ecommerce.orders".MysqlKafkaV2.ecommerce.orders.Envelope.after'
        )

        source_field = MagicMock()
        source_field.name = create_field_name("source")
        source_field.children = [MagicMock()]  # Has children (version field)

        ts_field = MagicMock()
        ts_field.name = create_field_name("ts_ms")
        ts_field.children = None

        envelope_field.children = [
            op_field,
            before_field,
            after_field,
            source_field,
            ts_field,
        ]

        self.cdc_topic.messageSchema.schemaFields = [envelope_field]

    def test_extract_columns_from_cdc_topic(self):
        """Test extracting columns from Debezium CDC topic schema text"""
        source = self._create_mock_source()

        # Extract columns from CDC topic
        columns = source._extract_columns_from_entity(self.cdc_topic)

        # Should extract columns from 'after' field in schema text
        self.assertIsNotNone(columns)
        self.assertIn("id", columns)
        self.assertIn("order_number", columns)
        self.assertIn("customer_name", columns)
        self.assertIn("customer_email", columns)
        self.assertIn("product_name", columns)

        # Should have 5 columns total
        self.assertEqual(len(columns), 5)

    def test_get_topic_field_fqn_for_cdc(self):
        """Test constructing FQN for CDC topic fields"""
        source = self._create_mock_source()

        # Get FQN for a CDC column
        fqn = source._get_topic_field_fqn(self.cdc_topic, "id")

        # Should construct FQN manually for CDC envelope structure
        self.assertIsNotNone(fqn)
        self.assertIn("MysqlKafkaV2.ecommerce.orders.Envelope", fqn)
        self.assertTrue(fqn.endswith(".id"))

    def test_cdc_envelope_detection(self):
        """Test that Debezium CDC envelope is correctly detected"""
        source = self._create_mock_source()

        columns = source._extract_columns_from_entity(self.cdc_topic)

        # Should not return CDC envelope fields (op, before, after, source, ts_ms)
        self.assertNotIn("op", columns)
        self.assertNotIn("before", columns)
        self.assertNotIn("after", columns)
        self.assertNotIn("source", columns)
        self.assertNotIn("ts_ms", columns)

        # Should return actual table columns
        self.assertIn("id", columns)
        self.assertIn("order_number", columns)

    def test_non_cdc_topic_column_extraction(self):
        """Test that non-CDC topics still work correctly"""
        source = self._create_mock_source()

        # Helper to create field names
        def create_field_name(name_str):
            name_obj = MagicMock()
            name_obj.root = name_str
            return name_obj

        # Create a regular (non-CDC) topic
        regular_topic = MagicMock()
        regular_topic.name = create_field_name("orders")
        regular_topic.fullyQualifiedName.root = "KafkaProd.orders"

        # Mock regular fields (not CDC envelope)
        id_field = MagicMock()
        id_field.name = create_field_name("id")
        id_field.children = None
        id_field.fullyQualifiedName.root = "KafkaProd.orders.id"

        name_field = MagicMock()
        name_field.name = create_field_name("customer_name")
        name_field.children = None
        name_field.fullyQualifiedName.root = "KafkaProd.orders.customer_name"

        regular_topic.messageSchema = MagicMock()
        regular_topic.messageSchema.schemaFields = [id_field, name_field]

        columns = source._extract_columns_from_entity(regular_topic)

        # Should extract regular fields
        self.assertEqual(len(columns), 2)
        self.assertIn("id", columns)
        self.assertIn("customer_name", columns)

    def test_cdc_schema_text_missing(self):
        """Test handling CDC topic without schema text"""
        source = self._create_mock_source()

        # Helper to create field names
        def create_field_name(name_str):
            name_obj = MagicMock()
            name_obj.root = name_str
            return name_obj

        # Create CDC topic without schemaText
        cdc_topic_no_text = MagicMock()
        cdc_topic_no_text.name = create_field_name("MysqlKafkaV2.ecommerce.orders")

        # CDC envelope structure but no schemaText
        envelope_field = MagicMock()
        envelope_field.name = create_field_name("MysqlKafkaV2.ecommerce.orders.Envelope")

        op_field = MagicMock()
        op_field.name = create_field_name("op")
        op_field.children = None

        before_field = MagicMock()
        before_field.name = create_field_name("before")
        before_field.children = None

        after_field = MagicMock()
        after_field.name = create_field_name("after")
        after_field.children = None

        envelope_field.children = [op_field, before_field, after_field]

        cdc_topic_no_text.messageSchema = MagicMock()
        cdc_topic_no_text.messageSchema.schemaText = None  # No schema text
        cdc_topic_no_text.messageSchema.schemaFields = [envelope_field]

        columns = source._extract_columns_from_entity(cdc_topic_no_text)

        # Should return empty list when schema text is not available
        self.assertEqual(columns, [])

    def test_cdc_with_before_field(self):
        """Test CDC extraction prefers 'after' but falls back to 'before'"""
        source = self._create_mock_source()

        # Create CDC topic with only 'before' field having data (after only has null)
        cdc_topic_before = MagicMock()
        cdc_topic_before.name = "Test.cdc.topic"
        cdc_topic_before.fullyQualifiedName.root = "KafkaProd.Test.cdc.topic"

        cdc_topic_before.messageSchema = MagicMock()
        cdc_topic_before.messageSchema.schemaText = '{"type":"object","properties":{"op":{"type":"string"},"before":{"oneOf":[{"type":"null"},{"type":"object","properties":{"field1":{"type":"string"},"field2":{"type":"integer"}}}]},"after":{"oneOf":[{"type":"null"}]}}}'
        cdc_topic_before.messageSchema.schemaFields = []

        columns = source._extract_columns_from_entity(cdc_topic_before)

        # Should extract from 'before' field when 'after' only has null
        self.assertIn("field1", columns)
        self.assertIn("field2", columns)


class TestKafkaConnectLineageRefactoring(TestCase):
    """Test refactored lineage methods"""

    def setUp(self):
        """Set up test fixtures"""
        from metadata.generated.schema.metadataIngestion.workflow import (
            Source as WorkflowSource,
        )
        from metadata.ingestion.source.pipeline.kafkaconnect.metadata import (
            KafkaconnectSource,
        )

        self.mock_metadata = MagicMock()
        self.mock_config = MagicMock(spec=WorkflowSource)
        self.mock_service_connection = MagicMock(spec=KafkaConnectConnection)
        self.mock_service_connection.hostPort = "http://localhost:8083"

        with patch("metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"):
            self.source = object.__new__(KafkaconnectSource)
            self.source.metadata = self.mock_metadata
            self.source.service_connection = self.mock_service_connection

    def test_resolve_messaging_service_from_config(self):
        """Test resolving messaging service from connector config match"""
        pipeline_details = KafkaConnectPipelineDetails(name="test-connector", conn_type="source")

        with patch.object(
            self.source,
            "get_service_from_connector_config",
            return_value=ServiceResolutionResult(
                database_service_name=None,
                messaging_service_name="matched-kafka-service",
            ),
        ):
            result = self.source._resolve_messaging_service(pipeline_details)

            self.assertEqual(result, "matched-kafka-service")

    def test_resolve_messaging_service_from_connection(self):
        """Test resolving messaging service from service connection"""
        pipeline_details = KafkaConnectPipelineDetails(name="test-connector", conn_type="source")

        self.mock_service_connection.messagingServiceName = "configured-kafka-service"

        with patch.object(
            self.source,
            "get_service_from_connector_config",
            return_value=ServiceResolutionResult(database_service_name=None, messaging_service_name=None),
        ):
            result = self.source._resolve_messaging_service(pipeline_details)

            self.assertEqual(result, "configured-kafka-service")

    def test_resolve_messaging_service_none(self):
        """Test resolving messaging service when neither config nor connection available"""
        pipeline_details = KafkaConnectPipelineDetails(name="test-connector", conn_type="source")

        delattr(self.mock_service_connection, "messagingServiceName")

        with patch.object(
            self.source,
            "get_service_from_connector_config",
            return_value=ServiceResolutionResult(database_service_name=None, messaging_service_name=None),
        ):
            result = self.source._resolve_messaging_service(pipeline_details)

            self.assertIsNone(result)

    def test_parse_and_resolve_topics_explicit_list(self):
        """Test topic resolution with explicit pipeline_details.topics"""

        topic1 = KafkaConnectTopics(name="test-topic-1")
        pipeline_details = KafkaConnectPipelineDetails(name="test-connector", conn_type="source", topics=[topic1])

        mock_topic_entity = MagicMock(spec=Topic)
        mock_topic_entity.id = "topic-id-1"
        mock_topic_entity.name = "test-topic-1"
        mock_topic_entity.fullyQualifiedName = 'KafkaProd."test-topic-1"'
        mock_topic_entity.service = MagicMock(spec=EntityReference)
        mock_topic_entity.service.name = "KafkaProd"

        with patch.object(self.source.metadata, "get_by_name", return_value=None):  # noqa: SIM117
            with patch.object(
                self.source.metadata,
                "search_in_any_service",
                return_value=mock_topic_entity,
            ):
                result = self.source._parse_and_resolve_topics(
                    pipeline_details=pipeline_details,
                    database_server_name=None,
                    effective_messaging_service=None,
                    is_storage_sink=False,
                )

                self.assertEqual(len(result.topics), 1)
                self.assertEqual(result.topics[0].name, "test-topic-1")
                self.assertIn("test-topic-1", result.topic_entity_map)
                self.assertEqual(result.topic_entity_map["test-topic-1"], mock_topic_entity)

    def test_parse_and_resolve_topics_with_fqn(self):
        """Test topic resolution using pre-built FQN"""

        topic_with_fqn = KafkaConnectTopics(name="test-topic", fqn='KafkaProd."test-topic"')
        pipeline_details = KafkaConnectPipelineDetails(
            name="test-connector", conn_type="source", topics=[topic_with_fqn]
        )

        mock_topic_entity = MagicMock(spec=Topic)

        with patch.object(self.source.metadata, "get_by_name", return_value=mock_topic_entity) as mock_get:
            result = self.source._parse_and_resolve_topics(
                pipeline_details=pipeline_details,
                database_server_name=None,
                effective_messaging_service=None,
                is_storage_sink=False,
            )

            mock_get.assert_called_once()
            self.assertEqual(result.topic_entity_map["test-topic"], mock_topic_entity)

    def test_parse_and_resolve_topics_with_service(self):
        """Test topic resolution using messaging service name"""

        topic = KafkaConnectTopics(name="orders-topic")
        pipeline_details = KafkaConnectPipelineDetails(name="test-connector", conn_type="source", topics=[topic])

        mock_topic_entity = MagicMock(spec=Topic)

        with patch("metadata.utils.fqn.build", return_value='KafkaProd."orders-topic"'):  # noqa: SIM117
            with patch.object(self.source.metadata, "get_by_name", return_value=mock_topic_entity) as mock_get:
                result = self.source._parse_and_resolve_topics(
                    pipeline_details=pipeline_details,
                    database_server_name=None,
                    effective_messaging_service="KafkaProd",
                    is_storage_sink=False,
                )

                mock_get.assert_called_once()
                self.assertEqual(result.topic_entity_map["orders-topic"], mock_topic_entity)

    def test_parse_and_resolve_topics_cross_service_search(self):
        """Test topic resolution via cross-service wildcard search"""

        topic = KafkaConnectTopics(name="payments-topic")
        pipeline_details = KafkaConnectPipelineDetails(name="test-connector", conn_type="source", topics=[topic])

        mock_topic_entity = MagicMock(spec=Topic)
        mock_service = MagicMock()
        mock_service.name = "KafkaDev"
        mock_topic_entity.service = mock_service

        with patch.object(
            self.source.metadata,
            "search_in_any_service",
            return_value=mock_topic_entity,
        ) as mock_search:
            result = self.source._parse_and_resolve_topics(
                pipeline_details=pipeline_details,
                database_server_name=None,
                effective_messaging_service=None,
                is_storage_sink=False,
            )

            mock_search.assert_called_once()
            self.assertEqual(result.topic_entity_map["payments-topic"], mock_topic_entity)

    def test_parse_and_resolve_topics_cdc_from_config(self):
        """Test CDC topic parsing from table.include.list"""
        cdc_topics = [
            KafkaConnectTopics(name="pg.inventory.public.users"),
            KafkaConnectTopics(name="pg.inventory.public.orders"),
        ]

        pipeline_details = KafkaConnectPipelineDetails(
            name="cdc-connector",
            conn_type="source",
            config={"table.include.list": "public.users,public.orders"},
            topics=cdc_topics,
        )

        with patch.object(self.source.metadata, "get_by_name", return_value=None):  # noqa: SIM117
            with patch.object(self.source.metadata, "search_in_any_service", return_value=None):
                result = self.source._parse_and_resolve_topics(
                    pipeline_details=pipeline_details,
                    database_server_name="pg.inventory",
                    effective_messaging_service=None,
                    is_storage_sink=False,
                )

                self.assertEqual(len(result.topics), 2)
                self.assertEqual(result.topics[0].name, "pg.inventory.public.users")
                self.assertEqual(result.topics[1].name, "pg.inventory.public.orders")

    def test_parse_and_resolve_topics_prefix_search(self):
        """Test CDC topic discovery by database.server.name prefix"""
        prefix_topics = [
            KafkaConnectTopics(name="mysql.db.table1"),
            KafkaConnectTopics(name="mysql.db.table2"),
        ]

        pipeline_details = KafkaConnectPipelineDetails(
            name="cdc-connector", conn_type="source", config={}, topics=prefix_topics
        )

        with patch.object(self.source.metadata, "get_by_name", return_value=None):  # noqa: SIM117
            with patch.object(
                self.source.metadata,
                "search_in_any_service",
                return_value=None,
            ):
                result = self.source._parse_and_resolve_topics(
                    pipeline_details=pipeline_details,
                    database_server_name="mysql",
                    effective_messaging_service="KafkaProd",
                    is_storage_sink=False,
                )

                self.assertEqual(len(result.topics), 2)
                self.assertIn("mysql.db.table1", result.topic_entity_map)
                self.assertIn("mysql.db.table2", result.topic_entity_map)

    def test_parse_and_resolve_topics_regex_storage_sink(self):
        """Test storage sink topic discovery by topics.regex"""
        pipeline_details = KafkaConnectPipelineDetails(
            name="s3-sink",
            conn_type="sink",
            config={"topics.regex": "analytics-.*"},
        )

        regex_topics = [
            KafkaConnectTopics(name="analytics-events"),
            KafkaConnectTopics(name="analytics-metrics"),
        ]

        with patch.object(self.source, "_search_topics_by_regex", return_value=regex_topics) as mock_search:  # noqa: SIM117
            with patch.object(self.source.metadata, "get_by_name", return_value=None):
                with patch.object(self.source.metadata, "search_in_any_service", return_value=None):
                    result = self.source._parse_and_resolve_topics(
                        pipeline_details=pipeline_details,
                        database_server_name=None,
                        effective_messaging_service="KafkaProd",
                        is_storage_sink=True,
                    )

                    mock_search.assert_called_once_with(
                        topics_regex="analytics-.*",
                        messaging_service_name="KafkaProd",
                    )
                    self.assertEqual(len(result.topics), 2)


_SEARCH_CONTAINER = "metadata.ingestion.source.pipeline.kafkaconnect.metadata.fqn.search_container_from_es"
_FQN_BUILD = "metadata.ingestion.source.pipeline.kafkaconnect.metadata.fqn.build"
_STATIC_FQN = "DearlakeS3.dear-lake-stg.raw_kafka"


class TestGetDatasetEntityContainerSearch:
    """
    Tests for the container entity lookup in get_dataset_entity(), covering both the
    exact-FQN fast path and the prefix-wildcard fallback introduced to handle containers
    whose names include a topic-name suffix (e.g. raw_kafka/topic-01.v1).
    """

    def _make_source(self):
        from metadata.ingestion.source.pipeline.kafkaconnect.metadata import (
            KafkaconnectSource,
        )

        source = object.__new__(KafkaconnectSource)
        source.metadata = MagicMock()
        source.service_connection = MagicMock(spec=KafkaConnectConnection)
        source.service_connection.hostPort = "http://localhost:8083"
        return source

    def _make_pipeline(self):
        return KafkaConnectPipelineDetails(name="s3-sink", conn_type="sink")

    def test_exact_match_returned_without_prefix_search(self):
        """Exact FQN hit → prefix-search fallback must never be triggered."""
        source = self._make_source()
        pipeline = self._make_pipeline()
        dataset = KafkaConnectDatasetDetails(container_name="raw_kafka", parent_container="dear-lake-stg")

        mock_container = MagicMock()
        source.metadata.get_by_name = MagicMock(return_value=mock_container)

        with patch(_FQN_BUILD, return_value=_STATIC_FQN):  # noqa: SIM117
            with patch(_SEARCH_CONTAINER) as mock_search:
                with patch.object(source, "get_storage_service_names", return_value=["DearlakeS3"]):
                    result = source.get_dataset_entity(pipeline, dataset)

        assert result is mock_container
        mock_search.assert_not_called()

    def test_prefix_search_used_when_exact_match_fails(self):
        """When get_by_name returns None, search_container_from_es must be attempted."""
        source = self._make_source()
        pipeline = self._make_pipeline()
        dataset = KafkaConnectDatasetDetails(container_name="raw_kafka", parent_container="dear-lake-stg")

        mock_container = MagicMock()
        mock_container.fullyQualifiedName.root = "DearlakeS3.dear-lake-stg.raw_kafka/topic-01.v1"
        source.metadata.get_by_name = MagicMock(return_value=None)

        with patch(_FQN_BUILD, return_value=_STATIC_FQN):  # noqa: SIM117
            with patch(_SEARCH_CONTAINER, return_value=mock_container) as mock_search:
                with patch.object(source, "get_storage_service_names", return_value=[None]):
                    result = source.get_dataset_entity(pipeline, dataset)

        assert result is mock_container
        mock_search.assert_called_once()

    def test_container_with_topic_suffix_found_via_prefix_search(self):
        """
        Core bug scenario: bucket=dear-lake-stg, prefix=raw_kafka, topic=topic-01.v1.
        The ingested container FQN ends with raw_kafka/topic-01.v1 — exact match fails
        and the fallback must be called with container_name='raw_kafka*' so that
        Elasticsearch prefix-matches the suffixed FQN.
        """
        source = self._make_source()
        pipeline = self._make_pipeline()
        dataset = KafkaConnectDatasetDetails(container_name="raw_kafka", parent_container="dear-lake-stg")

        container_with_suffix = MagicMock()
        container_with_suffix.fullyQualifiedName.root = "DearlakeS3.dear-lake-stg.raw_kafka/topic-01.v1"
        source.metadata.get_by_name = MagicMock(return_value=None)

        with patch(_FQN_BUILD, return_value=_STATIC_FQN):  # noqa: SIM117
            with patch(_SEARCH_CONTAINER, return_value=container_with_suffix) as mock_search:
                with patch.object(source, "get_storage_service_names", return_value=["DearlakeS3"]):
                    result = source.get_dataset_entity(pipeline, dataset)

        assert result is container_with_suffix
        mock_search.assert_called_once_with(
            metadata=source.metadata,
            container_name="raw_kafka*",
            service_name="DearlakeS3",
            parent_container="dear-lake-stg",
        )

    def test_prefix_search_passes_parent_container(self):
        """search_container_from_es must receive parent_container when it is set."""
        source = self._make_source()
        pipeline = self._make_pipeline()
        dataset = KafkaConnectDatasetDetails(container_name="raw_kafka", parent_container="dear-lake-stg")

        source.metadata.get_by_name = MagicMock(return_value=None)

        with patch(_FQN_BUILD, return_value=_STATIC_FQN):  # noqa: SIM117
            with patch(_SEARCH_CONTAINER, return_value=None) as mock_search:
                with patch.object(source, "get_storage_service_names", return_value=[None]):
                    source.get_dataset_entity(pipeline, dataset)

        _, call_kwargs = mock_search.call_args
        assert call_kwargs["container_name"] == "raw_kafka*"
        assert call_kwargs["parent_container"] == "dear-lake-stg"

    def test_prefix_search_without_parent_container(self):
        """search_container_from_es must still be called when parent_container is absent."""
        source = self._make_source()
        pipeline = self._make_pipeline()
        dataset = KafkaConnectDatasetDetails(container_name="raw_kafka")

        source.metadata.get_by_name = MagicMock(return_value=None)

        with patch(_FQN_BUILD, return_value="DearlakeS3.raw_kafka"):  # noqa: SIM117
            with patch(_SEARCH_CONTAINER, return_value=None) as mock_search:
                with patch.object(source, "get_storage_service_names", return_value=[None]):
                    source.get_dataset_entity(pipeline, dataset)

        _, call_kwargs = mock_search.call_args
        assert call_kwargs["container_name"] == "raw_kafka*"
        assert call_kwargs["parent_container"] is None

    def test_prefix_search_scoped_to_configured_storage_service(self):
        """When a specific storage service is configured it is forwarded as service_name."""
        source = self._make_source()
        pipeline = self._make_pipeline()
        dataset = KafkaConnectDatasetDetails(container_name="raw_kafka", parent_container="dear-lake-stg")

        source.metadata.get_by_name = MagicMock(return_value=None)

        with patch(_FQN_BUILD, return_value=_STATIC_FQN):  # noqa: SIM117
            with patch(_SEARCH_CONTAINER, return_value=None) as mock_search:
                with patch.object(source, "get_storage_service_names", return_value=["DearlakeS3"]):
                    source.get_dataset_entity(pipeline, dataset)

        _, call_kwargs = mock_search.call_args
        assert call_kwargs["service_name"] == "DearlakeS3"

    def test_returns_none_when_both_searches_fail(self):
        """If neither exact match nor prefix search finds anything, None is returned."""
        source = self._make_source()
        pipeline = self._make_pipeline()
        dataset = KafkaConnectDatasetDetails(container_name="raw_kafka", parent_container="dear-lake-stg")

        source.metadata.get_by_name = MagicMock(return_value=None)

        with patch(_FQN_BUILD, return_value=_STATIC_FQN):  # noqa: SIM117
            with patch(_SEARCH_CONTAINER, return_value=None):
                with patch.object(source, "get_storage_service_names", return_value=[None]):
                    result = source.get_dataset_entity(pipeline, dataset)

        assert result is None

    def test_prefix_search_not_attempted_when_no_container_name(self):
        """If container_name is absent, the prefix search block must be skipped."""
        source = self._make_source()
        pipeline = self._make_pipeline()
        dataset = KafkaConnectDatasetDetails(parent_container="dear-lake-stg")

        source.metadata.get_by_name = MagicMock(return_value=None)

        with patch(_FQN_BUILD, return_value=None):  # noqa: SIM117
            with patch(_SEARCH_CONTAINER) as mock_search:
                with patch.object(source, "get_storage_service_names", return_value=[None]):
                    source.get_dataset_entity(pipeline, dataset)

        mock_search.assert_not_called()


class TestKafkaConnectTopicRoutingTransforms(TestCase):
    """
    Tests for topic-routing SMTs (RegexRouter / TopicRegexRouter and Debezium
    outbox EventRouter) that rewrite the destination topic name.

    Regression coverage for the case where a statically-constructed CDC topic
    name never matches the real post-transform topic, so lineage is skipped.
    See https://github.com/open-metadata/OpenMetadata/issues/27901.
    """

    def _make_source(self):
        from metadata.ingestion.source.pipeline.kafkaconnect.metadata import (
            KafkaconnectSource,
        )

        source = object.__new__(KafkaconnectSource)
        source._topics_cache = {}
        source.metadata = MagicMock()
        return source

    @staticmethod
    def _topic(name):
        topic = SimpleNamespace()
        topic.name = SimpleNamespace(root=name)
        topic.fullyQualifiedName = SimpleNamespace(root=f'Kafka."{name}"')
        return topic

    def test_apply_regex_router_rewrites_topic_name(self):
        """RegexRouter must rewrite the constructed topic name deterministically."""
        from metadata.ingestion.source.pipeline.kafkaconnect.client import (
            apply_topic_routing_transforms,
        )

        config = {
            "transforms": "route",
            "transforms.route.type": "org.apache.kafka.connect.transforms.RegexRouter",
            "transforms.route.regex": r"ecommerce\.sales\.prod\.sales\.(.*)",
            "transforms.route.replacement": "prod.global.sales.$1",
        }

        result = apply_topic_routing_transforms("ecommerce.sales.prod.sales.outbox", config)

        assert result == "prod.global.sales.outbox"

    def test_apply_confluent_topic_regex_router(self):
        """The Confluent Cloud TopicRegexRouter class must be identified and applied."""
        from metadata.ingestion.source.pipeline.kafkaconnect.client import (
            apply_topic_routing_transforms,
        )

        config = {
            "transforms": "route",
            "transforms.route.type": "io.confluent.connect.cloud.transforms.TopicRegexRouter",
            "transforms.route.regex": r"outbox\.event\.(.*)",
            "transforms.route.replacement": "prod.global.sales.$1",
        }

        result = apply_topic_routing_transforms("outbox.event.orderCreated", config)

        assert result == "prod.global.sales.orderCreated"

    def test_apply_topic_routing_transforms_noop_without_transforms(self):
        """With no transforms configured the name is returned unchanged."""
        from metadata.ingestion.source.pipeline.kafkaconnect.client import (
            apply_topic_routing_transforms,
        )

        assert apply_topic_routing_transforms("a.b.c", {}) == "a.b.c"

    def test_apply_regex_router_invalid_regex_returns_original(self):
        """An invalid regex must not raise; the original name is preserved."""
        from metadata.ingestion.source.pipeline.kafkaconnect.client import (
            apply_topic_routing_transforms,
        )

        config = {
            "transforms": "route",
            "transforms.route.type": "org.apache.kafka.connect.transforms.RegexRouter",
            "transforms.route.regex": r"([",  # unbalanced group
            "transforms.route.replacement": "x",
        }

        assert apply_topic_routing_transforms("a.b.c", config) == "a.b.c"

    def test_parse_cdc_topics_applies_regex_router(self):
        """CDC topics constructed from table.include.list must have SMTs applied."""
        config = {
            "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
            "topic.prefix": "ecommerce.sales",
            "table.include.list": "prod.sales.outbox",
            "transforms": "route",
            "transforms.route.type": "org.apache.kafka.connect.transforms.RegexRouter",
            "transforms.route.regex": r"ecommerce\.sales\.prod\.sales\.(.*)",
            "transforms.route.replacement": "prod.global.sales.$1",
        }
        details = KafkaConnectPipelineDetails(name="outbox-connector", type="source", config=config)
        source = self._make_source()

        topics = source._parse_cdc_topics_from_config(details, "ecommerce.sales")

        assert [t.name for t in topics] == ["prod.global.sales.outbox"]

    def test_apply_regex_router_named_group(self):
        """Java named groups (?<name>...) with ${name} replacement convert and apply."""
        from metadata.ingestion.source.pipeline.kafkaconnect.client import (
            apply_topic_routing_transforms,
        )

        config = {
            "transforms": "route",
            "transforms.route.type": "org.apache.kafka.connect.transforms.RegexRouter",
            "transforms.route.regex": r"outbox\.event\.(?<agg>.*)",
            "transforms.route.replacement": "prod.global.${agg}_v1",
        }

        assert apply_topic_routing_transforms("outbox.event.orderCreated", config) == "prod.global.orderCreated_v1"

    def test_outbox_fanout_identifies_outbox_table_by_event_columns(self):
        """In a multi-table connector only the table with the full outbox schema fans out."""
        from metadata.generated.schema.entity.data.table import Column, DataType, Table

        config = {
            "transforms": "outbox",
            "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
        }
        source = self._make_source()
        pipeline = SimpleNamespace(config=config)
        outbox = Table.model_construct(
            columns=[
                Column(name="id", dataType=DataType.BIGINT),
                Column(name="aggregatetype", dataType=DataType.VARCHAR),
                Column(name="aggregateid", dataType=DataType.VARCHAR),
                Column(name="payload", dataType=DataType.JSON),
            ]
        )
        # A normal table that happens to share one outbox column must NOT be treated as outbox.
        orders = Table.model_construct(
            columns=[
                Column(name="id", dataType=DataType.BIGINT),
                Column(name="aggregatetype", dataType=DataType.VARCHAR),
                Column(name="total", dataType=DataType.BIGINT),
            ]
        )
        topics = {"prod.global.sales.orderCreated_v1": object()}

        # Multi-table: only the table with the full outbox schema fans out.
        assert source._is_outbox_fanout(pipeline, outbox, topics, single_dataset=False) is True
        assert source._is_outbox_fanout(pipeline, orders, topics, single_dataset=False) is False
        # Single-table connector is unambiguously the outbox.
        assert source._is_outbox_fanout(pipeline, orders, topics, single_dataset=True) is True


class TestKafkaConnectTransformLineageEdges(TestCase):
    """
    End-to-end coverage that transformed topics actually produce lineage edges
    (AddLineageRequest) from the source table, not just resolve to Topic entities.

    Drives ``yield_pipeline_lineage_details`` with only the OpenMetadata REST
    client and ingestion context mocked; topic resolution, topic-to-dataset
    matching, and edge construction all run for real.
    See https://github.com/open-metadata/OpenMetadata/issues/27901.
    """

    @staticmethod
    def _entity(entity_cls, fqn):
        return entity_cls.model_construct(
            id=uuid4(),
            name=fqn.split(".")[-1].strip('"'),
            fullyQualifiedName=fqn,
            service=None,
        )

    @staticmethod
    def _ingested_topic(name):
        return SimpleNamespace(
            name=SimpleNamespace(root=name),
            fullyQualifiedName=SimpleNamespace(root=f'Kafka."{name}"'),
        )

    def _run_lineage(self, config, ingested_topic_names, pipeline_topics=None, resolvable_in_om=True):
        from metadata.generated.schema.entity.data.table import Table
        from metadata.ingestion.source.pipeline.kafkaconnect.metadata import (
            KafkaconnectSource,
        )

        source = object.__new__(KafkaconnectSource)
        source._topics_cache = {}
        source.lineage_results = []
        source.context = MagicMock()
        source.context.get.return_value = SimpleNamespace(
            pipeline_service="KafkaConnectSvc", pipeline="outbox-connector"
        )
        source._resolve_messaging_service = lambda pipeline_details: "Kafka"
        table_entity = self._entity(Table, "PG.db.prod.sales.outbox")
        source.get_dataset_entity = lambda **kwargs: table_entity
        source.build_column_lineage = lambda **kwargs: None

        pipeline_entity = SimpleNamespace(id=SimpleNamespace(root=uuid4()))
        topics_by_fqn = (
            {f'Kafka."{name}"': self._entity(Topic, f'Kafka."{name}"') for name in ingested_topic_names}
            if resolvable_in_om
            else {}
        )

        def _get_by_name(entity=None, fqn=None, **kwargs):
            entity_name = getattr(entity, "__name__", "")
            if entity_name == "Pipeline":
                return pipeline_entity
            if entity_name == "Topic":
                return topics_by_fqn.get(fqn)
            return None

        def _fqn_build(entity_type=None, service_name=None, topic_name=None, **kwargs):
            entity_name = getattr(entity_type, "__name__", "")
            if entity_name == "Topic":
                return f'{service_name}."{topic_name}"'
            return "KafkaConnectSvc.outbox-connector"

        source.metadata = MagicMock()
        source.metadata.get_by_name.side_effect = _get_by_name
        source.metadata.list_all_entities.return_value = [self._ingested_topic(name) for name in ingested_topic_names]

        details = KafkaConnectPipelineDetails(
            name="outbox-connector",
            type="source",
            config=config,
            topics=[KafkaConnectTopics(name=name) for name in (pipeline_topics or [])],
        )

        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.metadata.fqn.build",
            side_effect=_fqn_build,
        ):
            results = list(source.yield_pipeline_lineage_details(details))

        errors = [r.left for r in results if r.left is not None]
        assert not errors, f"lineage yielded errors: {errors}"
        self.last_source = source
        return table_entity, [r.right for r in results if r.right is not None]

    def test_outbox_event_router_without_runtime_topics_yields_no_edges(self):
        """
        A routing pattern must not be used to find the outbox topics. It matches a
        namespace, and two connectors routing into one namespace produce the same
        pattern while owning disjoint topics, so generating from it hands each of them
        the other's edges.

        Without the runtime's active-topic list there is nothing to attribute, so the
        connector emits nothing. ``test_outbox_event_router_yields_edges_from_connector_topics``
        covers the case where the runtime does supply them.
        """
        config = {
            "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
            "topic.prefix": "ecommerce.sales",
            "table.include.list": "prod.sales.outbox",
            "transforms": "outbox",
            "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
            "transforms.outbox.route.topic.replacement": "prod.global.sales.${routedByValue}_v1",
        }
        ingested = [
            "prod.global.sales.orderCreated_v1",
            "prod.global.sales.orderCancelled_v1",
            "unrelated.topic",
        ]

        _, edges = self._run_lineage(config, ingested)

        assert edges == []

    def test_outbox_event_router_yields_edges_from_connector_topics(self):
        """
        Live path: Kafka Connect's /topics reports the post-transform topics, so
        they arrive pre-populated on the connector rather than via pattern search.
        The outbox fan-out must still emit an edge per topic.
        """
        config = {
            "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
            "topic.prefix": "ecommerce.sales",
            "table.include.list": "prod.sales.outbox",
            "transforms": "outbox",
            "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
            "transforms.outbox.route.topic.replacement": "prod.global.sales.${routedByValue}_v1",
        }
        routed = ["prod.global.sales.orderCreated_v1", "prod.global.sales.orderCancelled_v1"]

        table_entity, edges = self._run_lineage(config, routed, pipeline_topics=routed)

        assert len(edges) == 2
        for edge in edges:
            assert edge.edge.fromEntity.id.root == table_entity.id
            assert edge.edge.toEntity.type == "topic"

    def test_prefix_scan_matches_one_topic_per_dataset(self):
        """
        The topic.prefix scan returns every topic under the namespace, so what keeps it
        from becoming namespace-membership lineage is the 1:1 match that follows: each
        dataset takes the single topic whose name resolves to it, and the rest are
        dropped. Only an outbox EventRouter fans one table out to many topics, and such
        a connector never reaches the scan.
        """
        config = {
            "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
            "topic.prefix": "ecommerce.sales",
            # `tables` yields a dataset but is not read by _parse_cdc_topics_from_config,
            # so resolution falls through to the namespace scan with a dataset in hand.
            "tables": "prod.sales.orders",
        }
        under_prefix = [
            "ecommerce.sales.prod.sales.orders",
            "ecommerce.sales.prod.sales.customers",
            "ecommerce.sales.prod.sales.payments",
            "ecommerce.sales.transaction",
        ]

        _table_entity, edges = self._run_lineage(config, under_prefix)

        assert len(edges) == 1, "the scan must not fan a dataset out across the namespace"

    def test_multi_table_outbox_connector_does_not_fan_out(self):
        """
        A connector capturing several tables cannot attribute routed topics to a
        specific table, so it must NOT fan the outbox topics out to every table.
        """
        config = {
            "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
            "topic.prefix": "ecommerce.sales",
            "table.include.list": "prod.sales.outbox,prod.sales.orders",
            "transforms": "outbox",
            "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
            "transforms.outbox.route.topic.replacement": "prod.global.sales.${routedByValue}_v1",
        }
        routed = ["prod.global.sales.orderCreated_v1"]

        _table_entity, edges = self._run_lineage(config, routed)

        assert edges == []

    def test_regex_router_yields_lineage_edge(self):
        """A RegexRouter-renamed CDC topic must still match its table and emit an edge."""
        config = {
            "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
            "topic.prefix": "ecommerce.sales",
            "table.include.list": "prod.sales.outbox",
            "transforms": "route",
            "transforms.route.type": "org.apache.kafka.connect.transforms.RegexRouter",
            "transforms.route.regex": r"ecommerce\.sales\.prod\.sales\.(.*)",
            "transforms.route.replacement": "prod.global.sales.$1",
        }
        ingested = ["prod.global.sales.outbox"]

        _table_entity, edges = self._run_lineage(config, ingested)

        assert len(edges) == 1
        assert edges[0].edge.fromEntity.type == "table"
        assert edges[0].edge.toEntity.type == "topic"

    def test_unresolved_outbox_topics_are_reported_not_silently_dropped(self):
        """
        When the routed topics exist in Kafka but are not ingested in OpenMetadata, the
        topic map is {name: None}. That dict is truthy, so the fan-out gate used to fire
        on it, emit nothing, and `continue` - the connector vanished from the run summary
        entirely rather than being reported as a failure.
        """
        config = {
            "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
            "topic.prefix": "ecommerce.sales",
            "table.include.list": "prod.sales.outbox",
            "transforms": "outbox",
            "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
            "transforms.outbox.route.topic.replacement": "prod.global.sales.${routedByValue}_v1",
        }

        _table_entity, edges = self._run_lineage(
            config,
            ["prod.global.sales.orderCreated_v1"],
            resolvable_in_om=False,
        )

        assert edges == []
        assert self.last_source.lineage_results, "connector must be reported, not silently skipped"
        assert self.last_source.lineage_results[0]["status"] == "FAILED"


class TestGetDatasetEntityServiceClass:
    """
    get_dataset_entity() must shape the table FQN according to the *class* of the
    target database service.

    OpenMetadata models multi-database services (Postgres, Redshift, MSSQL, ...) as
    ``service.database.schema.table`` with a real database name, and single-database
    services (MySQL, ClickHouse, MariaDB, ...) as ``service.default.schema.table``.
    Debezium does not make that distinction: ``table.include.list`` always yields the
    schema level, while ``database`` is only meaningful for multi-database sources
    and otherwise falls back to ``topic.prefix`` (a logical server name, not a
    database at all).

    Regression: EarnIn's outbox connectors, where a MySQL topic.prefix such as
    ``earnin.cashout.prod`` was used as the database/schema and every lookup missed,
    leaving 32 of 33 connectors without lineage.
    """

    @staticmethod
    def _connection(service_type, host_port):
        import importlib

        module, cls_name = {
            "Mysql": ("mysqlConnection", "MysqlConnection"),
            "Postgres": ("postgresConnection", "PostgresConnection"),
        }[service_type]
        cls = getattr(
            importlib.import_module(f"metadata.generated.schema.entity.services.connections.database.{module}"),
            cls_name,
        )
        return cls.model_construct(hostPort=host_port)

    def _make_source(self, services, catalog):
        """
        Build a source whose OpenMetadata lookups resolve against ``catalog``, a list
        of ``(service, database, schema, table)`` tuples standing in for ingested
        tables.

        ``fqn.build`` is stubbed to mirror ``fqn._build_table``: an ES lookup
        constrained only by the arguments that are not None, returning None when the
        match is not unique. That keeps the assertion on observable behaviour (was
        the right table found?) rather than on which arguments were passed.
        """
        from metadata.generated.schema.entity.data.table import Table
        from metadata.ingestion.source.pipeline.kafkaconnect.metadata import (
            KafkaconnectSource,
        )

        source = object.__new__(KafkaconnectSource)
        source.metadata = MagicMock()
        source._database_services_cache = [
            SimpleNamespace(
                name=SimpleNamespace(root=name),
                serviceType=SimpleNamespace(value=service_type),
                connection=SimpleNamespace(config=self._connection(service_type, host_port)),
            )
            for name, (service_type, host_port) in services.items()
        ]
        source._messaging_services_cache = []

        entities = {
            ".".join(entry): Table.model_construct(id=uuid4(), name=entry[3], fullyQualifiedName=".".join(entry))
            for entry in catalog
        }

        def _build(
            entity_type=None, table_name=None, database_name=None, schema_name=None, service_name=None, **kwargs
        ):
            # "*" is not a wildcard to fqn._build_table - it is searched literally and misses,
            # which is what makes the cross-service search (Priority 3) the real fallback.
            matched = [
                entry
                for entry in catalog
                if entry[3] == table_name
                and (service_name is None or service_name == entry[0])
                and (database_name is None or database_name == entry[1])
                and (schema_name is None or schema_name == entry[2])
            ]
            return ".".join(matched[0]) if len(matched) == 1 else None

        def _get_by_name(entity=None, fqn=None, **kwargs):
            return entities.get(fqn)

        def _search_in_any_service(entity_type=None, fqn_search_string=None, **kwargs):
            suffix = (fqn_search_string or "").replace('"', "")
            hits = [fqn for fqn in entities if fqn.endswith(f".{suffix}")]
            return entities[hits[0]] if len(hits) == 1 else None

        source.metadata.get_by_name.side_effect = _get_by_name
        source.metadata.search_in_any_service.side_effect = _search_in_any_service
        return source, _build

    @staticmethod
    def _run(source, build, pipeline, dataset, db_service_names=None):
        with (
            patch(
                "metadata.ingestion.source.pipeline.kafkaconnect.metadata.fqn.build",
                side_effect=build,
            ),
            patch.object(source, "get_db_service_names", return_value=db_service_names or []),
        ):
            return source.get_dataset_entity(pipeline, dataset)

    def test_single_database_service_resolves_table_under_default(self):
        """
        MySQL/Debezium: schema='cashout' is the real schema, database='earnin.cashout.prod'
        is only topic.prefix. The table lives at rds-cashout-prod.default.cashout.outbox.
        """
        source, build = self._make_source(
            services={"rds-cashout-prod": ("Mysql", "cashout-prod.cluster-x.us-west-2.rds.amazonaws.com:3306")},
            catalog=[("rds-cashout-prod", "default", "cashout", "outbox")],
        )
        pipeline = KafkaConnectPipelineDetails(
            name="outbox-cashout-prod-v2",
            type="source",
            config={
                "connector.class": "MySqlCdcSourceV2",
                "database.hostname": "cashout-prod.cluster-x.us-west-2.rds.amazonaws.com",
                "topic.prefix": "earnin.cashout.prod",
                "table.include.list": "cashout.outbox",
            },
        )
        dataset = KafkaConnectDatasetDetails(table="outbox", database="earnin.cashout.prod", schema="cashout")

        result = self._run(source, build, pipeline, dataset)

        assert result is not None, "MySQL outbox table must resolve under the 'default' database"
        assert result.fullyQualifiedName == "rds-cashout-prod.default.cashout.outbox"

    def test_multi_database_service_keeps_real_database(self):
        """
        Postgres/Debezium: database.dbname='ledger' is a real database and must stay in
        the FQN, so a schema reused across databases cannot be mismatched.
        This is the one connector that already worked - guard against regressing it.
        """
        source, build = self._make_source(
            services={"rds-ledger-prod": ("Postgres", "ledger-prod.cluster-x.us-west-2.rds.amazonaws.com:5432")},
            catalog=[
                ("rds-ledger-prod", "ledger", "transfer", "outbox"),
                ("rds-ledger-prod", "reporting", "transfer", "outbox"),
            ],
        )
        pipeline = KafkaConnectPipelineDetails(
            name="outbox-transfer-prod",
            type="source",
            config={
                "connector.class": "PostgresCdcSource",
                "database.hostname": "ledger-prod.cluster-x.us-west-2.rds.amazonaws.com",
                "database.dbname": "ledger",
                "topic.prefix": "earnin.transfer.prod",
                "table.include.list": "transfer.outbox",
            },
        )
        dataset = KafkaConnectDatasetDetails(table="outbox", database="ledger", schema="transfer")

        result = self._run(source, build, pipeline, dataset)

        assert result is not None
        assert result.fullyQualifiedName == "rds-ledger-prod.ledger.transfer.outbox"

    def test_multi_database_service_without_dbname_falls_back_to_schema(self):
        """
        A multi-database connector that omits database.dbname gets topic.prefix in the
        database slot. The schema-preferred fallback must still find the table.
        """
        source, build = self._make_source(
            services={"rds-keycloak-prod": ("Postgres", "keycloak-prod.cluster-x.us-west-2.rds.amazonaws.com:5432")},
            catalog=[("rds-keycloak-prod", "keycloak", "keycloak", "cdc_outbox")],
        )
        pipeline = KafkaConnectPipelineDetails(
            name="outbox-KeycloakCDC-prod",
            type="source",
            config={
                "connector.class": "PostgresCdcSource",
                "database.hostname": "keycloak-prod.cluster-x.us-west-2.rds.amazonaws.com",
                "topic.prefix": "earnin.KeycloakCDC.prod",
                "table.include.list": "keycloak.cdc_outbox",
            },
        )
        dataset = KafkaConnectDatasetDetails(table="cdc_outbox", database="earnin.KeycloakCDC.prod", schema="keycloak")

        result = self._run(source, build, pipeline, dataset)

        assert result is not None, "schema-preferred fallback must recover when database is a topic.prefix"
        assert result.fullyQualifiedName == "rds-keycloak-prod.keycloak.keycloak.cdc_outbox"

    def test_unmatched_service_falls_back_to_schema_first_search(self):
        """
        When the connector's hostname matches no service, resolution falls through to the
        cross-service search. That search must be qualified by schema, not by the value in
        the database slot: '"earnin.cashout.prod".outbox' matches no FQN in OpenMetadata,
        while 'cashout.outbox' matches rds-cashout-prod.default.cashout.outbox.
        """
        source, build = self._make_source(
            services={"rds-other-prod": ("Mysql", "somewhere-else.rds.amazonaws.com:3306")},
            catalog=[("rds-cashout-prod", "default", "cashout", "outbox")],
        )
        pipeline = KafkaConnectPipelineDetails(
            name="outbox-cashout-prod-v2",
            type="source",
            config={
                "connector.class": "MySqlCdcSourceV2",
                "database.hostname": "cashout-prod.cluster-x.us-west-2.rds.amazonaws.com",
                "topic.prefix": "earnin.cashout.prod",
                "table.include.list": "cashout.outbox",
            },
        )
        dataset = KafkaConnectDatasetDetails(table="outbox", database="earnin.cashout.prod", schema="cashout")

        result = self._run(source, build, pipeline, dataset)

        assert result is not None, "cross-service search must be qualified by schema, not topic.prefix"
        assert result.fullyQualifiedName == "rds-cashout-prod.default.cashout.outbox"

    def test_search_falls_back_to_database_qualifier_when_schema_absent(self):
        """With no schema parsed, the database value is still worth trying as a qualifier."""
        source, build = self._make_source(
            services={},
            catalog=[("rds-repayment-prod", "repayment", "repayment", "outbox")],
        )
        pipeline = KafkaConnectPipelineDetails(name="outbox-repayment-prod", type="source", config={})
        dataset = KafkaConnectDatasetDetails(table="outbox", database="repayment")

        result = self._run(source, build, pipeline, dataset)

        assert result is not None
        assert result.fullyQualifiedName == "rds-repayment-prod.repayment.repayment.outbox"


class TestServiceSupportsDatabase:
    """
    The multi- vs single-database split is declared in the connection JSON Schema via
    ``supportsDatabase``/``database``, so it must be read from the service's connection
    model rather than hardcoded per connector class.

    Note the generated models emit ``supportsDatabase: Field(None)`` - the JSON Schema
    ``default: true`` is dropped by codegen - so the signal is field *presence*, not
    truthiness. Testing the value would silently classify every Postgres service as
    single-database.
    """

    def _source_with(self, services):
        from metadata.ingestion.source.pipeline.kafkaconnect.metadata import (
            KafkaconnectSource,
        )

        source = object.__new__(KafkaconnectSource)
        source.metadata = MagicMock()
        source._database_services_cache = [
            SimpleNamespace(name=SimpleNamespace(root=name), connection=SimpleNamespace(config=config))
            for name, config in services.items()
        ]
        return source

    @staticmethod
    def _config(module, cls_name):
        import importlib

        cls = getattr(
            importlib.import_module(f"metadata.generated.schema.entity.services.connections.database.{module}"),
            cls_name,
        )
        return cls.model_construct()

    def test_single_database_services(self):
        for module, cls_name in [
            ("mysqlConnection", "MysqlConnection"),
            ("clickhouseConnection", "ClickhouseConnection"),
            ("mariaDBConnection", "MariaDBConnection"),
        ]:
            source = self._source_with({"svc": self._config(module, cls_name)})
            assert source._service_supports_database("svc") is False, cls_name

    def test_multi_database_services(self):
        for module, cls_name in [
            ("postgresConnection", "PostgresConnection"),
            ("redshiftConnection", "RedshiftConnection"),
            ("snowflakeConnection", "SnowflakeConnection"),
            ("bigQueryConnection", "BigQueryConnection"),
        ]:
            source = self._source_with({"svc": self._config(module, cls_name)})
            assert source._service_supports_database("svc") is True, cls_name

    def test_service_with_unreadable_connection_is_undecided(self):
        """
        A service whose connection config is absent (masked, or not returned to the
        caller) tells us nothing about its class. It must report None, not False:
        False means "single-database" and drops the database qualifier from the FQN,
        which would make a schema that repeats across databases resolve ambiguously.
        """
        for connection in (None, SimpleNamespace(config=None)):
            source = self._source_with({})
            source._database_services_cache = [SimpleNamespace(name=SimpleNamespace(root="svc"), connection=connection)]
            assert source._service_supports_database("svc") is None, connection

    def test_unknown_service_is_undecided(self):
        """
        An unresolvable service name (e.g. the "*" wildcard used when no dbServiceNames
        are configured) must report None, not False: the caller then tries the
        database-qualified FQN first and the unconstrained one second, instead of
        wrongly assuming a single-database service and dropping a real database name.
        """
        source = self._source_with({})
        assert source._service_supports_database("nope") is None


class TestEventRouterTopicFallback:
    """
    Topic resolution for a Debezium outbox connector whose routed name is not
    derivable from the connector config.
    """

    def test_event_router_does_not_fall_back_to_pre_transform_topic_name(self):
        """
        An EventRouter whose replacement carries no static text yields no derivable
        pattern. Falling back to the raw CDC name "{prefix}.{schema}.{table}" is
        provably wrong - the SMT renames the topic before publish - and only produced
        misleading "topic not found" warnings.
        """
        config = {
            "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
            "topic.prefix": "ecommerce.sales",
            "table.include.list": "prod.sales.outbox",
            "transforms": "outbox,route",
            "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
            "transforms.outbox.route.topic.replacement": "outbox.event.${routedByValue}",
            "transforms.route.type": "org.apache.kafka.connect.transforms.RegexRouter",
            "transforms.route.regex": r"outbox\.event\.(.*)",
            "transforms.route.replacement": "$1",
        }
        source = object.__new__(
            __import__(
                "metadata.ingestion.source.pipeline.kafkaconnect.metadata",
                fromlist=["KafkaconnectSource"],
            ).KafkaconnectSource
        )
        source._topics_cache = {}
        source.metadata = MagicMock()
        source.metadata.list_all_entities.return_value = []

        details = KafkaConnectPipelineDetails(name="outbox-connector", type="source", config=config)
        topics = source._resolve_source_topics(
            pipeline_details=details,
            database_server_name="ecommerce.sales",
            effective_messaging_service=None,
        )

        assert [t.name for t in topics] == [], "must not synthesise the pre-SMT topic name for an EventRouter connector"


class TestConnectorTopicsFromRuntime:
    """
    A connector whose destination topic is computed per row - a Debezium outbox
    EventRouter routing by ``aggregatetype`` - has no topic name anywhere in its config.
    The Connect runtime's /topics endpoint (KIP-558) is the only source that knows, so it
    must be tried before falling back to config-declared topic names, including on
    Confluent Cloud.
    """

    def _client(self, confluent_cloud=True):
        from metadata.ingestion.source.pipeline.kafkaconnect.client import (
            KafkaConnectClient,
        )

        client = object.__new__(KafkaConnectClient)
        client.client = MagicMock()
        client.is_confluent_cloud = confluent_cloud
        client._topics_endpoint_supported = None
        # No telemetry credentials, so the Confluent telemetry lookup is skipped and these
        # tests exercise the runtime-to-config fallback they are about.
        client._telemetry_auth = None
        client._host_port = ""
        return client

    def test_runtime_topics_preferred_over_config(self):
        client = self._client()
        client.client.list_connector_topics.return_value = {
            "outbox-moneywallet-prod": {"topics": ["prod.ern.moneywallet.walletEntity_v1"]}
        }

        topics = client.get_connector_topics("outbox-moneywallet-prod")

        assert [t.name for t in topics] == ["prod.ern.moneywallet.walletEntity_v1"]

    @staticmethod
    def _http_error(status):
        """A requests-style error carrying a status code, as raise_for_status() produces."""
        return Exception(f"HTTP {status}")

    @staticmethod
    def _with_status(exc, status):
        exc.response = SimpleNamespace(status_code=status)
        return exc

    def test_falls_back_to_config_when_endpoint_unavailable(self):
        client = self._client()
        client.client.list_connector_topics.side_effect = self._with_status(self._http_error(404), 404)
        client.get_connector_config = MagicMock(return_value={"topics": "orders,payments"})

        topics = client.get_connector_topics("jdbc-sink")

        assert [t.name for t in topics] == ["orders", "payments"]

    def test_unsupported_endpoint_is_probed_only_once(self):
        """A cluster without /topics must not be re-asked for every connector."""
        client = self._client()
        client.client.list_connector_topics.side_effect = self._with_status(self._http_error(404), 404)
        client.get_connector_config = MagicMock(return_value={"topics": "orders"})

        for name in ("conn-a", "conn-b", "conn-c"):
            client.get_connector_topics(name)

        assert client.client.list_connector_topics.call_count == 1
        assert client._topics_endpoint_supported is False

    def test_transient_failure_does_not_disable_the_endpoint(self):
        """
        A timeout or 5xx on whichever connector happens to be processed first must not
        latch the endpoint off. The config fallback yields nothing for a connector that
        routes by row value, so treating a blip as "unsupported" would silently drop
        lineage for every outbox connector behind it.
        """
        client = self._client()
        client.get_connector_config = MagicMock(return_value=None)
        client.client.list_connector_topics.side_effect = [
            Exception("Read timed out"),  # no .response at all
            self._with_status(self._http_error(503), 503),
            {"outbox-cashout-prod-v2": {"topics": ["prod.ern.cashout.delayedCashouts"]}},
        ]

        assert client.get_connector_topics("conn-a") is None
        assert client._topics_endpoint_supported is None, "timeout must not latch the probe off"
        assert client.get_connector_topics("conn-b") is None
        assert client._topics_endpoint_supported is None, "5xx must not latch the probe off"

        topics = client.get_connector_topics("outbox-cashout-prod-v2")

        assert [t.name for t in topics] == ["prod.ern.cashout.delayedCashouts"]
        assert client.client.list_connector_topics.call_count == 3
        assert client._topics_endpoint_supported is True


class TestInternalTopicExclusion:
    """
    The Connect runtime legitimately reports a connector's own bookkeeping topics as
    "active": Debezium's schema-change topic is named exactly ``topic.prefix``, and its
    transaction-metadata topic ``topic.prefix + '.transaction'``. Both are measured, and
    both are metadata plumbing rather than data assets, so neither may become a lineage
    endpoint.

    The names come from the connector's own config, never from name patterns: matching
    ``*.transaction`` by name would delete a legitimately named customer topic.
    """

    def _client(self):
        client = object.__new__(KafkaConnectClient)
        client.client = MagicMock()
        client.is_confluent_cloud = False
        client._topics_endpoint_supported = None
        return client

    def test_schema_change_and_transaction_topics_are_excluded(self):
        client = self._client()
        client.client.list_connector_topics.return_value = {
            "outbox-wallet": {
                "topics": [
                    "prod.ern.moneywallet.walletEntity_v1",
                    "rigA.wallet.topiccol",
                    "rigA.wallet.topiccol.transaction",
                ]
            }
        }
        client.get_connector_config = MagicMock(return_value={"topic.prefix": "rigA.wallet.topiccol"})

        topics = client.get_connector_topics("outbox-wallet")

        assert [t.name for t in topics] == ["prod.ern.moneywallet.walletEntity_v1"]

    def test_schema_history_and_dlq_topics_are_excluded(self):
        client = self._client()
        client.client.list_connector_topics.return_value = {
            "sink-wallet": {
                "topics": [
                    "prod.ern.moneywallet.walletEntity_v1",
                    "schema-history.rigA.wallet",
                    "dlq-sink-wallet",
                ]
            }
        }
        client.get_connector_config = MagicMock(
            return_value={
                "schema.history.internal.kafka.topic": "schema-history.rigA.wallet",
                "errors.deadletterqueue.topic.name": "dlq-sink-wallet",
            }
        )

        topics = client.get_connector_topics("sink-wallet")

        assert [t.name for t in topics] == ["prod.ern.moneywallet.walletEntity_v1"]

    def test_a_customer_topic_named_like_an_internal_one_survives(self):
        """
        Exclusion is by configured name, not by shape. A connector whose topic.prefix is
        unrelated must keep a data topic that merely ends in ".transaction".
        """
        client = self._client()
        client.client.list_connector_topics.return_value = {
            "payments": {"topics": ["prod.ern.payments.transaction", "prod.ern.payments.refund_v1"]}
        }
        client.get_connector_config = MagicMock(return_value={"topic.prefix": "rigA.payments"})

        topics = client.get_connector_topics("payments")

        assert [t.name for t in topics] == [
            "prod.ern.payments.transaction",
            "prod.ern.payments.refund_v1",
        ]


def _source_with_topics(topic_names):
    """A KafkaconnectSource whose only stubbed boundary is the OpenMetadata topic listing."""
    from metadata.ingestion.source.pipeline.kafkaconnect.metadata import (
        KafkaconnectSource,
    )

    source = object.__new__(KafkaconnectSource)
    source.lineage_results = []
    source._database_services_cache = []
    source._messaging_services_cache = []
    source._topics_cache = {}
    source.metadata = MagicMock()
    # These tests assert on which topic NAMES get resolved, not on entity lookup, and a
    # bare MagicMock here fails TopicResolutionResult validation.
    source.metadata.get_by_name.return_value = None

    def list_all_entities(entity, params=None, **kwargs):
        for name in topic_names:
            topic = MagicMock()
            topic.name = name
            topic.fullyQualifiedName = f'confluent-prod."{name}"'
            yield topic

    source.metadata.list_all_entities.side_effect = list_all_entities
    return source


class TestNamespaceScanRequiresAttribution:
    """
    The topic.prefix namespace scan is only sound when no topic-rewriting SMT is
    configured, because that is exactly the condition under which a topic name still
    encodes its source table. With a router in the chain the scan asserts membership it
    cannot verify.
    """

    OUTBOX_CONFIG = {  # noqa: RUF012
        "connector.class": "MySqlCdcSourceV2",
        "topic.prefix": "earnin.moneywallet.prod",
        "table.include.list": "moneywallet.outbox",
        "transforms": "outbox",
        "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
        "transforms.outbox.route.by.field": "_topic",
        "transforms.outbox.route.topic.replacement": "${routedByValue}",
    }

    def test_event_router_connector_never_reaches_the_prefix_scan(self):
        """
        Regression for the shipped defect. The existing guard test passes
        effective_messaging_service=None, which is the one value for which the prefix
        scan below it cannot run. Every real deployment sets it, and with it set the
        scan linked the outbox table to Debezium's transaction-metadata topic.
        """
        source = _source_with_topics(
            [
                "earnin.moneywallet.prod.lcc-d21vnd.transaction",
                "earnin.moneywallet.prod.message",
                "prod.ern.moneywallet.walletEntity_v1",
            ]
        )
        details = KafkaConnectPipelineDetails(name="outbox-moneywallet-prod", type="source", config=self.OUTBOX_CONFIG)

        topics = source._resolve_source_topics(
            pipeline_details=details,
            database_server_name="earnin.moneywallet.prod",
            effective_messaging_service="confluent-prod",
        )

        assert [t.name for t in topics] == [], "an EventRouter connector must not namespace-scan"

    def test_plain_cdc_still_resolves_through_the_prefix_scan(self):
        """With no rewriting SMT the scan is sound, and must keep working."""
        source = _source_with_topics(["rigA.plaincdc.walletdb.customers", "rigA.plaincdc.walletdb.orders"])
        config = {"connector.class": "MySqlCdcSourceV2", "topic.prefix": "rigA.plaincdc"}
        details = KafkaConnectPipelineDetails(name="plain-cdc", type="source", config=config)

        topics = source._resolve_source_topics(
            pipeline_details=details,
            database_server_name="rigA.plaincdc",
            effective_messaging_service="confluent-prod",
        )

        assert sorted(t.name for t in topics) == [
            "rigA.plaincdc.walletdb.customers",
            "rigA.plaincdc.walletdb.orders",
        ]

    def test_include_list_resolves_exact_names_without_scanning(self):
        """
        With table.include.list the topic names are constructed exactly, so the namespace
        scan is never reached and a same-prefix internal topic cannot be picked up.
        """
        source = _source_with_topics(
            [
                "rigA.plaincdc.walletdb.customers",
                "rigA.plaincdc.lcc-d21vnd.transaction",
            ]
        )
        config = {
            "connector.class": "MySqlCdcSourceV2",
            "topic.prefix": "rigA.plaincdc",
            "table.include.list": "walletdb.customers",
        }
        details = KafkaConnectPipelineDetails(name="plain-cdc", type="source", config=config)

        topics = source._resolve_source_topics(
            pipeline_details=details,
            database_server_name="rigA.plaincdc",
            effective_messaging_service="confluent-prod",
        )

        assert [t.name for t in topics] == ["rigA.plaincdc.walletdb.customers"]


class TestRoutingPatternsDoNotGenerateTopics:
    """
    A wildcard built from route.topic.replacement describes a superset of the connector's
    topics, so it cannot attribute a topic to a table. Two connectors routing into one
    namespace reduce to the same pattern while owning disjoint topics, so generating from
    the pattern gives each of them the other's edges.
    """

    @staticmethod
    def _config(replacement):
        config = {
            "connector.class": "MySqlCdcSourceV2",
            "topic.prefix": "rigA.wallet.suffixcol",
            "table.include.list": "walletdb.outbox_suffix_col",
            "transforms": "outbox",
            "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
            "transforms.outbox.route.by.field": "_route_suffix",
        }
        if replacement is not None:
            config["transforms.outbox.route.topic.replacement"] = replacement
        return config

    def test_static_prefix_pattern_no_longer_claims_the_namespace(self):
        source = _source_with_topics(
            [
                "prod.ern.moneywallet.settings_v1",
                "prod.ern.moneywallet.ledgerEntry_v1",
                "prod.ern.moneywallet.walletEntity_v1",
            ]
        )
        details = KafkaConnectPipelineDetails(
            name="outbox-wallet-suffix",
            type="source",
            config=self._config("prod.ern.moneywallet.${routedByValue}"),
        )

        topics = source._resolve_source_topics(
            pipeline_details=details,
            database_server_name="rigA.wallet.suffixcol",
            effective_messaging_service="confluent-prod",
        )

        assert [t.name for t in topics] == [], "a routing pattern must not generate candidates"

    def test_fully_static_replacement_is_config_deterministic(self):
        """
        A replacement with no ${...} token routes every event to one fixed topic, so the
        destination is as derivable as any other declared name and must still resolve
        without the runtime. Only a replacement that interpolates a row value is unknown.
        """
        source = _source_with_topics(["prod.events.all", "prod.events.settings_v1", "prod.events.orderPlaced_v1"])
        details = KafkaConnectPipelineDetails(
            name="outbox-static", type="source", config=self._config("prod.events.all")
        )

        topics = source._resolve_source_topics(
            pipeline_details=details,
            database_server_name="rigA.wallet.suffixcol",
            effective_messaging_service="confluent-prod",
        )

        assert [t.name for t in topics] == ["prod.events.all"], (
            "a static replacement names exactly one topic, with no namespace scan or pattern match"
        )

    def test_static_replacement_composes_with_a_following_regex_router(self):
        """The published name is what survives the SMT chain, so later routers apply."""
        config = self._config("outbox.event.all")
        config["transforms"] = "outbox,reroute"
        config["transforms.reroute.type"] = "org.apache.kafka.connect.transforms.RegexRouter"
        config["transforms.reroute.regex"] = r"outbox\.event\.(.*)"
        config["transforms.reroute.replacement"] = "prod.events.$1"
        source = _source_with_topics(["prod.events.all"])
        details = KafkaConnectPipelineDetails(name="outbox-static", type="source", config=config)

        topics = source._resolve_source_topics(
            pipeline_details=details,
            database_server_name="rigA.wallet.suffixcol",
            effective_messaging_service="confluent-prod",
        )

        assert [t.name for t in topics] == ["prod.events.all"]

    def test_absent_route_topic_replacement_resolves_nothing(self):
        """
        An absent key means the routed name is unknown. The old code synthesised
        "outbox.event.${routedByValue}", which invented a claim and matched nothing in
        the deployment where this was found.
        """
        source = _source_with_topics(["outbox.event.wallet", "prod.ern.moneywallet.walletEntity_v1"])
        details = KafkaConnectPipelineDetails(name="outbox-no-replacement", type="source", config=self._config(None))

        topics = source._resolve_source_topics(
            pipeline_details=details,
            database_server_name="rigA.wallet.suffixcol",
            effective_messaging_service="confluent-prod",
        )

        assert [t.name for t in topics] == []


class TestConnectorEnrichmentOrdering:
    """
    The topic listing needs the connector's config to recognise that connector's own
    bookkeeping topics, so enrichment must fetch config first and hand it to the topic
    call. Reordering these two, or dropping the hand-off, silently costs a second round
    trip per connector and leaves the internal-topic exclusion with nothing to match on.
    """

    def test_config_is_fetched_first_and_passed_to_the_topic_listing(self):
        from metadata.ingestion.source.pipeline.kafkaconnect.client import (
            KafkaConnectClient,
        )

        client = object.__new__(KafkaConnectClient)
        client.client = MagicMock()
        client.is_confluent_cloud = False
        client._topics_endpoint_supported = None

        config = {"topic.prefix": "rigA.wallet", "description": "wallet outbox"}
        calls = []
        client.get_connector_config = MagicMock(side_effect=lambda connector: calls.append("config") or config)
        client.get_connector_topics = MagicMock(
            side_effect=lambda connector, connector_config=None: (
                calls.append(("topics", connector_config)) or [KafkaConnectTopics(name="prod.events.orderPlaced_v1")]
            )
        )

        details = KafkaConnectPipelineDetails(name="outbox-wallet", type="source")
        client._enrich_connector_details(details, "outbox-wallet")

        assert calls[0] == "config", "config must be fetched before the topic listing"
        assert calls[1] == ("topics", config), "the fetched config must be handed to the topic listing"
        assert client.get_connector_config.call_count == 1, "config must not be fetched twice"
        assert [t.name for t in details.topics] == ["prod.events.orderPlaced_v1"]
        assert details.description == "wallet outbox"


class TestColdStartFallsBackToDeclaredTopics:
    """
    Active-topic tracking records what a connector has touched so far, not what it will.
    A connector that has produced nothing, or so far only its own schema-change topic, is
    at a cold start rather than asserting it has no data topics, so its config-declared
    names are still the better answer.

    Falling back is safe because every remaining fallback is deterministic: a sink's
    declared topics, or CDC names built from table.include.list. Routing patterns no
    longer generate candidates, and the namespace scan is restricted to connectors with
    no topic-rewriting SMT.
    """

    def _client(self):
        client = object.__new__(KafkaConnectClient)
        client.client = MagicMock()
        client.is_confluent_cloud = False
        client._topics_endpoint_supported = None
        return client

    def test_runtime_reporting_only_internal_topics_falls_back(self):
        """
        A connector that has emitted a schema change but no data rows reports only its
        schema-change topic. That is a cold start, so its declared topic still resolves.
        """
        client = self._client()
        client.client.list_connector_topics.return_value = {"datagen": {"topics": ["rigA.plaincdc"]}}
        config = {"topic.prefix": "rigA.plaincdc", "kafka.topic": "orders"}

        topics = client.get_connector_topics("datagen", connector_config=config)

        assert [t.name for t in topics] == ["orders"]

    def test_silent_runtime_still_falls_back_to_config(self):
        """A sink that has not consumed yet must still resolve its declared subscription."""
        client = self._client()
        client.client.list_connector_topics.return_value = {"jdbc-sink": {"topics": []}}
        config = {"topics": "orders,payments"}

        topics = client.get_connector_topics("jdbc-sink", connector_config=config)

        assert [t.name for t in topics] == ["orders", "payments"]

    def test_cold_start_cdc_still_resolves_constructed_names(self):
        """
        Regression for a gate that suppressed inference whenever the runtime reported no
        data topics. A freshly started CDC connector resolved nothing, losing the
        deterministically constructed names it should have had.
        """
        source = _source_with_topics(["rigA.plaincdc.walletdb.customers", "rigA.plaincdc.walletdb.orders"])
        config = {
            "connector.class": "MySqlCdcSourceV2",
            "topic.prefix": "rigA.plaincdc",
            "table.include.list": "walletdb.customers,walletdb.orders",
        }
        details = KafkaConnectPipelineDetails(name="plain-cdc", type="source", config=config)

        result = source._parse_and_resolve_topics(
            pipeline_details=details,
            database_server_name="rigA.plaincdc",
            effective_messaging_service="confluent-prod",
            is_storage_sink=False,
        )

        assert sorted(t.name for t in result.topics) == [
            "rigA.plaincdc.walletdb.customers",
            "rigA.plaincdc.walletdb.orders",
        ]


class TestForbiddenIsNotAlwaysUnsupported:
    """
    Connect answers 403 "Topic tracking is disabled." when topic.tracking.enable=false,
    which is a property of the whole worker. A proxy or per-route RBAC can also answer 403
    while the endpoint exists, and latching on the status alone would silently disable
    runtime topic discovery for every connector behind the first such response.
    """

    def _client(self):
        client = object.__new__(KafkaConnectClient)
        client.client = MagicMock()
        client.is_confluent_cloud = False
        client._topics_endpoint_supported = None
        return client

    @staticmethod
    def _forbidden(body):
        exc = Exception("403 Client Error: Forbidden")
        exc.response = SimpleNamespace(status_code=403, text=body)
        return exc

    def test_topic_tracking_disabled_latches_off(self):
        client = self._client()
        client.client.list_connector_topics.side_effect = self._forbidden(
            '{"error_code":403,"message":"Topic tracking is disabled."}'
        )
        client.get_connector_config = MagicMock(return_value={"topics": "orders"})

        for name in ("conn-a", "conn-b", "conn-c"):
            client.get_connector_topics(name)

        assert client.client.list_connector_topics.call_count == 1
        assert client._topics_endpoint_supported is False

    def test_authorization_403_does_not_latch_off(self):
        """
        An RBAC or proxy 403 is request-specific. Latching would strip runtime truth from
        every later connector, including ones whose topics are perfectly readable.
        """
        client = self._client()
        client.client.list_connector_topics.side_effect = [
            self._forbidden('{"error_code":403,"message":"Forbidden"}'),
            {"outbox-b": {"topics": ["prod.events.orderPlaced_v1"]}},
        ]
        client.get_connector_config = MagicMock(return_value={})

        assert client.get_connector_topics("outbox-a") is None
        assert client._topics_endpoint_supported is None, "an auth 403 must not disable the endpoint"

        topics = client.get_connector_topics("outbox-b")

        assert [t.name for t in topics] == ["prod.events.orderPlaced_v1"]
        assert client.client.list_connector_topics.call_count == 2


class TestConfluentTelemetryTopics:
    """
    Topics a Confluent Cloud managed connector actually produced to.

    Confluent Cloud answers KIP-558 with 404, so a connector whose destination topic is
    chosen per row resolves nothing from config. The telemetry Data Flow dataset reports
    the topic a producer client wrote to, and a managed connector's producer client id
    carries its connector id, which is what closes that gap.
    """

    @staticmethod
    def _cloud_client():
        config = MagicMock(spec=KafkaConnectConnection)
        config.hostPort = "https://api.confluent.cloud/connect/v1/environments/env-abc/clusters/lkc-xyz"
        config.verifySSL = True
        auth = MagicMock()
        auth.username = "CLOUDKEY"
        auth.password.get_secret_value.return_value = "cloudsecret"
        config.KafkaConnectConfig = auth
        with patch("metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"):
            return KafkaConnectClient(config)

    def test_cluster_id_comes_from_the_host_port(self):
        """The telemetry query is scoped by Kafka cluster, and hostPort already names it."""
        client = self._cloud_client()

        assert client._confluent_kafka_cluster_id() == "lkc-xyz"

    def test_self_hosted_has_no_cluster_id(self):
        """A self-hosted Connect URL names no Kafka cluster, so there is nothing to scope by."""
        config = MagicMock(spec=KafkaConnectConnection)
        config.hostPort = "http://localhost:8083"
        config.verifySSL = True
        config.KafkaConnectConfig = None
        with patch("metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"):
            client = KafkaConnectClient(config)

        assert client._confluent_kafka_cluster_id() is None

    def test_row_routed_topics_are_resolved_from_telemetry(self):
        """
        The case config cannot answer.

        An outbox EventRouter routing by a row value publishes topic names that appear in
        no config key. Telemetry reports them against the connector's producer client.
        """
        client = self._cloud_client()
        client._connector_id_by_name = MagicMock(return_value={"outbox-wallet": "lcc-aaa111"})
        client._query_dataflow_topics_by_client = MagicMock(
            return_value={
                "connector-producer-lcc-aaa111-0": {
                    "prod.events.walletEntity_v1",
                    "prod.events.instrument_v1",
                },
                "connector-producer-lcc-bbb222-0": {"prod.events.other_v1"},
            }
        )

        topics = client._list_topics_from_telemetry("outbox-wallet")

        assert sorted(t.name for t in topics) == [
            "prod.events.instrument_v1",
            "prod.events.walletEntity_v1",
        ], "must return only the topics produced by this connector's own client"

    def test_another_connectors_topics_are_never_claimed(self):
        """Client ids are per connector, so a sibling's topics must not leak across."""
        client = self._cloud_client()
        client._connector_id_by_name = MagicMock(return_value={"outbox-wallet": "lcc-aaa111"})
        client._query_dataflow_topics_by_client = MagicMock(
            return_value={"connector-producer-lcc-bbb222-0": {"prod.events.other_v1"}}
        )

        assert client._list_topics_from_telemetry("outbox-wallet") is None

    def test_schema_history_client_is_not_the_connector(self):
        """
        Confluent's managed schema history topic is named dbhistory.<prefix>.<connector-id>,
        so its name is not derivable from config and cannot be excluded by name. It is
        produced by a separate client, which is what makes it separable at all.
        """
        client = self._cloud_client()
        client._connector_id_by_name = MagicMock(return_value={"outbox-wallet": "lcc-aaa111"})
        client._query_dataflow_topics_by_client = MagicMock(
            return_value={
                "connector-producer-lcc-aaa111-0": {"prod.events.walletEntity_v1"},
                "wallet.prod-schemahistory": {"dbhistory.wallet.prod.lcc-aaa111"},
            }
        )

        topics = client._list_topics_from_telemetry("outbox-wallet")

        assert [t.name for t in topics] == ["prod.events.walletEntity_v1"]

    def test_unknown_connector_resolves_nothing(self):
        """A connector absent from the live id map must not be matched by substring."""
        client = self._cloud_client()
        client._connector_id_by_name = MagicMock(return_value={})
        client._query_dataflow_topics_by_client = MagicMock(
            return_value={"connector-producer-lcc-aaa111-0": {"prod.events.walletEntity_v1"}}
        )

        assert client._list_topics_from_telemetry("outbox-wallet") is None

    def test_telemetry_failure_is_not_fatal(self):
        """Telemetry is additive. A failure must degrade to no enrichment, never raise."""
        client = self._cloud_client()
        client._connector_id_by_name = MagicMock(return_value={"outbox-wallet": "lcc-aaa111"})
        client._query_dataflow_topics_by_client = MagicMock(side_effect=Exception("telemetry down"))

        assert client._list_topics_from_telemetry("outbox-wallet") is None

    def test_telemetry_runs_before_config_but_after_runtime(self):
        """
        Resolution order: the runtime list wins, then telemetry, then declared config.
        Both runtime sources describe what happened, config only what was asked for.
        """
        client = self._cloud_client()
        client._list_data_topics_from_api = MagicMock(return_value=None)
        client._list_topics_from_telemetry = MagicMock(
            return_value=[KafkaConnectTopics(name="prod.events.walletEntity_v1")]
        )
        client._parse_topics_from_config = MagicMock(return_value=[KafkaConnectTopics(name="declared.in.config")])

        topics = client.get_connector_topics("outbox-wallet", connector_config={})

        assert [t.name for t in topics] == ["prod.events.walletEntity_v1"]
        client._parse_topics_from_config.assert_not_called()

    def test_config_still_used_when_telemetry_is_silent(self):
        """An idle connector reports no flow, so the declared names must still be used."""
        client = self._cloud_client()
        client._list_data_topics_from_api = MagicMock(return_value=None)
        client._list_topics_from_telemetry = MagicMock(return_value=None)
        client._parse_topics_from_config = MagicMock(return_value=[KafkaConnectTopics(name="declared.in.config")])

        topics = client.get_connector_topics("outbox-wallet", connector_config={})

        assert [t.name for t in topics] == ["declared.in.config"]

    def test_check_passes_for_self_hosted(self):
        """
        Self-hosted Connect serves the topics endpoint and never consults telemetry, so the
        step must not report a failure the operator has no way to act on.
        """
        config = MagicMock(spec=KafkaConnectConnection)
        config.hostPort = "http://localhost:8083"
        config.verifySSL = True
        config.KafkaConnectConfig = None
        with patch("metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"):
            client = KafkaConnectClient(config)
        client._query_dataflow_topics_by_client = MagicMock()

        assert client.check_confluent_telemetry() is True
        client._query_dataflow_topics_by_client.assert_not_called()

    def test_check_surfaces_the_failure_on_confluent_cloud(self):
        """
        The test step reports by raising, unlike the resolution path which stays silent.
        Here the operator is the one who can fix the credentials, so they must be told.
        """
        client = self._cloud_client()
        client._query_dataflow_topics_by_client = MagicMock(side_effect=Exception("401 Unauthorized"))

        with pytest.raises(Exception, match="401 Unauthorized"):
            client.check_confluent_telemetry()

    def test_managed_transaction_topic_is_excluded(self):
        """
        Debezium's transaction metadata topic is produced by the connector's own client, so
        client identity cannot separate it. Confluent names it <prefix>.<connector-id>.
        transaction, which extract_internal_topic_names cannot derive from config because
        the connector id is assigned at runtime. Emitting it would be the same class of
        wrong edge that linking the outbox table to bookkeeping topics already was.
        """
        client = self._cloud_client()
        client._connector_id_by_name = MagicMock(return_value={"outbox-wallet": "lcc-aaa111"})
        client._query_dataflow_topics_by_client = MagicMock(
            return_value={
                "connector-producer-lcc-aaa111-0": {
                    "prod.events.walletEntity_v1",
                    "wallet.prod.lcc-aaa111.transaction",
                }
            }
        )

        topics = client._list_topics_from_telemetry("outbox-wallet", connector_config={"topic.prefix": "wallet.prod"})

        assert [t.name for t in topics] == ["prod.events.walletEntity_v1"]

    def test_configured_internal_topics_are_excluded(self):
        """The names config does declare, such as schema history, are excluded too."""
        client = self._cloud_client()
        client._connector_id_by_name = MagicMock(return_value={"outbox-wallet": "lcc-aaa111"})
        client._query_dataflow_topics_by_client = MagicMock(
            return_value={
                "connector-producer-lcc-aaa111-0": {
                    "prod.events.walletEntity_v1",
                    "schema-history.wallet.prod",
                }
            }
        )

        topics = client._list_topics_from_telemetry(
            "outbox-wallet",
            connector_config={
                "topic.prefix": "wallet.prod",
                "schema.history.internal.kafka.topic": "schema-history.wallet.prod",
            },
        )

        assert [t.name for t in topics] == ["prod.events.walletEntity_v1"]

    def test_a_connector_producing_only_bookkeeping_resolves_nothing(self):
        """Bookkeeping alone is not lineage, so this must fall through to config."""
        client = self._cloud_client()
        client._connector_id_by_name = MagicMock(return_value={"outbox-wallet": "lcc-aaa111"})
        client._query_dataflow_topics_by_client = MagicMock(
            return_value={"connector-producer-lcc-aaa111-0": {"wallet.prod.lcc-aaa111.transaction"}}
        )

        assert (
            client._list_topics_from_telemetry("outbox-wallet", connector_config={"topic.prefix": "wallet.prod"})
            is None
        )

    def test_cluster_wide_lookups_run_once_per_ingestion(self):
        """
        Both lookups describe the whole cluster, not one connector, so repeating them per
        connector is pure waste. On a four connector rig they were 43 percent of ingestion
        time, and an estate of thirty six would repeat each thirty six times against an API
        that rate limits per hour.
        """
        client = self._cloud_client()
        client.client.list_connectors = MagicMock(
            return_value={
                "outbox-a": {"id": {"id": "lcc-aaa111"}},
                "outbox-b": {"id": {"id": "lcc-bbb222"}},
            }
        )
        query = MagicMock(
            return_value={
                "connector-producer-lcc-aaa111-0": {"prod.events.a_v1"},
                "connector-producer-lcc-bbb222-0": {"prod.events.b_v1"},
            }
        )
        client._query_dataflow_topics_by_client = query

        first = client._list_topics_from_telemetry("outbox-a", connector_config={})
        second = client._list_topics_from_telemetry("outbox-b", connector_config={})

        assert [t.name for t in first] == ["prod.events.a_v1"]
        assert [t.name for t in second] == ["prod.events.b_v1"]
        assert query.call_count == 1, "the telemetry query is cluster wide, so once per run"
        assert client.client.list_connectors.call_count == 1, "the connector list is cluster wide too"

    @staticmethod
    def _page(rows, next_token=None):
        """A telemetry response page, shaped as the API returns it."""
        page = MagicMock()
        page.raise_for_status = MagicMock()
        page.json = MagicMock(
            return_value={
                "data": rows,
                "meta": {"pagination": {"next_page_token": next_token}} if next_token else {},
            }
        )
        return page

    def test_every_page_is_followed(self):
        """
        The API caps a query at 1000 groups and returns a cursor for the rest. Reading only
        the first page would drop topics on a busy cluster, and a connector resolving a
        partial topic set looks perfectly valid, which is worse than resolving nothing.
        """
        client = self._cloud_client()
        pages = [
            self._page(
                [{"metric.client_id": "connector-producer-lcc-aaa111-0", "metric.topic": "a_v1"}],
                next_token="TOKEN",
            ),
            self._page([{"metric.client_id": "connector-producer-lcc-aaa111-0", "metric.topic": "b_v1"}]),
        ]
        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.requests.post",
            side_effect=pages,
        ) as post:
            by_client = client._query_dataflow_topics_by_client("lkc-xyz")

        assert by_client == {"connector-producer-lcc-aaa111-0": {"a_v1", "b_v1"}}
        assert post.call_count == 2
        assert post.call_args_list[1].kwargs["params"] == {"page_token": "TOKEN"}

    def test_query_stays_within_the_documented_limit(self):
        """The API documents a maximum of 1000 groups. Above it we rely on leniency."""
        client = self._cloud_client()
        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.requests.post",
            return_value=self._page([]),
        ) as post:
            client._query_dataflow_topics_by_client("lkc-xyz")

        assert post.call_args.kwargs["json"]["limit"] <= 1000

    def test_verify_ssl_is_honoured(self):
        """A user disabling certificate verification for Connect means it for telemetry too."""
        config = MagicMock(spec=KafkaConnectConnection)
        config.hostPort = "https://api.confluent.cloud/connect/v1/environments/env-abc/clusters/lkc-xyz"
        config.verifySSL = False
        auth = MagicMock()
        auth.username = "K"
        auth.password.get_secret_value.return_value = "S"
        config.KafkaConnectConfig = auth
        with patch("metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"):
            client = KafkaConnectClient(config)

        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.requests.post",
            return_value=self._page([]),
        ) as post:
            client._query_dataflow_topics_by_client("lkc-xyz")

        assert post.call_args.kwargs["verify"] is False

    def test_a_failed_query_is_not_retried_for_every_connector(self):
        """
        One outage must not become one failed call per connector. The API is rate limited
        per hour, and an estate of thirty six connectors would spend that budget retrying
        a call that already failed.
        """
        client = self._cloud_client()
        client._connector_id_by_name = MagicMock(return_value={"outbox-a": "lcc-aaa111", "outbox-b": "lcc-bbb222"})
        query = MagicMock(side_effect=Exception("telemetry down"))
        client._query_dataflow_topics_by_client = query

        assert client._list_topics_from_telemetry("outbox-a", connector_config={}) is None
        assert client._list_topics_from_telemetry("outbox-b", connector_config={}) is None
        assert query.call_count == 1, "a failed cluster-wide query must not be retried per connector"

    def test_only_live_connectors_are_retained(self):
        """
        The telemetry window outlives the connectors in it. A connector deleted earlier in
        the window still reports the topics it produced to, and keeping those grows what is
        retained with churn rather than with the number of connectors that exist. They can
        never be attributed either, since resolution goes through the live connector list.
        """
        client = self._cloud_client()
        client._connector_id_by_name = MagicMock(return_value={"outbox-live": "lcc-live01"})
        client._query_dataflow_topics_by_client = MagicMock(
            return_value={
                "connector-producer-lcc-live01-0": {"prod.events.live_v1"},
                "connector-producer-lcc-dead01-0": {"prod.events.deleted_v1"},
                "connector-producer-lcc-dead02-0": {"prod.events.also_deleted_v1"},
            }
        )

        retained = client._telemetry_topics_for_connector_ids("lkc-xyz")

        assert set(retained) == {"lcc-live01"}, "a deleted connector's topics must not be retained"

    def test_unattributable_rows_are_dropped_without_losing_the_page(self):
        """
        A row has to name both a client and a topic to mean anything: one without a client
        attributes a topic to no connector, and one without a topic attributes a connector
        to nothing. Neither can become lineage. An empty string counts as missing, since it
        would otherwise reach the producer-id match as a real value.

        The rest of the page still resolves, because discarding good pairs over a
        malformed neighbour would silently shrink a connector's topic set, and a partial
        set is indistinguishable from a complete one.
        """
        client = self._cloud_client()
        rows = [
            {"metric.client_id": "connector-producer-lcc-aaa111-0", "metric.topic": "good_v1"},
            {"metric.topic": "orphan_v1"},
            {"metric.client_id": "connector-producer-lcc-aaa111-0"},
            {"metric.client_id": "", "metric.topic": "blank_client_v1"},
            {"metric.client_id": "connector-producer-lcc-aaa111-0", "metric.topic": ""},
            {"metric.client_id": "connector-producer-lcc-aaa111-0", "metric.topic": "also_good_v1"},
        ]
        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.requests.post",
            return_value=self._page(rows),
        ):
            by_client = client._query_dataflow_topics_by_client("lkc-xyz")

        assert by_client == {"connector-producer-lcc-aaa111-0": {"good_v1", "also_good_v1"}}
        assert "" not in by_client, "an empty client id must not become a producer"

    def test_unrelated_producers_are_dropped_before_they_accumulate(self):
        """
        The telemetry query is cluster wide, so the response describes every application
        producing to the cluster, not just connectors. Those rows can never be attributed,
        and this map is held across every page, so on a busy cluster keeping them would let
        ordinary application traffic dominate what the connector holds in memory.

        Asserted on the fetch result rather than on the attributed output, because
        filtering later would still produce the right topics while holding the whole
        cluster's producers to get there.
        """
        client = self._cloud_client()
        rows = [
            {"metric.client_id": "connector-producer-lcc-aaa111-0", "metric.topic": "connector_v1"},
            {"metric.client_id": "checkout-service-prod-17", "metric.topic": "orders_v1"},
            {"metric.client_id": "spark-streaming-job-42", "metric.topic": "events_v1"},
            {"metric.client_id": "consumer-analytics-9", "metric.topic": "connector_v1"},
        ]
        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.requests.post",
            return_value=self._page(rows),
        ):
            by_client = client._query_dataflow_topics_by_client("lkc-xyz")

        assert by_client == {"connector-producer-lcc-aaa111-0": {"connector_v1"}}, (
            "only connector producers may be retained from a cluster-wide response"
        )

    def test_reachability_check_reads_one_page_even_when_more_exist(self):
        """
        The test-connection step only has to learn whether the API answers and accepts the
        credentials, which the first response settles. Following the cursor would spend a
        request per page against an endpoint that rate limits by the hour, and would hold
        an operator on a check whose answer was already known.

        The first page here returns a cursor, so a caller that paged would issue a second
        request. Asserting the call count is what distinguishes the two.
        """
        client = self._cloud_client()
        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.requests.post",
            return_value=self._page(
                [{"metric.client_id": "connector-producer-lcc-aaa111-0", "metric.topic": "a_v1"}],
                next_token="MORE",
            ),
        ) as post:
            assert client.check_confluent_telemetry() is True

        assert post.call_count == 1, "a reachability check must not walk the cursor"

    def test_reachability_check_reports_failure_by_raising(self):
        """
        A test step reports failure by raising, so a rejected credential has to propagate
        rather than be swallowed the way the resolution path swallows it. The operator is
        the one who can fix it, and a step that passed regardless would say nothing.
        """
        client = self._cloud_client()
        response = MagicMock()
        response.raise_for_status = MagicMock(side_effect=Exception("401 Unauthorized"))
        with (
            patch(
                "metadata.ingestion.source.pipeline.kafkaconnect.client.requests.post",
                return_value=response,
            ),
            pytest.raises(Exception, match="401"),
        ):
            client.check_confluent_telemetry()
