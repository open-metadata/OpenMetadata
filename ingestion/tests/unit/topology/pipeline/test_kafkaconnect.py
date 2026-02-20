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

    def test_column_lineage_failure_gracefully_handled(self):
        """Test that column lineage building handles errors gracefully"""
        from metadata.generated.schema.entity.data.table import Table
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

        result = parse_cdc_topic_name(
            "PostgresKafkaCDC.public.orders", "PostgresKafkaCDC"
        )
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
        result = parse_cdc_topic_name(
            "myapp.payments.prod.transactions.orders", "myapp.payments.prod"
        )
        self.assertEqual(result, {"database": "transactions", "table": "orders"})

        # Server name with dots and only table (no schema)
        # Full topic: myapp.payments.prod.users
        # Expected: database=myapp.payments.prod, table=users
        result = parse_cdc_topic_name(
            "myapp.payments.prod.users", "myapp.payments.prod"
        )
        self.assertEqual(result, {"database": "myapp.payments.prod", "table": "users"})

        # Multiple level server name
        # Server: app.service.env.region
        # Topic: app.service.env.region.schema1.table1
        result = parse_cdc_topic_name(
            "app.service.env.region.schema1.table1", "app.service.env.region"
        )
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
        return source

    def setUp(self):
        """Set up test fixtures"""
        # Create a mock Debezium CDC topic with nested envelope structure
        self.cdc_topic = MagicMock()
        self.cdc_topic.name = "MysqlKafkaV2.ecommerce.orders"
        self.cdc_topic.fullyQualifiedName.root = (
            'KafkaProd."MysqlKafkaV2.ecommerce.orders"'
        )

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
        envelope_field.name = create_field_name(
            "MysqlKafkaV2.ecommerce.orders.Envelope"
        )
        envelope_field.fullyQualifiedName.root = 'KafkaProd."MysqlKafkaV2.ecommerce.orders".MysqlKafkaV2.ecommerce.orders.Envelope'

        # CDC envelope children
        op_field = MagicMock()
        op_field.name = create_field_name("op")
        op_field.children = None
        op_field.fullyQualifiedName.root = 'KafkaProd."MysqlKafkaV2.ecommerce.orders".MysqlKafkaV2.ecommerce.orders.Envelope.op'

        before_field = MagicMock()
        before_field.name = create_field_name("before")
        before_field.children = None
        before_field.fullyQualifiedName.root = 'KafkaProd."MysqlKafkaV2.ecommerce.orders".MysqlKafkaV2.ecommerce.orders.Envelope.before'

        after_field = MagicMock()
        after_field.name = create_field_name("after")
        after_field.children = None
        after_field.fullyQualifiedName.root = 'KafkaProd."MysqlKafkaV2.ecommerce.orders".MysqlKafkaV2.ecommerce.orders.Envelope.after'

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
        envelope_field.name = create_field_name(
            "MysqlKafkaV2.ecommerce.orders.Envelope"
        )

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

        with patch(
            "metadata.ingestion.source.pipeline.kafkaconnect.client.KafkaConnect"
        ):
            self.source = object.__new__(KafkaconnectSource)
            self.source.metadata = self.mock_metadata
            self.source.service_connection = self.mock_service_connection

    def test_resolve_messaging_service_from_config(self):
        """Test resolving messaging service from connector config match"""
        pipeline_details = KafkaConnectPipelineDetails(
            name="test-connector", conn_type="source"
        )

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
        pipeline_details = KafkaConnectPipelineDetails(
            name="test-connector", conn_type="source"
        )

        self.mock_service_connection.messagingServiceName = "configured-kafka-service"

        with patch.object(
            self.source,
            "get_service_from_connector_config",
            return_value=ServiceResolutionResult(
                database_service_name=None, messaging_service_name=None
            ),
        ):
            result = self.source._resolve_messaging_service(pipeline_details)

            self.assertEqual(result, "configured-kafka-service")

    def test_resolve_messaging_service_none(self):
        """Test resolving messaging service when neither config nor connection available"""
        pipeline_details = KafkaConnectPipelineDetails(
            name="test-connector", conn_type="source"
        )

        delattr(self.mock_service_connection, "messagingServiceName")

        with patch.object(
            self.source,
            "get_service_from_connector_config",
            return_value=ServiceResolutionResult(
                database_service_name=None, messaging_service_name=None
            ),
        ):
            result = self.source._resolve_messaging_service(pipeline_details)

            self.assertIsNone(result)

    def test_parse_and_resolve_topics_explicit_list(self):
        """Test topic resolution with explicit pipeline_details.topics"""

        topic1 = KafkaConnectTopics(name="test-topic-1")
        pipeline_details = KafkaConnectPipelineDetails(
            name="test-connector", conn_type="source", topics=[topic1]
        )

        mock_topic_entity = MagicMock(spec=Topic)
        mock_topic_entity.id = "topic-id-1"
        mock_topic_entity.name = "test-topic-1"
        mock_topic_entity.fullyQualifiedName = 'KafkaProd."test-topic-1"'
        mock_topic_entity.service = MagicMock(spec=EntityReference)
        mock_topic_entity.service.name = "KafkaProd"

        with patch.object(self.source.metadata, "get_by_name", return_value=None):
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
                self.assertEqual(
                    result.topic_entity_map["test-topic-1"], mock_topic_entity
                )

    def test_parse_and_resolve_topics_with_fqn(self):
        """Test topic resolution using pre-built FQN"""

        topic_with_fqn = KafkaConnectTopics(
            name="test-topic", fqn='KafkaProd."test-topic"'
        )
        pipeline_details = KafkaConnectPipelineDetails(
            name="test-connector", conn_type="source", topics=[topic_with_fqn]
        )

        mock_topic_entity = MagicMock(spec=Topic)

        with patch.object(
            self.source.metadata, "get_by_name", return_value=mock_topic_entity
        ) as mock_get:
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
        pipeline_details = KafkaConnectPipelineDetails(
            name="test-connector", conn_type="source", topics=[topic]
        )

        mock_topic_entity = MagicMock(spec=Topic)

        with patch("metadata.utils.fqn.build", return_value='KafkaProd."orders-topic"'):
            with patch.object(
                self.source.metadata, "get_by_name", return_value=mock_topic_entity
            ) as mock_get:
                result = self.source._parse_and_resolve_topics(
                    pipeline_details=pipeline_details,
                    database_server_name=None,
                    effective_messaging_service="KafkaProd",
                    is_storage_sink=False,
                )

                mock_get.assert_called_once()
                self.assertEqual(
                    result.topic_entity_map["orders-topic"], mock_topic_entity
                )

    def test_parse_and_resolve_topics_cross_service_search(self):
        """Test topic resolution via cross-service wildcard search"""

        topic = KafkaConnectTopics(name="payments-topic")
        pipeline_details = KafkaConnectPipelineDetails(
            name="test-connector", conn_type="source", topics=[topic]
        )

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
            self.assertEqual(
                result.topic_entity_map["payments-topic"], mock_topic_entity
            )

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

        with patch.object(self.source.metadata, "get_by_name", return_value=None):
            with patch.object(
                self.source.metadata, "search_in_any_service", return_value=None
            ):
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

        with patch.object(self.source.metadata, "get_by_name", return_value=None):
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

        with patch.object(
            self.source, "_search_topics_by_regex", return_value=regex_topics
        ) as mock_search:
            with patch.object(self.source.metadata, "get_by_name", return_value=None):
                with patch.object(
                    self.source.metadata, "search_in_any_service", return_value=None
                ):
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
