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
Test Confluent CDC connector using the topology
"""
from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import Task
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.generated.schema.type.entityLineage import ColumnLineage
from metadata.generated.schema.type.schema import Field, FieldDataType
from metadata.ingestion.source.pipeline.confluentcdc.metadata import ConfluentcdcSource
from metadata.ingestion.source.pipeline.confluentcdc.models import (
    ConfluentCdcColumnMapping,
    ConfluentCdcPipelineDetails,
    ConfluentCdcTasks,
    ConfluentCdcTopics,
)

MOCK_CDC_CONFIG = {
    "source": {
        "type": "confluentcdc",
        "serviceName": "local_confluent_cdc",
        "serviceConnection": {
            "config": {
                "type": "ConfluentCDC",
                "hostPort": "http://localhost:8083",
                "verifySSL": False,
            },
        },
        "sourceConfig": {"config": {"type": "PipelineMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "test_token"},
        }
    },
}

MOCK_CONNECTOR_STATUS = {
    "mysql-cdc-source": {
        "status": {
            "name": "mysql-cdc-source",
            "connector": {"state": "RUNNING"},
            "tasks": [{"id": 0, "state": "RUNNING", "worker_id": "worker-1"}],
            "type": "source",
        }
    }
}

MOCK_CONNECTOR_CONFIG = {
    "connector.class": "io.debezium.connector.mysql.MySqlConnector",
    "database.hostname": "mysql",
    "database.name": "ecommerce",
    "table.include.list": "ecommerce.customers,ecommerce.orders",
    "database.server.name": "mysql-server",
}

MOCK_CONNECTOR_TOPICS = {
    "mysql-cdc-source": {"topics": ["mysql-server.ecommerce.customers"]}
}


class TestConfluentCdcSource(TestCase):
    """Test Confluent CDC connector"""

    @patch(
        "metadata.ingestion.source.pipeline.confluentcdc.metadata.ConfluentcdcSource.test_connection"
    )
    def __init__(self, methodName, test_connection=None) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = MOCK_CDC_CONFIG
        self.cdc_source = ConfluentcdcSource.create(
            MOCK_CDC_CONFIG["source"],
            MagicMock(),
        )

    def test_pipeline_name(self):
        """Test pipeline name extraction"""
        pipeline_details = ConfluentCdcPipelineDetails(
            name="mysql-cdc-source",
            status="RUNNING",
        )

        pipeline_name = self.cdc_source.get_pipeline_name(pipeline_details)
        self.assertEqual(pipeline_name, "mysql-cdc-source")

    def test_yield_pipeline(self):
        """Test pipeline entity creation"""
        pipeline_details = ConfluentCdcPipelineDetails(
            name="mysql-cdc-source",
            status="RUNNING",
            tasks=[ConfluentCdcTasks(id=0, state="RUNNING", worker_id="worker-1")],
            topics=[ConfluentCdcTopics(name="mysql-server.ecommerce.customers")],
            conn_type="source",
        )

        with patch.object(
            self.cdc_source.context,
            "get",
            return_value=MagicMock(pipeline_service="local_confluent_cdc"),
        ):
            pipelines = list(self.cdc_source.yield_pipeline(pipeline_details))

        self.assertEqual(len(pipelines), 1)
        pipeline_request = pipelines[0].right
        self.assertIsInstance(pipeline_request, CreatePipelineRequest)
        self.assertEqual(pipeline_request.name, EntityName("mysql-cdc-source"))
        self.assertEqual(len(pipeline_request.tasks), 1)
        self.assertIsInstance(pipeline_request.tasks[0], Task)

    def test_table_to_topic_column_lineage(self):
        """Test column lineage from table to topic"""
        # Mock MySQL table
        mysql_table = Table(
            id="table-1",
            name=EntityName("customers"),
            fullyQualifiedName=FullyQualifiedEntityName(
                "mysql_service.ecommerce.customers"
            ),
            columns=[
                Column(name="id", dataType=DataType.INT),
                Column(name="name", dataType=DataType.STRING),
                Column(name="email", dataType=DataType.STRING),
            ],
            service=MagicMock(name="mysql_service"),
            database=MagicMock(name="ecommerce"),
            databaseSchema=MagicMock(name="public"),
        )

        # Mock Kafka topic with schema
        topic_schema_fields = [
            Field(name="id", dataType=FieldDataType.INT),
            Field(name="name", dataType=FieldDataType.STRING),
            Field(name="email", dataType=FieldDataType.STRING),
        ]

        kafka_topic = Topic(
            id="topic-1",
            name=EntityName("mysql-server.ecommerce.customers"),
            fullyQualifiedName=FullyQualifiedEntityName(
                "kafka_service.mysql-server.ecommerce.customers"
            ),
            messageSchema=MagicMock(schemaFields=topic_schema_fields),
        )

        # Test column lineage generation
        column_mappings = [
            ConfluentCdcColumnMapping(source_column="id", target_column="id"),
            ConfluentCdcColumnMapping(source_column="name", target_column="name"),
        ]

        with patch.object(self.cdc_source, "metadata", MagicMock()):
            lineages = self.cdc_source._build_table_to_topic_column_lineage(
                mysql_table, kafka_topic, column_mappings
            )

        self.assertEqual(len(lineages), 2)
        self.assertIsInstance(lineages[0], ColumnLineage)

    def test_topic_to_table_column_lineage(self):
        """Test column lineage from topic to table"""
        # Mock Kafka topic with schema
        topic_schema_fields = [
            Field(name="id", dataType=FieldDataType.INT),
            Field(name="name", dataType=FieldDataType.STRING),
        ]

        kafka_topic = Topic(
            id="topic-1",
            name=EntityName("mysql-server.ecommerce.customers"),
            fullyQualifiedName=FullyQualifiedEntityName(
                "kafka_service.mysql-server.ecommerce.customers"
            ),
            messageSchema=MagicMock(schemaFields=topic_schema_fields),
        )

        # Mock Postgres table
        postgres_table = Table(
            id="table-2",
            name=EntityName("customers"),
            fullyQualifiedName=FullyQualifiedEntityName(
                "postgres_service.warehouse.public.customers"
            ),
            columns=[
                Column(name="id", dataType=DataType.INT),
                Column(name="name", dataType=DataType.STRING),
            ],
            service=MagicMock(name="postgres_service"),
            database=MagicMock(name="warehouse"),
            databaseSchema=MagicMock(name="public"),
        )

        column_mappings = [
            ConfluentCdcColumnMapping(source_column="id", target_column="id"),
        ]

        with patch.object(self.cdc_source, "metadata", MagicMock()):
            lineages = self.cdc_source._build_topic_to_table_column_lineage(
                kafka_topic, postgres_table, column_mappings
            )

        self.assertEqual(len(lineages), 1)
        self.assertIsInstance(lineages[0], ColumnLineage)

    def test_auto_column_mapping(self):
        """Test automatic column mapping when explicit mappings not available"""
        mysql_table = Table(
            id="table-1",
            name=EntityName("customers"),
            fullyQualifiedName=FullyQualifiedEntityName(
                "mysql_service.ecommerce.customers"
            ),
            columns=[
                Column(name="id", dataType=DataType.INT),
                Column(name="email", dataType=DataType.STRING),
            ],
            service=MagicMock(name="mysql_service"),
            database=MagicMock(name="ecommerce"),
            databaseSchema=MagicMock(name="public"),
        )

        topic_schema_fields = [
            Field(name="id", dataType=FieldDataType.INT),
            Field(name="email", dataType=FieldDataType.STRING),
            Field(name="extra_field", dataType=FieldDataType.STRING),
        ]

        kafka_topic = Topic(
            id="topic-1",
            name=EntityName("customers"),
            fullyQualifiedName=FullyQualifiedEntityName("kafka_service.customers"),
            messageSchema=MagicMock(schemaFields=topic_schema_fields),
        )

        with patch.object(self.cdc_source, "metadata", MagicMock()):
            # No explicit column mappings - should auto-discover
            lineages = self.cdc_source._build_table_to_topic_column_lineage(
                mysql_table, kafka_topic, []
            )

        # Should match 'id' and 'email', but not 'extra_field'
        self.assertEqual(len(lineages), 2)

    def test_find_table_entity_with_es_search(self):
        """Test table entity search using Elasticsearch"""
        mock_metadata = MagicMock()
        mock_table = Table(
            id="table-1",
            name=EntityName("customers"),
            fullyQualifiedName=FullyQualifiedEntityName(
                "mysql_service.ecommerce.public.customers"
            ),
        )

        mock_metadata.es_search_from_fqn.return_value = [mock_table]

        with patch.object(self.cdc_source, "metadata", mock_metadata):
            result = self.cdc_source._find_table_entity(
                database="ecommerce", schema="public", table="customers"
            )

        self.assertIsNotNone(result)
        self.assertEqual(result.name, EntityName("customers"))
        mock_metadata.es_search_from_fqn.assert_called_once()

    def test_find_topic_entity_with_es_search(self):
        """Test topic entity search using Elasticsearch"""
        mock_metadata = MagicMock()
        mock_topic = Topic(
            id="topic-1",
            name=EntityName("customers"),
            fullyQualifiedName=FullyQualifiedEntityName("kafka_service.customers"),
        )

        mock_metadata.es_search_from_fqn.return_value = [mock_topic]

        with patch.object(self.cdc_source, "metadata", mock_metadata):
            result = self.cdc_source._find_topic_entity(topic_name="customers")

        self.assertIsNotNone(result)
        self.assertEqual(result.name, EntityName("customers"))
        mock_metadata.es_search_from_fqn.assert_called_once()
