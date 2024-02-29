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

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.dashboard.tableauConnection import (
    TableauConnection,
)
from metadata.generated.schema.entity.services.connections.database.glueConnection import (
    GlueConnection,
)
from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
    KafkaConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)
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
    ParsingConfigurationError,
    get_connection_class,
    get_service_type,
    get_source_config_class,
    parse_automation_workflow_gracefully,
    parse_ingestion_pipeline_config_gracefully,
    parse_workflow_config_gracefully,
)


class TestWorkflowParse(TestCase):
    """
    Test parsing scenarios of JSON Schemas
    """

    def test_get_service_type(self):
        """
        Test that we can get the service type of source
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

        source_type = "Kafka"
        connection = get_connection_class(source_type, get_service_type(source_type))
        self.assertEqual(connection, KafkaConnection)

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
                    "authProvider": "openmetadata",
                    "securityConfig": {"jwtToken": "token"},
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

        with self.assertRaises(ParsingConfigurationError) as err:
            parse_workflow_config_gracefully(config_dict)

        self.assertIn(
            "We encountered an error parsing the configuration of your MssqlConnection.\nYou might need to review your config based on the original cause of this failure:\n\t - Extra parameter 'random'",
            str(err.exception),
        )

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

        with self.assertRaises(ParsingConfigurationError) as err:
            parse_workflow_config_gracefully(config_dict)

        self.assertIn(
            "We encountered an error parsing the configuration of your DatabaseServiceMetadataPipeline.\nYou might need to review your config based on the original cause of this failure:\n\t - Extra parameter 'random'",
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

        with self.assertRaises(ParsingConfigurationError) as err:
            parse_workflow_config_gracefully(config_dict)

        self.assertIn(
            "We encountered an error parsing the configuration of your GlueConnection.\nYou might need to review your config based on the original cause of this failure:\n\t - Extra parameter 'random'",
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

        with self.assertRaises(ParsingConfigurationError) as err:
            parse_workflow_config_gracefully(config_dict)

        self.assertIn(
            "We encountered an error parsing the configuration of your PipelineServiceMetadataPipeline.\nYou might need to review your config based on the original cause of this failure:\n\t - Extra parameter 'random'",
            str(err.exception),
        )

    def test_parsing_ingestion_pipeline_mysql(self):
        """
        Test parsing of ingestion_pipeline for MYSQL
        """
        config_dict = {
            "id": "08868b3e-cd02-4257-a545-9080856371a0",
            "name": "qwfef_metadata_SPWHTqVO",
            "pipelineType": "metadata",
            "sourceConfig": {
                "config": {
                    "type": "DatabaseMetadata",
                    "includeTags": True,
                    "includeViews": True,
                    "includeTables": True,
                    "queryLogDuration": 1,
                    "markDeletedTables": True,
                    "tableFilterPattern": {"excludes": [], "includes": []},
                    "useFqnForFiltering": True,
                    "schemaFilterPattern": {"excludes": [], "includes": []},
                    "databaseFilterPattern": {"excludes": [], "includes": []},
                    "includeStoredProcedures": True,
                    "queryParsingTimeoutLimit": 300,
                    "markDeletedStoredProcedures": True,
                }
            },
            "airflowConfig": {
                "retries": 0,
                "startDate": "2023-12-19T00:00:00.000000Z",
                "retryDelay": 300,
                "concurrency": 1,
                "maxActiveRuns": 1,
                "pausePipeline": False,
                "pipelineCatchup": False,
                "pipelineTimezone": "UTC",
                "scheduleInterval": "0 * * * *",
                "workflowDefaultView": "tree",
                "workflowDefaultViewOrientation": "LR",
            },
        }

        self.assertIsInstance(
            parse_ingestion_pipeline_config_gracefully(config_dict),
            IngestionPipeline,
        )

        config_dict_ko = {
            "id": "08868b3e-cd02-4257-a545-9080856371a0",
            "name": "qwfef_metadata_SPWHTqVO",
            "pipelineType": "metadata",
            "sourceConfig": {
                "config": {
                    "type": "DatabaseMetadata",
                    "includeTags": True,
                    "includeViews": True,
                    "includeTables": True,
                    "viewLogDuration": 1,
                    "markDeletedTables": True,
                    "tFilterPattern": {"excludes": [], "includes": []},
                    "useFqnForFiltering": True,
                    "schemaFilterPattern": {"excludes": [], "includes": []},
                    "databaseFilterPattern": {"excludes": [], "includes": []},
                    "includeStoredProcedures": True,
                    "queryParsingTimeoutLimit": 300,
                    "markDeletedStoredProcedures": True,
                }
            },
            "airflowConfig": {
                "retries": 0,
                "startDate": "2023-12-19T00:00:00.000000Z",
                "retryDelay": 300,
                "concurrency": 1,
                "maxActiveRuns": 1,
                "pausePipeline": False,
                "pipelineCatchup": False,
                "pipelineTimezone": "UTC",
                "scheduleInterval": "0 * * * *",
                "workflowDefaultView": "tree",
                "workflowDefaultViewOrientation": "LR",
            },
        }

        with self.assertRaises(ValidationError) as err:
            parse_ingestion_pipeline_config_gracefully(config_dict_ko)
        self.assertIn(
            "2 validation errors for DatabaseServiceMetadataPipeline\ntFilterPattern\n  extra fields not permitted (type=value_error.extra)\nviewLogDuration\n  extra fields not permitted (type=value_error.extra)",
            str(err.exception),
        )

    def test_parsing_ingestion_pipeline_dagster(self):
        """
        Test parsing of ingestion_pipeline for Dagster
        """
        config_dict = {
            "id": "da50179a-02c8-42d1-a8bd-3002a49649a6",
            "name": "dagster_dev_metadata_G6pRkj7X",
            "pipelineType": "metadata",
            "sourceConfig": {
                "config": {
                    "type": "PipelineMetadata",
                    "includeTags": True,
                    "includeOwners": True,
                    "dbServiceNames": ["dev"],
                    "includeLineage": True,
                    "markDeletedPipelines": True,
                    "pipelineFilterPattern": {
                        "excludes": [],
                        "includes": ["test_pipeline"],
                    },
                }
            },
            "airflowConfig": {
                "retries": 0,
                "startDate": "2023-12-19T00:00:00.000000Z",
                "retryDelay": 300,
                "concurrency": 1,
                "maxActiveRuns": 1,
                "pausePipeline": False,
                "pipelineCatchup": False,
                "pipelineTimezone": "UTC",
                "scheduleInterval": "0 * * * *",
                "workflowDefaultView": "tree",
                "workflowDefaultViewOrientation": "LR",
            },
        }
        self.assertIsInstance(
            parse_ingestion_pipeline_config_gracefully(config_dict),
            IngestionPipeline,
        )

        config_dict_ko = {
            "id": "da50179a-02c8-42d1-a8bd-3002a49649a6",
            "name": "dagster_dev_metadata_G6pRkj7X",
            "pipelineType": "metadata",
            "sourceConfig": {
                "config": {
                    "type": "PipelineMetadata",
                    "includeTags": True,
                    "includeOwners": True,
                    "dbServiceNames": ["dev"],
                    "includeViewLineage": True,
                    "markDeletedDbs": True,
                    "pipelineFilterPatterns": {
                        "excludes": [],
                        "includes": ["test_pipeline"],
                    },
                }
            },
            "airflowConfig": {
                "retries": 0,
                "startDate": "2023-12-19T00:00:00.000000Z",
                "retryDelay": 300,
                "concurrency": 1,
                "maxActiveRuns": 1,
                "pausePipeline": False,
                "pipelineCatchup": False,
                "pipelineTimezone": "UTC",
                "scheduleInterval": "0 * * * *",
                "workflowDefaultView": "tree",
                "workflowDefaultViewOrientation": "LR",
            },
        }

        with self.assertRaises(ValidationError) as err:
            parse_ingestion_pipeline_config_gracefully(config_dict_ko)
        self.assertIn(
            "3 validation errors for PipelineServiceMetadataPipeline\nincludeViewLineage\n  extra fields not permitted (type=value_error.extra)\nmarkDeletedDbs\n  extra fields not permitted (type=value_error.extra)\npipelineFilterPatterns\n  extra fields not permitted (type=value_error.extra)",
            str(err.exception),
        )

    def test_parsing_automation_workflow_airflow(self):
        """
        Test parsing of automation workflow for airflow
        """
        config_dict = {
            "id": "8b735b2c-194e-41a4-b383-96253f936293",
            "name": "test-connection-Airflow-WhCTUSXJ",
            "deleted": False,
            "request": {
                "connection": {
                    "config": {
                        "type": "Airflow",
                        "hostPort": "https://localhost:8080",
                        "connection": {
                            "type": "Mysql",
                            "scheme": "mysql+pymysql",
                            "authType": {"password": "fernet:demo_password"},
                            "hostPort": "mysql:3306",
                            "username": "admin@openmetadata.org",
                            "databaseName": "airflow_db",
                            "supportsProfiler": True,
                            "supportsQueryComment": True,
                            "supportsDBTExtraction": True,
                            "supportsMetadataExtraction": True,
                        },
                        "numberOfStatus": 10,
                        "supportsMetadataExtraction": True,
                    }
                },
                "serviceName": "airflow_test_two",
                "serviceType": "Pipeline",
                "connectionType": "Airflow",
                "secretsManagerProvider": "db",
            },
            "version": 0.1,
            "updatedAt": 1703157653864,
            "updatedBy": "admin",
            "workflowType": "TEST_CONNECTION",
            "fullyQualifiedName": "test-connection-Airflow-WhCTUSXJ",
        }
        self.assertIsInstance(
            parse_automation_workflow_gracefully(config_dict),
            AutomationWorkflow,
        )

        config_dict_ko = {
            "id": "8b735b2c-194e-41a4-b383-96253f936293",
            "name": "test-connection-Airflow-WhCTUSXJ",
            "deleted": False,
            "request": {
                "connection": {
                    "config": {
                        "type": "Airflow",
                        "hostPort": "localhost:8080",
                        "connection": {
                            "type": "Mysql",
                            "scheme": "mysql+pymysql",
                            "authType": {"password": "fernet:demo_password"},
                            "hostPort": "mysql:3306",
                            "username": "admin@openmetadata.org",
                            "databaseName": "airflow_db",
                            "supportsProfiler": True,
                            "supportsQueryComment": True,
                            "supportsDBTExtraction": True,
                            "supportsMetadataExtraction": True,
                        },
                        "numberOfStatus": 10,
                        "supportsMetadataExtraction": True,
                    }
                },
                "serviceName": "airflow_test_two",
                "serviceType": "Pipeline",
                "connectionType": "Airflow",
                "secretsManagerProvider": "db",
            },
            "version": 0.1,
            "updatedAt": 1703157653864,
            "updatedBy": "admin",
            "workflowType": "TEST_CONNECTION",
            "fullyQualifiedName": "test-connection-Airflow-WhCTUSXJ",
        }

        with self.assertRaises(ValidationError) as err:
            parse_automation_workflow_gracefully(config_dict_ko)
        self.assertIn(
            "1 validation error for AirflowConnection\nhostPort\n  invalid or missing URL scheme (type=value_error.url.scheme)",
            str(err.exception),
        )

        config_dict_ko_2 = {
            "id": "8b735b2c-194e-41a4-b383-96253f936293",
            "name": "test-connection-Airflow-WhCTUSXJ",
            "deleted": False,
            "request": {
                "connection": {
                    "config": {
                        "type": "Airflow",
                        "hostPort": "https://localhost:8080",
                        "connection": {
                            "type": "Mysql",
                            "scheme": "mysql+pymysql",
                            "authType": {"password": "fernet:demo_password"},
                            "hostPort": "mysql:3306",
                            "usernam": "admin@openmetadata.org",
                            "databaseName": "airflow_db",
                            "supportsProfile": True,
                            "supportsQueryComment": True,
                            "supportsDBTExtraction": True,
                            "supportsMetadataExtraction": True,
                        },
                        "numberOfStatus": 10,
                        "supportsMetadataExtraction": True,
                    }
                },
                "serviceName": "airflow_test_two",
                "serviceType": "Pipeline",
                "connectionType": "Airflow",
                "secretsManagerProvider": "db",
            },
            "version": 0.1,
            "updatedAt": 1703157653864,
            "updatedBy": "admin",
            "workflowType": "TEST_CONNECTION",
            "fullyQualifiedName": "test-connection-Airflow-WhCTUSXJ",
        }

        with self.assertRaises(ValidationError) as err:
            parse_automation_workflow_gracefully(config_dict_ko_2)
        self.assertIn(
            "3 validation errors for MysqlConnection\nusername\n  field required (type=value_error.missing)\nsupportsProfile\n  extra fields not permitted (type=value_error.extra)\nusernam\n  extra fields not permitted (type=value_error.extra)",
            str(err.exception),
        )

    def test_parsing_automation_workflow_athena(self):
        """
        Test parsing of automation workflow for airflow
        """
        config_dict = {
            "id": "850b194c-3d1b-4f6f-95df-83e3df5ccb24",
            "name": "test-connection-Athena-EHnc3Ral",
            "deleted": False,
            "request": {
                "connection": {
                    "config": {
                        "type": "Athena",
                        "scheme": "awsathena+rest",
                        "awsConfig": {
                            "awsRegion": "us-east-2",
                            "assumeRoleSessionName": "OpenMetadataSession",
                        },
                        "workgroup": "primary",
                        "s3StagingDir": "s3://athena-postgres/output/",
                        "supportsProfiler": True,
                        "supportsQueryComment": True,
                        "supportsDBTExtraction": True,
                        "supportsUsageExtraction": True,
                        "supportsLineageExtraction": True,
                        "supportsMetadataExtraction": True,
                    }
                },
                "serviceType": "Database",
                "connectionType": "Athena",
                "secretsManagerProvider": "db",
            },
            "version": 0.1,
            "updatedAt": 1703173676044,
            "updatedBy": "admin",
            "workflowType": "TEST_CONNECTION",
            "fullyQualifiedName": "test-connection-Athena-EHnc3Ral",
        }
        self.assertIsInstance(
            parse_automation_workflow_gracefully(config_dict),
            AutomationWorkflow,
        )

        config_dict_ko = {
            "id": "850b194c-3d1b-4f6f-95df-83e3df5ccb24",
            "name": "test-connection-Athena-EHnc3Ral",
            "deleted": False,
            "request": {
                "connection": {
                    "config": {
                        "type": "Athena",
                        "scheme": "awsathena+rest",
                        "awsConfig": {
                            "awsRegion": "us-east-2",
                            "assumeRoleSessionName": "OpenMetadataSession",
                        },
                        "workgroup": "primary",
                        "s3StagingDir": "athena-postgres/output/",
                        "supportsProfiler": True,
                        "supportsQueryComment": True,
                        "supportsDBTExtraction": True,
                        "supportsUsageExtraction": True,
                        "supportsLineageExtraction": True,
                        "supportsMetadataExtraction": True,
                    }
                },
                "serviceType": "Database",
                "connectionType": "Athena",
                "secretsManagerProvider": "db",
            },
            "version": 0.1,
            "updatedAt": 1703173676044,
            "updatedBy": "admin",
            "workflowType": "TEST_CONNECTION",
            "fullyQualifiedName": "test-connection-Athena-EHnc3Ral",
        }

        with self.assertRaises(ValidationError) as err:
            parse_automation_workflow_gracefully(config_dict_ko)
        self.assertIn(
            "1 validation error for AthenaConnection\ns3StagingDir\n  invalid or missing URL scheme (type=value_error.url.scheme)",
            str(err.exception),
        )

    def test_parsing_dbt_workflow_ok(self):
        """
        Test dbt workflow Config parsing OK
        """

        config_dict = {
            "source": {
                "type": "dbt",
                "serviceName": "dbt_prod",
                "sourceConfig": {
                    "config": {
                        "type": "DBT",
                        "dbtConfigSource": {
                            "dbtConfigType": "local",
                            "dbtCatalogFilePath": "/path/to/catalog.json",
                            "dbtManifestFilePath": "/path/to/manifest.json",
                            "dbtRunResultsFilePath": "/path/to/run_results.json",
                        },
                        "dbtUpdateDescriptions": True,
                        "includeTags": True,
                        "dbtClassificationName": "dbtTags",
                        "databaseFilterPattern": {"includes": ["test"]},
                        "schemaFilterPattern": {
                            "includes": ["test1"],
                            "excludes": [".*schema.*"],
                        },
                        "tableFilterPattern": {
                            "includes": ["test3"],
                            "excludes": [".*table_name.*"],
                        },
                    }
                },
            },
            "sink": {"type": "metadata-rest", "config": {}},
            "workflowConfig": {
                "loggerLevel": "DEBUG",
                "openMetadataServerConfig": {
                    "hostPort": "http://localhost:8585/api",
                    "authProvider": "openmetadata",
                    "securityConfig": {"jwtToken": "jwt_token"},
                },
            },
        }

        self.assertIsNotNone(parse_workflow_config_gracefully(config_dict))

    def test_parsing_dbt_workflow_ko(self):
        """
        Test dbt workflow Config parsing OK
        """

        config_dict_type_error_ko = {
            "source": {
                "type": "dbt",
                "serviceName": "dbt_prod",
                "sourceConfig": {
                    "config": {
                        "type": "DBT",
                        "dbtConfigSource": {
                            "dbtConfigType": "cloud",
                            "dbtCloudAuthToken": "token",
                            "dbtCloudAccountId": "ID",
                            "dbtCloudJobId": "JOB ID",
                        },
                        "dbtUpdateDescriptions": True,
                        "includeTags": True,
                        "dbtClassificationName": "dbtTags",
                        "databaseFilterPattern": {"includes": ["test"]},
                        "schemaFilterPattern": {
                            "includes": ["test1"],
                            "excludes": [".*schema.*"],
                        },
                        "tableFilterPattern": {
                            "includes": ["test3"],
                            "excludes": [".*table_name.*"],
                        },
                    }
                },
            },
            "sink": {"type": "metadata-rest", "config": {}},
            "workflowConfig": {
                "loggerLevel": "DEBUG",
                "openMetadataServerConfig": {
                    "hostPort": "http://localhost:8585/api",
                    "authProvider": "openmetadata",
                    "securityConfig": {"jwtToken": "jwt_token"},
                },
            },
        }
        with self.assertRaises(ParsingConfigurationError) as err:
            parse_workflow_config_gracefully(config_dict_type_error_ko)
        self.assertIn(
            "We encountered an error parsing the configuration of your DbtCloudConfig.\nYou might need to review your config based on the original cause of this failure:\n\t - Missing parameter 'dbtCloudUrl'",
            str(err.exception),
        )

    def test_parsing_dbt_pipeline_ko(self):
        """
        Test dbt workflow Config parsing OK
        """

        config_dict_dbt_pipeline_ko = {
            "source": {
                "type": "dbt",
                "serviceName": "dbt_prod",
                "sourceConfig": {
                    "config": {
                        "type": "DBT",
                        "dbtConfigSource": {
                            "dbtConfigType": "cloud",
                            "dbtCloudAuthToken": "token",
                            "dbtCloudAccountId": "ID",
                            "dbtCloudJobId": "JOB ID",
                            "dbtCloudUrl": "https://clouddbt.com",
                        },
                        "dbtUpdateDescription": True,
                        "includeTags": True,
                        "dbtClassificationName": "dbtTags",
                        "databaseFilterPattern": {"includes": ["test"]},
                        "schemaFilterPattern": {
                            "includes": ["test1"],
                            "excludes": [".*schema.*"],
                        },
                        "tableFilterPattern": {
                            "includes": ["test3"],
                            "excludes": [".*table_name.*"],
                        },
                    }
                },
            },
            "sink": {"type": "metadata-rest", "config": {}},
            "workflowConfig": {
                "loggerLevel": "DEBUG",
                "openMetadataServerConfig": {
                    "hostPort": "http://localhost:8585/api",
                    "authProvider": "openmetadata",
                    "securityConfig": {"jwtToken": "jwt_token"},
                },
            },
        }
        with self.assertRaises(ParsingConfigurationError) as err:
            parse_workflow_config_gracefully(config_dict_dbt_pipeline_ko)
        self.assertIn(
            "We encountered an error parsing the configuration of your DbtPipeline.\nYou might need to review your config based on the original cause of this failure:\n\t - Extra parameter 'dbtUpdateDescription'",
            str(err.exception),
        )
