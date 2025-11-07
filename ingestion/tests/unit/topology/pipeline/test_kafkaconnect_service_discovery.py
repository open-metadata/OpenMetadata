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
Test KafkaConnect service discovery and caching functionality
"""
from unittest import TestCase
from unittest.mock import Mock, patch

from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.ingestion.source.pipeline.kafkaconnect.metadata import KafkaconnectSource
from metadata.ingestion.source.pipeline.kafkaconnect.models import (
    KafkaConnectPipelineDetails,
)


class TestServiceCaching(TestCase):
    """Test service caching functionality"""

    def _create_mock_service(self, name, service_type, host_port=None):
        """Helper to create a mock database service"""
        service = Mock(spec=DatabaseService)
        service.name = Mock()
        service.name.root = name
        service.serviceType = Mock()
        service.serviceType.value = service_type

        if host_port:
            service.connection = Mock()
            service.connection.config = Mock()
            service.connection.config.hostPort = host_port
        else:
            service.connection = None

        return service

    def _create_mock_messaging_service(self, name, bootstrap_servers=None):
        """Helper to create a mock messaging service"""
        service = Mock(spec=MessagingService)
        service.name = Mock()
        service.name.root = name

        if bootstrap_servers:
            service.connection = Mock()
            service.connection.config = Mock()
            service.connection.config.bootstrapServers = bootstrap_servers
        else:
            service.connection = None

        return service

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.__init__"
    )
    def test_database_services_property_caches_results(self, mock_parent_init):
        """Test that database_services property caches results"""
        mock_parent_init.return_value = None

        mock_config = Mock()
        mock_config.serviceConnection.root.config.hostPort = "http://localhost:8083"
        mock_config.serviceConnection.root.config.verifySSL = True

        mock_metadata = Mock()
        mock_db_services = [
            self._create_mock_service("mysql-prod", "Mysql", "localhost:3306"),
            self._create_mock_service("postgres-prod", "Postgres", "localhost:5432"),
        ]
        mock_metadata.list_all_entities.return_value = iter(mock_db_services)

        source = KafkaconnectSource(mock_config, mock_metadata)
        source.metadata = (
            mock_metadata  # Set metadata manually since parent __init__ is mocked
        )

        # First access - should call list_all_entities
        services1 = source.database_services
        self.assertEqual(len(services1), 2)
        self.assertEqual(mock_metadata.list_all_entities.call_count, 1)

        # Second access - should use cache (no additional call)
        services2 = source.database_services
        self.assertEqual(len(services2), 2)
        self.assertEqual(mock_metadata.list_all_entities.call_count, 1)

        # Verify same object is returned (cached)
        self.assertIs(services1, services2)

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.__init__"
    )
    def test_messaging_services_property_caches_results(self, mock_parent_init):
        """Test that messaging_services property caches results"""
        mock_parent_init.return_value = None

        mock_config = Mock()
        mock_config.serviceConnection.root.config.hostPort = "http://localhost:8083"

        mock_metadata = Mock()
        mock_msg_services = [
            self._create_mock_messaging_service(
                "kafka-prod", "broker1:9092,broker2:9092"
            ),
            self._create_mock_messaging_service("kafka-dev", "localhost:9092"),
        ]
        mock_metadata.list_all_entities.return_value = iter(mock_msg_services)

        source = KafkaconnectSource(mock_config, mock_metadata)
        source.metadata = (
            mock_metadata  # Set metadata manually since parent __init__ is mocked
        )

        # First access - should call list_all_entities
        services1 = source.messaging_services
        self.assertEqual(len(services1), 2)
        self.assertEqual(mock_metadata.list_all_entities.call_count, 1)

        # Second access - should use cache
        services2 = source.messaging_services
        self.assertEqual(len(services2), 2)
        self.assertEqual(mock_metadata.list_all_entities.call_count, 1)

        # Verify same object is returned (cached)
        self.assertIs(services1, services2)


class TestServiceDiscovery(TestCase):
    """Test database and messaging service discovery"""

    def _create_mock_db_service(self, name, service_type, host_port):
        """Helper to create a mock database service"""
        service = Mock(spec=DatabaseService)
        service.name = Mock()
        service.name.root = name
        service.serviceType = Mock()
        service.serviceType.value = service_type
        service.connection = Mock()
        service.connection.config = Mock()
        service.connection.config.hostPort = host_port
        return service

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.__init__"
    )
    def test_find_database_service_by_hostname_matches_correctly(
        self, mock_parent_init
    ):
        """Test finding database service by hostname with port stripping"""
        mock_parent_init.return_value = None

        mock_config = Mock()
        mock_config.serviceConnection.root.config.hostPort = "http://localhost:8083"

        mock_metadata = Mock()
        mock_db_services = [
            self._create_mock_db_service(
                "mysql-prod", "Mysql", "mysql.example.com:3306"
            ),
            self._create_mock_db_service(
                "postgres-prod", "Postgres", "postgres.example.com:5432"
            ),
        ]
        mock_metadata.list_all_entities.return_value = iter(mock_db_services)

        source = KafkaconnectSource(mock_config, mock_metadata)
        source.metadata = (
            mock_metadata  # Set metadata manually since parent __init__ is mocked
        )

        # Test matching MySQL service
        result = source.find_database_service_by_hostname(
            "Mysql", "mysql.example.com:3306"
        )
        self.assertEqual(result, "mysql-prod")

        # Test matching with protocol prefix
        result = source.find_database_service_by_hostname(
            "Mysql", "jdbc:mysql://mysql.example.com:3306/db"
        )
        self.assertEqual(result, "mysql-prod")

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.__init__"
    )
    def test_find_messaging_service_by_brokers_matches_correctly(
        self, mock_parent_init
    ):
        """Test finding messaging service by broker endpoints"""
        mock_parent_init.return_value = None

        mock_config = Mock()
        mock_config.serviceConnection.root.config.hostPort = "http://localhost:8083"

        mock_metadata = Mock()

        kafka_service = Mock(spec=MessagingService)
        kafka_service.name = Mock()
        kafka_service.name.root = "kafka-prod"
        kafka_service.connection = Mock()
        kafka_service.connection.config = Mock()
        kafka_service.connection.config.bootstrapServers = (
            "broker1.example.com:9092,broker2.example.com:9092"
        )

        mock_metadata.list_all_entities.return_value = iter([kafka_service])

        source = KafkaconnectSource(mock_config, mock_metadata)
        source.metadata = (
            mock_metadata  # Set metadata manually since parent __init__ is mocked
        )

        # Test matching with protocol prefix
        result = source.find_messaging_service_by_brokers(
            "SASL_SSL://broker1.example.com:9092,SASL_SSL://broker2.example.com:9092"
        )
        self.assertEqual(result, "kafka-prod")

        # Test matching with partial overlap
        result = source.find_messaging_service_by_brokers("broker1.example.com:9092")
        self.assertEqual(result, "kafka-prod")


class TestTopicSearchByPrefix(TestCase):
    """Test topic search by prefix fallback mechanism"""

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.__init__"
    )
    def test_search_topics_by_prefix_finds_matching_topics(self, mock_parent_init):
        """Test searching for topics by database.server.name prefix"""
        mock_parent_init.return_value = None

        mock_config = Mock()
        mock_config.serviceConnection.root.config.hostPort = "http://localhost:8083"

        mock_metadata = Mock()

        # Create mock topics
        topic1 = Mock()
        topic1.name = Mock()
        topic1.name.root = "myserver.public.users"
        topic1.fullyQualifiedName = Mock()
        topic1.fullyQualifiedName.root = 'kafka-prod."myserver.public.users"'

        topic2 = Mock()
        topic2.name = Mock()
        topic2.name.root = "myserver.public.orders"
        topic2.fullyQualifiedName = Mock()
        topic2.fullyQualifiedName.root = 'kafka-prod."myserver.public.orders"'

        topic3 = Mock()
        topic3.name = Mock()
        topic3.name.root = "other.topic"
        topic3.fullyQualifiedName = Mock()
        topic3.fullyQualifiedName.root = "kafka-prod.other.topic"

        mock_metadata.list_all_entities.return_value = iter([topic1, topic2, topic3])

        source = KafkaconnectSource(mock_config, mock_metadata)
        source.metadata = (
            mock_metadata  # Set metadata manually since parent __init__ is mocked
        )

        # Search for topics with prefix "myserver"
        result = source._search_topics_by_prefix("myserver", "kafka-prod")

        # Should find only topics starting with "myserver."
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0].name, "myserver.public.users")
        self.assertEqual(result[1].name, "myserver.public.orders")

        # Verify FQNs are populated
        self.assertEqual(result[0].fqn, 'kafka-prod."myserver.public.users"')
        self.assertEqual(result[1].fqn, 'kafka-prod."myserver.public.orders"')

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.__init__"
    )
    def test_search_topics_by_prefix_returns_empty_when_none_match(
        self, mock_parent_init
    ):
        """Test that search returns empty list when no topics match"""
        mock_parent_init.return_value = None

        mock_config = Mock()
        mock_config.serviceConnection.root.config.hostPort = "http://localhost:8083"

        mock_metadata = Mock()

        topic = Mock()
        topic.name = Mock()
        topic.name.root = "other.topic"

        mock_metadata.list_all_entities.return_value = iter([topic])

        source = KafkaconnectSource(mock_config, mock_metadata)

        # Search for topics with prefix that doesn't exist
        result = source._search_topics_by_prefix("nonexistent", "kafka-prod")

        self.assertEqual(len(result), 0)

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.__init__"
    )
    def test_search_topics_by_prefix_handles_no_messaging_service(
        self, mock_parent_init
    ):
        """Test that search handles None messaging service gracefully"""
        mock_parent_init.return_value = None

        mock_config = Mock()
        mock_config.serviceConnection.root.config.hostPort = "http://localhost:8083"

        mock_metadata = Mock()

        source = KafkaconnectSource(mock_config, mock_metadata)

        # Search without messaging service name
        result = source._search_topics_by_prefix("myserver", None)

        # Should return empty list
        self.assertEqual(len(result), 0)


class TestCDCTopicFallback(TestCase):
    """Test CDC topic parsing with table.include.list fallback"""

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.__init__"
    )
    def test_parse_cdc_topics_from_config_with_table_include_list(
        self, mock_parent_init
    ):
        """Test parsing topics from table.include.list"""
        mock_parent_init.return_value = None

        mock_config = Mock()
        mock_config.serviceConnection.root.config.hostPort = "http://localhost:8083"

        mock_metadata = Mock()
        source = KafkaconnectSource(mock_config, mock_metadata)

        pipeline_details = KafkaConnectPipelineDetails(
            name="test-connector",
            config={
                "connector.class": "io.debezium.connector.mysql.MySqlConnector",
                "database.server.name": "myserver",
                "table.include.list": "public.users,public.orders,inventory.products",
            },
        )

        result = source._parse_cdc_topics_from_config(pipeline_details, "myserver")

        # Should create topics for each table
        self.assertEqual(len(result), 3)
        self.assertEqual(result[0].name, "myserver.public.users")
        self.assertEqual(result[1].name, "myserver.public.orders")
        self.assertEqual(result[2].name, "myserver.inventory.products")

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.__init__"
    )
    def test_parse_cdc_topics_returns_empty_without_table_include_list(
        self, mock_parent_init
    ):
        """Test that parsing returns empty when table.include.list is missing"""
        mock_parent_init.return_value = None

        mock_config = Mock()
        mock_config.serviceConnection.root.config.hostPort = "http://localhost:8083"

        mock_metadata = Mock()
        source = KafkaconnectSource(mock_config, mock_metadata)

        pipeline_details = KafkaConnectPipelineDetails(
            name="test-connector",
            config={
                "connector.class": "io.debezium.connector.mysql.MySqlConnector",
                "database.server.name": "myserver",
                # No table.include.list
            },
        )

        with self.assertLogs(level="WARNING") as log:
            result = source._parse_cdc_topics_from_config(pipeline_details, "myserver")

        # Should return empty list
        self.assertEqual(len(result), 0)

        # Should log warning about missing table.include.list
        self.assertTrue(any("table.include.list" in message for message in log.output))

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.__init__"
    )
    def test_parse_cdc_topics_supports_table_whitelist_legacy(self, mock_parent_init):
        """Test that table.whitelist (legacy key) is also supported"""
        mock_parent_init.return_value = None

        mock_config = Mock()
        mock_config.serviceConnection.root.config.hostPort = "http://localhost:8083"

        mock_metadata = Mock()
        source = KafkaconnectSource(mock_config, mock_metadata)

        pipeline_details = KafkaConnectPipelineDetails(
            name="test-connector",
            config={
                "connector.class": "io.debezium.connector.mysql.MySqlConnector",
                "database.server.name": "myserver",
                "table.whitelist": "public.users",  # Legacy key
            },
        )

        result = source._parse_cdc_topics_from_config(pipeline_details, "myserver")

        # Should parse from legacy key
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].name, "myserver.public.users")
