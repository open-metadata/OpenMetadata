"""
OpenMetadata high-level API endpoint test
"""
from unittest import TestCase

from ingestion.src.metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.metrics import Metrics
from metadata.generated.schema.entity.data.model import Model
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.report import Report
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.task import Task
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.ingestion.models.table_metadata import Dashboard
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
