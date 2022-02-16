#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
OpenMetadata high-level API endpoint test
"""
from unittest import TestCase

from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.metrics import Metrics
from metadata.generated.schema.entity.data.mlmodel import MlModel
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.report import Report
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.entity.teams.user import User
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig


class OMetaEndpointTest(TestCase):
    """
    Make sure that we can infer the proper endpoints
    from the generated entity classes
    """

    server_config = MetadataServerConfig(api_endpoint="http://localhost:8585/api")
    metadata = OpenMetadata(server_config)

    def test_entities_suffix(self):
        """
        Pass Entities and test their suffix generation
        """


        # Glossary
        self.assertEqual(self.metadata.get_suffix(Glossary), "/glossary")

        # ML
        self.assertEqual(self.metadata.get_suffix(MlModel), "/mlmodels")

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

        create = self.metadata.get_create_entity_type(Topic)
        assert issubclass(create, CreateTopicRequest)

        create = self.metadata.get_create_entity_type(DatabaseService)
        assert issubclass(create, CreateDatabaseServiceRequest)

        create = self.metadata.get_create_entity_type(User)
        assert issubclass(create, CreateUserRequest)

    def test_get_entity_from_create(self):
        """
        Validate the mapping from CreateEntity to Entity
        """

        entity = self.metadata.get_entity_from_create(CreateTopicRequest)
        assert issubclass(entity, Topic)

        entity = self.metadata.get_entity_from_create(CreateDatabaseServiceRequest)
        assert issubclass(entity, DatabaseService)

        entity = self.metadata.get_entity_from_create(CreateUserRequest)
        assert issubclass(entity, User)
