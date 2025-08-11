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
OpenMetadata high-level API endpoint test
"""
from unittest import TestCase

from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.api.services.ingestionPipelines.createIngestionPipeline import (
    CreateIngestionPipelineRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.metric import Metric
from metadata.generated.schema.entity.data.mlmodel import MlModel
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.report import Report
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class OMetaEndpointTest(TestCase):
    """
    Make sure that we can infer the proper endpoints
    from the generated entity classes
    """

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )
    metadata = OpenMetadata(server_config)

    def test_entities_suffix(self):
        """
        Pass Entities and test their suffix generation
        """
        # ML
        self.assertEqual(self.metadata.get_suffix(MlModel), "/mlmodels")

        # Db
        self.assertEqual(self.metadata.get_suffix(Database), "/databases")
        self.assertEqual(self.metadata.get_suffix(DatabaseSchema), "/databaseSchemas")
        self.assertEqual(self.metadata.get_suffix(Table), "/tables")

        # Dashboards
        self.assertEqual(self.metadata.get_suffix(Dashboard), "/dashboards")
        self.assertEqual(self.metadata.get_suffix(Chart), "/charts")
        self.assertEqual(self.metadata.get_suffix(Metric), "/metrics")
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

        entity = self.metadata.get_entity_from_create(CreateIngestionPipelineRequest)
        assert issubclass(entity, IngestionPipeline)
