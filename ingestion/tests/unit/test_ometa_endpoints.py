"""
OpenMetadata high-level API endpoint test
"""
from unittest import TestCase

from metadata.generated.schema.api.data.createModel import CreateModelEntityRequest
from metadata.generated.schema.api.data.createTopic import CreateTopicEntityRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceEntityRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserEntityRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.metrics import Metrics
from metadata.generated.schema.entity.data.model import Model
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.report import Report
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.task import Task
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.entity.teams.user import User
from metadata.ingestion.ometa.ometa_api import OMeta
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig


class OMetaEndpointTest(TestCase):
    """
    Make sure that we can infer the proper endpoints
    from the generated entity classes
    """

    server_config = MetadataServerConfig(api_endpoint="http://localhost:8585/api")
    metadata = OMeta(server_config)

    def test_entities_suffix(self):
        """
        Pass Entities and test their suffix generation
        """

        # ML
        self.assertEqual(self.metadata.get_suffix(Model), "/models")

        # Db
        self.assertEqual(self.metadata.get_suffix(Database), "/databases")
        self.assertEqual(self.metadata.get_suffix(Table), "/tables")

        # Dashboards
        self.assertEqual(self.metadata.get_suffix(Dashboard), "/dashboards")
        self.assertEqual(self.metadata.get_suffix(Chart), "/charts")
        self.assertEqual(self.metadata.get_suffix(Metrics), "/metrics")
        self.assertEqual(self.metadata.get_suffix(Report), "/reports")

        # Pipelines
        self.assertEqual(self.metadata.get_suffix(Pipeline), "/pipelines")
        self.assertEqual(self.metadata.get_suffix(Task), "/tasks")

        # Topic
        self.assertEqual(self.metadata.get_suffix(Topic), "/topics")

    def test_services_suffix(self):
        """
        Pass Services and test their suffix generation
        """
        self.assertEqual(
            self.metadata.get_suffix(DashboardService), "/services/dashboardServices"
        )
        self.assertEqual(
            self.metadata.get_suffix(DatabaseService), "/services/databaseServices"
        )
        self.assertEqual(
            self.metadata.get_suffix(MessagingService), "/services/messagingServices"
        )
        self.assertEqual(
            self.metadata.get_suffix(PipelineService), "/services/pipelineServices"
        )

    def test_teams_suffix(self):
        """
        Pass Teams and test their suffix generation
        """
        self.assertEqual(self.metadata.get_suffix(User), "/users")

    def test_get_create_entity_type(self):
        """
        Validate the mapping from Entity to CreateEntity
        """
        create = self.metadata.get_create_entity_type(Model)
        assert issubclass(create, CreateModelEntityRequest)

        create = self.metadata.get_create_entity_type(Topic)
        assert issubclass(create, CreateTopicEntityRequest)

        create = self.metadata.get_create_entity_type(DatabaseService)
        assert issubclass(create, CreateDatabaseServiceEntityRequest)

        create = self.metadata.get_create_entity_type(User)
        assert issubclass(create, CreateUserEntityRequest)

    def test_get_entity_from_create(self):
        """
        Validate the mapping from CreateEntity to Entity
        """
        entity = self.metadata.get_entity_from_create(CreateModelEntityRequest)
        assert issubclass(entity, Model)

        entity = self.metadata.get_entity_from_create(CreateTopicEntityRequest)
        assert issubclass(entity, Topic)

        entity = self.metadata.get_entity_from_create(
            CreateDatabaseServiceEntityRequest
        )
        assert issubclass(entity, DatabaseService)

        entity = self.metadata.get_entity_from_create(CreateUserEntityRequest)
        assert issubclass(entity, User)
