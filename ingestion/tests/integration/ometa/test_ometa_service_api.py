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
OpenMetadata high-level API Chart test
"""
from unittest import TestCase

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardService,
    DashboardServiceType,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.messagingService import (
    MessagingService,
    MessagingServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class OMetaServiceTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    server_config = OpenMetadataConnection(hostPort="http://localhost:8585/api")
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    def test_create_database_service_mysql(self):
        """
        Create a db service from WorkflowSource
        """
        data = {
            "type": "mysql",
            "serviceName": "local_mysql",
            "serviceConnection": {
                "config": {
                    "type": "Mysql",
                    "username": "openmetadata_user",
                    "password": "openmetadata_password",
                    "hostPort": "random:3306",
                }
            },
            "sourceConfig": {"config": {"enableDataProfiler": False}},
        }

        workflow_source = WorkflowSource(**data)

        # Create service
        service: DatabaseService = self.metadata.get_service_or_create(
            entity=DatabaseService, config=workflow_source
        )
        assert service
        assert service.serviceType == DatabaseServiceType.Mysql

        # Check get
        assert service == self.metadata.get_service_or_create(
            entity=DatabaseService, config=workflow_source
        )

        # Clean
        self.metadata.delete(entity=DatabaseService, entity_id=service.id)

    def test_create_database_service_mssql(self):
        """
        Create a db service from WorkflowSource
        """
        data = {
            "type": "mssql",
            "serviceName": "local_mssql",
            "serviceConnection": {
                "config": {
                    "type": "Mssql",
                    "username": "openmetadata_user",
                    "password": "openmetadata_password",
                    "hostPort": "random:1433",
                }
            },
            "sourceConfig": {"config": {"enableDataProfiler": False}},
        }

        workflow_source = WorkflowSource(**data)

        # Create service
        service: DatabaseService = self.metadata.get_service_or_create(
            entity=DatabaseService, config=workflow_source
        )
        assert service
        assert service.serviceType == DatabaseServiceType.Mssql

        # Check get
        assert service == self.metadata.get_service_or_create(
            entity=DatabaseService, config=workflow_source
        )

        # Clean
        self.metadata.delete(entity=DatabaseService, entity_id=service.id)

    def test_create_dashboard_service_looker(self):
        """
        Create a db service from WorkflowSource
        """
        data = {
            "type": "looker",
            "serviceName": "local_looker",
            "serviceConnection": {
                "config": {
                    "type": "Looker",
                    "username": "looker_user",
                    "password": "looker_pwd",
                    "hostPort": "http://random:1234",
                }
            },
            "sourceConfig": {"config": {}},
        }

        workflow_source = WorkflowSource(**data)

        # Create service
        service: DashboardService = self.metadata.get_service_or_create(
            entity=DashboardService, config=workflow_source
        )
        assert service
        assert service.serviceType == DashboardServiceType.Looker

        # Check get
        assert service == self.metadata.get_service_or_create(
            entity=DashboardService, config=workflow_source
        )

        # Clean
        self.metadata.delete(entity=DashboardService, entity_id=service.id)

    def test_create_dashboard_service_tableau(self):
        """
        Create a db service from WorkflowSource
        """
        data = {
            "type": "tableau",
            "serviceName": "local_tableau",
            "serviceConnection": {
                "config": {
                    "type": "Tableau",
                    "username": "tb_user",
                    "password": "tb_pwd",
                    "hostPort": "http://random:1234",
                }
            },
            "sourceConfig": {"config": {}},
        }

        workflow_source = WorkflowSource(**data)

        # Create service
        service: DashboardService = self.metadata.get_service_or_create(
            entity=DashboardService, config=workflow_source
        )
        assert service
        assert service.serviceType == DashboardServiceType.Tableau

        # Check get
        assert service == self.metadata.get_service_or_create(
            entity=DashboardService, config=workflow_source
        )

        # Clean
        self.metadata.delete(entity=DashboardService, entity_id=service.id)

    def test_create_messaging_service_kafka(self):
        """
        Create a db service from WorkflowSource
        """
        data = {
            "type": "kafka",
            "serviceName": "local_kafka",
            "serviceConnection": {
                "config": {
                    "type": "Kafka",
                }
            },
            "sourceConfig": {"config": {}},
        }

        workflow_source = WorkflowSource(**data)

        # Create service
        service: MessagingService = self.metadata.get_service_or_create(
            entity=MessagingService, config=workflow_source
        )
        assert service
        assert service.serviceType == MessagingServiceType.Kafka

        # Check get
        assert service == self.metadata.get_service_or_create(
            entity=MessagingService, config=workflow_source
        )

        # Clean
        self.metadata.delete(entity=MessagingService, entity_id=service.id)

    def test_create_messaging_service_pulsar(self):
        """
        Create a db service from WorkflowSource
        """
        data = {
            "type": "pulsar",
            "serviceName": "local_pulsar",
            "serviceConnection": {
                "config": {
                    "type": "Pulsar",
                }
            },
            "sourceConfig": {"config": {}},
        }

        workflow_source = WorkflowSource(**data)

        # Create service
        service: MessagingService = self.metadata.get_service_or_create(
            entity=MessagingService, config=workflow_source
        )
        assert service
        assert service.serviceType == MessagingServiceType.Pulsar

        # Check get
        assert service == self.metadata.get_service_or_create(
            entity=MessagingService, config=workflow_source
        )

        # Clean
        self.metadata.delete(entity=MessagingService, entity_id=service.id)
