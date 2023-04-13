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
from metadata.generated.schema.entity.teams.user import AuthenticationMechanism, User
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class OMetaServiceTest(TestCase):
    """
    Run this integration test with the local API available
    Install the ingestion package before running the tests
    """

    service_entity_id = None

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )
    metadata = OpenMetadata(server_config)

    # we need to use ingestion bot user for this test since the admin user won't be able to see the password fields
    ingestion_bot: User = metadata.get_by_name(entity=User, fqn="ingestion-bot")
    ingestion_bot_auth: AuthenticationMechanism = metadata.get_by_id(
        entity=AuthenticationMechanism, entity_id=ingestion_bot.id
    )
    server_config.securityConfig = OpenMetadataJWTClientConfig(
        jwtToken=ingestion_bot_auth.config.JWTToken
    )
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
            "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
        }

        workflow_source = WorkflowSource(**data)

        # Create service
        service: DatabaseService = self.metadata.get_service_or_create(
            entity=DatabaseService, config=workflow_source
        )
        assert service
        assert service.serviceType == DatabaseServiceType.Mysql
        assert (
            service.connection.config.password.get_secret_value()
            == "openmetadata_password"
        )

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
            "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
        }

        workflow_source = WorkflowSource(**data)

        # Create service
        service: DatabaseService = self.metadata.get_service_or_create(
            entity=DatabaseService, config=workflow_source
        )
        assert service
        assert service.serviceType == DatabaseServiceType.Mssql
        assert (
            service.connection.config.password.get_secret_value()
            == "openmetadata_password"
        )

        # Check get
        assert service == self.metadata.get_service_or_create(
            entity=DatabaseService, config=workflow_source
        )

        # Clean
        self.metadata.delete(entity=DatabaseService, entity_id=service.id)

    def test_create_database_service_bigquery(self):
        """
        Create a db service from WorkflowSource
        """
        data = {
            "type": "bigquery",
            "serviceName": "local_bigquery",
            "serviceConnection": {
                "config": {
                    "type": "BigQuery",
                    "credentials": {
                        "gcsConfig": {
                            "type": "service_account",
                            "projectId": "projectID",
                            "privateKeyId": "privateKeyId",
                            "privateKey": "privateKey",
                            "clientEmail": "clientEmail",
                            "clientId": "clientId",
                            "authUri": "https://accounts.google.com/o/oauth2/auth",
                            "tokenUri": "https://oauth2.googleapis.com/token",
                            "authProviderX509CertUrl": "https://www.googleapis.com/oauth2/v1/certs",
                            "clientX509CertUrl": "https://cert.url",
                        }
                    },
                }
            },
            "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
        }

        workflow_source = WorkflowSource(**data)

        # Create service
        service: DatabaseService = self.metadata.get_service_or_create(
            entity=DatabaseService, config=workflow_source
        )
        assert service
        assert service.serviceType == DatabaseServiceType.BigQuery

        # Check get
        assert service == self.metadata.get_service_or_create(
            entity=DatabaseService, config=workflow_source
        )

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
                    "clientId": "id",
                    "clientSecret": "secret",
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
        assert service.connection.config.clientSecret.get_secret_value() == "secret"

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
                    "authType": {"username": "tb_user", "password": "tb_pwd"},
                    "hostPort": "http://random:1234",
                    "siteName": "openmetadata",
                    "apiVersion": "3.15",
                    "env": "tableau_prod",
                }
            },
            "sourceConfig": {"config": {"topicFilterPattern": {}}},
        }

        workflow_source = WorkflowSource(**data)

        # Create service
        service: DashboardService = self.metadata.get_service_or_create(
            entity=DashboardService, config=workflow_source
        )
        assert service
        assert service.serviceType == DashboardServiceType.Tableau
        assert service.connection.config.password.get_secret_value() == "tb_pwd"

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
                "config": {"type": "Kafka", "bootstrapServers": "localhost:9092"}
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
