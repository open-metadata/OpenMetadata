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
OpenMetadata high-level API Service test
"""

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


class TestOMetaServiceAPI:
    """
    Service API integration tests.
    Tests get_service_or_create for various service types.

    Uses fixtures from conftest:
    - metadata: OpenMetadata client (session scope)
    - metadata_ingestion_bot: OpenMetadata client as ingestion-bot (module scope)
    """

    def test_create_database_service_mysql(self, metadata_ingestion_bot):
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
                    "authType": {"password": "openmetadata_password"},
                    "hostPort": "random:3306",
                }
            },
            "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
        }

        workflow_source = WorkflowSource(**data)

        service: DatabaseService = metadata_ingestion_bot.get_service_or_create(
            entity=DatabaseService, config=workflow_source
        )
        assert service
        assert service.serviceType == DatabaseServiceType.Mysql
        assert (
            service.connection.config.authType.password.get_secret_value()
            == "openmetadata_password"
        )

        assert service == metadata_ingestion_bot.get_service_or_create(
            entity=DatabaseService, config=workflow_source
        )

        metadata_ingestion_bot.delete(
            entity=DatabaseService,
            entity_id=service.id,
            hard_delete=True,
            recursive=True,
        )

    def test_create_database_service_mssql(self, metadata_ingestion_bot):
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
                    "database": "master",
                }
            },
            "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
        }

        workflow_source = WorkflowSource(**data)

        service: DatabaseService = metadata_ingestion_bot.get_service_or_create(
            entity=DatabaseService, config=workflow_source
        )
        assert service
        assert service.serviceType == DatabaseServiceType.Mssql
        assert (
            service.connection.config.password.get_secret_value()
            == "openmetadata_password"
        )

        assert service == metadata_ingestion_bot.get_service_or_create(
            entity=DatabaseService, config=workflow_source
        )

        metadata_ingestion_bot.delete(
            entity=DatabaseService,
            entity_id=service.id,
            hard_delete=True,
            recursive=True,
        )

    def test_create_database_service_bigquery(self, metadata_ingestion_bot):
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
                        "gcpConfig": {
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

        service: DatabaseService = metadata_ingestion_bot.get_service_or_create(
            entity=DatabaseService, config=workflow_source
        )
        assert service
        assert service.serviceType == DatabaseServiceType.BigQuery

        assert service == metadata_ingestion_bot.get_service_or_create(
            entity=DatabaseService, config=workflow_source
        )

        metadata_ingestion_bot.delete(
            entity=DatabaseService,
            entity_id=service.id,
            hard_delete=True,
            recursive=True,
        )

    def test_create_dashboard_service_looker(self, metadata_ingestion_bot):
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

        service: DashboardService = metadata_ingestion_bot.get_service_or_create(
            entity=DashboardService, config=workflow_source
        )
        assert service
        assert service.serviceType == DashboardServiceType.Looker
        assert service.connection.config.clientSecret.get_secret_value() == "secret"

        assert service == metadata_ingestion_bot.get_service_or_create(
            entity=DashboardService, config=workflow_source
        )

        metadata_ingestion_bot.delete(
            entity=DashboardService,
            entity_id=service.id,
            hard_delete=True,
            recursive=True,
        )

    def test_create_dashboard_service_tableau(self, metadata_ingestion_bot):
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
                }
            },
            "sourceConfig": {"config": {"topicFilterPattern": {}}},
        }

        workflow_source = WorkflowSource(**data)

        service: DashboardService = metadata_ingestion_bot.get_service_or_create(
            entity=DashboardService, config=workflow_source
        )
        assert service
        assert service.serviceType == DashboardServiceType.Tableau
        assert (
            service.connection.config.authType.password.get_secret_value() == "tb_pwd"
        )

        assert service == metadata_ingestion_bot.get_service_or_create(
            entity=DashboardService, config=workflow_source
        )

        metadata_ingestion_bot.delete(
            entity=DashboardService,
            entity_id=service.id,
            hard_delete=True,
            recursive=True,
        )

    def test_create_messaging_service_kafka(self, metadata_ingestion_bot):
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

        service: MessagingService = metadata_ingestion_bot.get_service_or_create(
            entity=MessagingService, config=workflow_source
        )
        assert service
        assert service.serviceType == MessagingServiceType.Kafka

        assert service == metadata_ingestion_bot.get_service_or_create(
            entity=MessagingService, config=workflow_source
        )

        metadata_ingestion_bot.delete(
            entity=MessagingService,
            entity_id=service.id,
            hard_delete=True,
            recursive=True,
        )

    def test_create_db_service_without_connection(self, metadata_ingestion_bot):
        """We can create a service via API without storing the creds"""
        config = metadata_ingestion_bot.config.model_copy(deep=True)
        config.storeServiceConnection = False
        metadata_no_password = OpenMetadata(config)

        data = {
            "type": "mysql",
            "serviceName": "mysql_no_conn",
            "serviceConnection": {
                "config": {
                    "type": "Mysql",
                    "username": "openmetadata_user",
                    "authType": {"password": "openmetadata_password"},
                    "hostPort": "random:3306",
                }
            },
            "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
        }

        workflow_source = WorkflowSource(**data)

        service: DatabaseService = metadata_no_password.get_service_or_create(
            entity=DatabaseService, config=workflow_source
        )
        assert service
        assert service.serviceType == DatabaseServiceType.Mysql
        assert service.connection is None

        assert service == metadata_no_password.get_service_or_create(
            entity=DatabaseService, config=workflow_source
        )

        metadata_no_password.delete(
            entity=DatabaseService,
            entity_id=service.id,
            hard_delete=True,
            recursive=True,
        )

    def test_create_dashboard_service_without_connection(self, metadata_ingestion_bot):
        """We can create a service via API without storing the creds"""
        config = metadata_ingestion_bot.config.model_copy(deep=True)
        config.storeServiceConnection = False
        metadata_no_password = OpenMetadata(config)

        data = {
            "type": "tableau",
            "serviceName": "tableau_no_conn",
            "serviceConnection": {
                "config": {
                    "type": "Tableau",
                    "authType": {"username": "tb_user", "password": "tb_pwd"},
                    "hostPort": "http://random:1234",
                    "siteName": "openmetadata",
                }
            },
            "sourceConfig": {"config": {"topicFilterPattern": {}}},
        }

        workflow_source = WorkflowSource(**data)

        service: DashboardService = metadata_no_password.get_service_or_create(
            entity=DashboardService, config=workflow_source
        )
        assert service
        assert service.serviceType == DashboardServiceType.Tableau
        assert service.connection is None

        assert service == metadata_no_password.get_service_or_create(
            entity=DashboardService, config=workflow_source
        )

        metadata_no_password.delete(
            entity=DashboardService,
            entity_id=service.id,
            hard_delete=True,
            recursive=True,
        )
