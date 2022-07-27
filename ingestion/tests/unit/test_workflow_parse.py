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
Test Workflow pydantic parsing
"""
from unittest import TestCase

from pydantic import ValidationError

from metadata.generated.schema.api.services.ingestionPipelines.testServiceConnection import (
    TestServiceConnectionRequest,
)
from metadata.generated.schema.entity.services.connections.dashboard.tableauConnection import (
    TableauConnection,
)
from metadata.generated.schema.entity.services.connections.database.glueConnection import (
    GlueConnection,
)
from metadata.generated.schema.entity.services.connections.messaging.pulsarConnection import (
    PulsarConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.entity.services.messagingService import (
    MessagingConnection,
)
from metadata.generated.schema.entity.services.metadataService import MetadataConnection
from metadata.generated.schema.metadataIngestion.dashboardServiceMetadataPipeline import (
    DashboardServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.metadataIngestion.pipelineServiceMetadataPipeline import (
    PipelineServiceMetadataPipeline,
)
from metadata.ingestion.api.parser import (
    get_connection_class,
    get_service_type,
    get_source_config_class,
    parse_test_connection_request_gracefully,
    parse_workflow_config_gracefully,
)


class TestWorkflowParse(TestCase):
    """
    Test parsing scenarios of JSON Schemas
    """

    def test_get_service_type(self):
        """
        Test that we can get the service type of a source
        """

        database_service = get_service_type("Mysql")
        self.assertEqual(database_service, DatabaseConnection)

        dashboard_service = get_service_type("Looker")
        self.assertEqual(dashboard_service, DashboardConnection)

        messaging_service = get_service_type("Kafka")
        self.assertEqual(messaging_service, MessagingConnection)

        metadata_service = get_service_type("Amundsen")
        self.assertEqual(metadata_service, MetadataConnection)

        with self.assertRaises(ValueError) as err:
            get_service_type("random")

        self.assertEqual("Cannot find the service type of random", str(err.exception))

    def test_get_connection_class(self):
        """
        Check that we can correctly build the connection module ingredients
        """
        source_type = "Glue"
        connection = get_connection_class(source_type, get_service_type(source_type))
        self.assertEqual(connection, GlueConnection)

        source_type = "Tableau"
        connection = get_connection_class(source_type, get_service_type(source_type))
        self.assertEqual(connection, TableauConnection)

        source_type = "OpenMetadata"
        connection = get_connection_class(source_type, get_service_type(source_type))
        self.assertEqual(connection, OpenMetadataConnection)

        source_type = "Pulsar"
        connection = get_connection_class(source_type, get_service_type(source_type))
        self.assertEqual(connection, PulsarConnection)

    def test_get_source_config_class(self):
        """
        Check that we can correctly build the connection module ingredients
        """
        source_config_type = "Profiler"
        connection = get_source_config_class(source_config_type)
        self.assertEqual(connection, DatabaseServiceProfilerPipeline)

        source_config_type = "DatabaseMetadata"
        connection = get_source_config_class(source_config_type)
        self.assertEqual(connection, DatabaseServiceMetadataPipeline)

        source_config_type = "PipelineMetadata"
        connection = get_source_config_class(source_config_type)
        self.assertEqual(connection, PipelineServiceMetadataPipeline)

        source_config_type = "DashboardMetadata"
        connection = get_source_config_class(source_config_type)
        self.assertEqual(connection, DashboardServiceMetadataPipeline)

    def test_parsing_ok(self):
        """
        Test MSSQL JSON Config parsing OK
        """

        config_dict = {
            "source": {
                "type": "mssql",
                "serviceName": "test_mssql",
                "serviceConnection": {
                    "config": {
                        "type": "Mssql",
                        "database": "master",
                        "username": "sa",
                        "password": "MY%password",
                        "hostPort": "random:1433",
                    }
                },
                "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
            },
            "sink": {"type": "metadata-rest", "config": {}},
            "workflowConfig": {
                "loggerLevel": "WARN",
                "openMetadataServerConfig": {
                    "hostPort": "http://localhost:8585/api",
                    "authProvider": "no-auth",
                },
            },
        }

        self.assertIsNotNone(parse_workflow_config_gracefully(config_dict))

    def test_parsing_ko_mssql(self):
        """
        Test MSSQL JSON Config parsing KO
        """

        config_dict = {
            "source": {
                "type": "mssql",
                "serviceName": "test_mssql",
                "serviceConnection": {
                    "config": {
                        "type": "Mssql",
                        "database": "master",
                        "username": "sa",
                        "password": "MY%password",
                        "hostPort": "localhost:1433",
                        "random": "extra",
                    }
                },
                "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
            },
            "sink": {"type": "metadata-rest", "config": {}},
            "workflowConfig": {
                "loggerLevel": "WARN",
                "openMetadataServerConfig": {
                    "hostPort": "http://localhost:8585/api",
                    "authProvider": "no-auth",
                },
            },
        }

        with self.assertRaises(ValidationError) as err:
            parse_workflow_config_gracefully(config_dict)

        self.assertIn("1 validation error for MssqlConnection", str(err.exception))

    def test_parsing_ko_mssql_source_config(self):
        """
        Test MSSQL JSON Config parsing KO
        """

        config_dict = {
            "source": {
                "type": "mssql",
                "serviceName": "test_mssql",
                "serviceConnection": {
                    "config": {
                        "type": "Mssql",
                        "database": "master",
                        "username": "sa",
                        "password": "MY%password",
                        "hostPort": "localhost:1433",
                    }
                },
                "sourceConfig": {
                    "config": {"type": "DatabaseMetadata", "random": "extra"}
                },
            },
            "sink": {"type": "metadata-rest", "config": {}},
            "workflowConfig": {
                "loggerLevel": "WARN",
                "openMetadataServerConfig": {
                    "hostPort": "http://localhost:8585/api",
                    "authProvider": "no-auth",
                },
            },
        }

        with self.assertRaises(ValidationError) as err:
            parse_workflow_config_gracefully(config_dict)

        self.assertIn(
            "1 validation error for DatabaseServiceMetadataPipeline\nrandom\n  extra fields not permitted (type=value_error.extra)",
            str(err.exception),
        )

    def test_parsing_ko_glue(self):
        """
        Test Glue JSON Config parsing OK
        """

        config_dict = {
            "source": {
                "type": "glue",
                "serviceName": "local_glue",
                "serviceConnection": {
                    "config": {
                        "type": "Glue",
                        "awsConfig": {
                            "awsSecretAccessKey": "aws secret access key",
                            "awsRegion": "aws region",
                            "endPointURL": "https://glue.<region_name>.amazonaws.com/",
                        },
                        "storageServiceName": "storage_name",
                        "random": "extra",
                    }
                },
                "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
            },
            "sink": {"type": "metadata-rest", "config": {}},
            "workflowConfig": {
                "openMetadataServerConfig": {
                    "hostPort": "http://localhost:8585/api",
                    "authProvider": "no-auth",
                }
            },
        }

        with self.assertRaises(ValidationError) as err:
            parse_workflow_config_gracefully(config_dict)

        self.assertIn(
            "1 validation error for GlueConnection\nrandom\n  extra fields not permitted (type=value_error.extra)",
            str(err.exception),
        )

    def test_parsing_ko_airbyte(self):
        """
        Test Glue JSON Config parsing OK
        """

        config_dict = {
            "source": {
                "type": "airbyte",
                "serviceName": "local_airbyte",
                "serviceConnection": {
                    "config": {"type": "Airbyte", "hostPort": "http://localhost:8000"}
                },
                "sourceConfig": {
                    "config": {"type": "PipelineMetadata", "random": "extra"}
                },
            },
            "sink": {"type": "metadata-rest", "config": {}},
            "workflowConfig": {
                "openMetadataServerConfig": {
                    "hostPort": "http://localhost:8585/api",
                    "authProvider": "no-auth",
                }
            },
        }

        with self.assertRaises(ValidationError) as err:
            parse_workflow_config_gracefully(config_dict)

        self.assertIn(
            "1 validation error for PipelineServiceMetadataPipeline\nrandom\n  extra fields not permitted (type=value_error.extra)",
            str(err.exception),
        )

    def test_test_connection_mysql(self):
        """
        Test the TestConnection for MySQL
        """
        config_dict = {
            "connection": {
                "config": {
                    "type": "Mysql",
                    "username": "openmetadata_user",
                    "password": "openmetadata_password",
                    "hostPort": "localhost:3306",
                }
            },
            "connectionType": "Database",
        }

        self.assertIsInstance(
            parse_test_connection_request_gracefully(config_dict),
            TestServiceConnectionRequest,
        )

        config_dict_ko = {
            "connection": {
                "config": {
                    "type": "Mysql",
                    "username": "openmetadata_user",
                    "password": "openmetadata_password",
                }
            },
            "connectionType": "Database",
        }

        with self.assertRaises(ValidationError) as err:
            parse_test_connection_request_gracefully(config_dict_ko)
        self.assertIn(
            "1 validation error for MysqlConnection\nhostPort\n  field required (type=value_error.missing)",
            str(err.exception),
        )

        config_dict_ko2 = {
            "connection": {
                "config": {
                    "type": "Mysql",
                    "username": "openmetadata_user",
                    "password": "openmetadata_password",
                    "hostPort": "localhost:3306",
                    "random": "value",
                }
            },
            "connectionType": "Database",
        }

        with self.assertRaises(ValidationError) as err:
            parse_test_connection_request_gracefully(config_dict_ko2)
        self.assertIn(
            "1 validation error for MysqlConnection\nrandom\n  extra fields not permitted (type=value_error.extra)",
            str(err.exception),
        )
