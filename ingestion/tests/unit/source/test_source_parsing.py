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
Test that we can properly parse source configs
"""
from metadata.generated.schema.entity.services.connections.dashboard.lookerConnection import (
    LookerConnection,
)
from metadata.generated.schema.entity.services.connections.dashboard.metabaseConnection import (
    MetabaseConnection,
)
from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    PowerBIConnection,
)
from metadata.generated.schema.entity.services.connections.dashboard.redashConnection import (
    RedashConnection,
)
from metadata.generated.schema.entity.services.connections.dashboard.supersetConnection import (
    SupersetConnection,
)
from metadata.generated.schema.entity.services.connections.dashboard.tableauConnection import (
    TableauConnection,
)
from metadata.generated.schema.entity.services.connections.database.azureSQLConnection import (
    AzureSQLConnection,
)
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.entity.services.connections.database.clickhouseConnection import (
    ClickhouseConnection,
)
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.generated.schema.entity.services.connections.database.db2Connection import (
    Db2Connection,
)
from metadata.generated.schema.entity.services.connections.database.deltaLakeConnection import (
    DeltaLakeConnection,
)
from metadata.generated.schema.entity.services.connections.database.dynamoDBConnection import (
    DynamoDBConnection,
)
from metadata.generated.schema.entity.services.connections.database.glueConnection import (
    GlueConnection,
)
from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
    HiveConnection,
)
from metadata.generated.schema.entity.services.connections.database.mariaDBConnection import (
    MariaDBConnection,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.oracleConnection import (
    OracleConnection,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.connections.database.prestoConnection import (
    PrestoConnection,
)
from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftConnection,
)
from metadata.generated.schema.entity.services.connections.database.salesforceConnection import (
    SalesforceConnection,
)
from metadata.generated.schema.entity.services.connections.database.sampleDataConnection import (
    SampleDataConnection,
)
from metadata.generated.schema.entity.services.connections.database.singleStoreConnection import (
    SingleStoreConnection,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.entity.services.connections.database.sqliteConnection import (
    SQLiteConnection,
)
from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection,
)
from metadata.generated.schema.entity.services.connections.database.verticaConnection import (
    VerticaConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.amundsenConnection import (
    AmundsenConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)


def test_amundsen():
    source = {
        "type": "amundsen",
        "serviceName": "local_amundsen",
        "serviceConnection": {
            "config": {
                "type": "Amundsen",
                "username": "neo4j",
                "password": "test",
                "hostPort": "bolt://192.168.1.8:7687",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, AmundsenConnection)


def test_atlas():
    """TODO"""


def test_athena():
    """TODO"""


def test_azure_sql():
    source = {
        "type": "azuresql",
        "serviceName": "azuresql",
        "serviceConnection": {
            "config": {
                "type": "AzureSQL",
                "hostPort": "hostPort",
                "database": "database_name",
                "username": "username",
                "password": " password",
                "driver": "ODBC Driver 17 for SQL Server",
            }
        },
        "sourceConfig": {
            "config": {
                "schemaFilterPattern": {
                    "excludes": [
                        "mysql.*",
                        "information_schema.*",
                        "performance_schema.*",
                        "sys.*",
                    ]
                }
            }
        },
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, AzureSQLConnection)


def test_bigquery():
    source = {
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

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, BigQueryConnection)


def test_clickhouse():
    source = {
        "type": "clickhouse",
        "serviceName": "local_clickhouse",
        "serviceConnection": {
            "config": {
                "type": "Clickhouse",
                "username": "default",
                "password": "",
                "hostPort": "localhost:8123",
                "databaseSchema": "default",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
                "schemaFilterPattern": {
                    "excludes": [
                        "system.*",
                        "information_schema.*",
                        "INFORMATION_SCHEMA.*",
                    ]
                },
            }
        },
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, ClickhouseConnection)


def test_databricks():
    source = {
        "type": "databricks",
        "serviceName": "local_databricks",
        "serviceConnection": {
            "config": {
                "token": "<databricks token>",
                "hostPort": "localhost:443",
                "connectionArguments": {
                    "http_path": "<http path of databricks cluster>"
                },
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, DatabricksConnection)


def test_db2():
    source = {
        "type": "db2",
        "serviceName": "local_db2",
        "serviceConnection": {
            "config": {
                "type": "Db2",
                "username": "openmetadata_user",
                "password": "openmetadata_password",
                "hostPort": "localhost:50000",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, Db2Connection)


def test_deltalake():
    source = {
        "type": "deltalake",
        "serviceName": "local_deltalake",
        "serviceConnection": {
            "config": {
                "metastoreHostPort": "localhost:9083",
                "metastoreFilePath": "<path_to_metastore>/metastore_db",
                "appName": "MyApp",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, DeltaLakeConnection)


def test_druid():
    """TODO"""


def test_dynamo_db():
    source = {
        "type": "dynamodb",
        "serviceName": "local_dynamodb",
        "serviceConnection": {
            "config": {
                "type": "DynamoDB",
                "awsConfig": {
                    "awsAccessKeyId": "aws_access_key_id",
                    "awsSecretAccessKey": "aws_secret_access_key",
                    "awsRegion": "us-east-2",
                    "endPointURL": "https://dynamodb.us-east-2.amazonaws.com",
                },
                "database": "custom_database_name",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
                "tableFilterPattern": {"includes": [""]},
            }
        },
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, DynamoDBConnection)


def test_gcs():
    """TODO"""


def test_glue():
    source = {
        "type": "glue",
        "serviceName": "local_glue",
        "serviceConnection": {
            "config": {
                "type": "Glue",
                "awsConfig": {
                    "awsAccessKeyId": "aws accessKey id",
                    "awsSecretAccessKey": "aws secret access key",
                    "awsRegion": "aws region",
                    "endPointURL": "https://glue.<region_name>.amazonaws.com/",
                },
                "storageServiceName": "storage_name",
                "pipelineServiceName": "pipeline_name",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, GlueConnection)


def test_hive():
    source = {
        "type": "hive",
        "serviceName": "local_hive",
        "serviceConnection": {
            "config": {"type": "Hive", "hostPort": "localhost:10000"}
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, HiveConnection)


def test_kafka():
    """TODO"""


def test_ldap():
    """TODO"""


def test_looker():
    source = {
        "type": "looker",
        "serviceName": "local_looker",
        "serviceConnection": {
            "config": {
                "type": "Looker",
                "clientId": "username",
                "clientSecret": "password",
                "hostPort": "http://hostPort",
            }
        },
        "sourceConfig": {"config": {}},
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, LookerConnection)


def test_mariadb():
    source = {
        "type": "mariadb",
        "serviceName": "local_mariadb",
        "serviceConnection": {
            "config": {
                "type": "MariaDB",
                "username": "openmetadata_user",
                "password": "openmetadata_password",
                "hostPort": "localhost:3306",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, MariaDBConnection)


def test_mariadb():
    source = {
        "type": "mariadb",
        "serviceName": "local_mariadb",
        "serviceConnection": {
            "config": {
                "type": "MariaDB",
                "username": "openmetadata_user",
                "password": "openmetadata_password",
                "hostPort": "localhost:3306",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, MariaDBConnection)


def test_metabase():
    source = {
        "type": "metabase",
        "serviceName": "test",
        "serviceConnection": {
            "config": {
                "type": "Metabase",
                "username": "username",
                "password": "password",
                "hostPort": "http://hostPort",
            }
        },
        "sourceConfig": {
            "config": {"dashboardFilterPattern": {}, "chartFilterPattern": {}}
        },
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, MetabaseConnection)


def test_metadata():
    """TODO"""


def test_mlflow():
    """TODO"""


def test_mssql():
    source = {
        "type": "mssql",
        "serviceName": "local_mssql",
        "serviceConnection": {
            "config": {
                "type": "Mssql",
                "database": "catalog_test",
                "username": "sa",
                "password": "test!Password",
                "hostPort": "localhost:1433",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, MssqlConnection)


def test_mysql():
    source = {
        "type": "mysql",
        "serviceName": "local_mysql",
        "serviceConnection": {
            "config": {
                "type": "Mysql",
                "username": "openmetadata_user",
                "password": "openmetadata_password",
                "hostPort": "localhost:3306",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, MysqlConnection)


def test_oracle():
    source = {
        "type": "oracle",
        "serviceName": "local_oracle",
        "serviceConnection": {
            "config": {
                "hostPort": "hostPort",
                "username": "username",
                "password": "password",
                "type": "Oracle",
                "oracleServiceName": "TESTDB",
            }
        },
        "sourceConfig": {"config": {}},
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, OracleConnection)


def test_postgres():
    source = {
        "type": "postgres",
        "serviceName": "local_postgres",
        "serviceConnection": {
            "config": {
                "type": "Postgres",
                "username": "openmetadata_user",
                "password": "openmetadata_password",
                "hostPort": "localhost:5432",
                "database": "pagila",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, PostgresConnection)


def test_powerbi():
    source = {
        "type": "powerbi",
        "serviceName": "local_powerbi",
        "serviceConnection": {
            "config": {
                "clientId": "client_id",
                "clientSecret": "client_secret",
                "tenantId": "tenant_id",
                "scope": ["https://analysis.windows.net/powerbi/api/.default"],
                "type": "PowerBI",
            }
        },
        "sourceConfig": {
            "config": {
                "dashboardFilterPattern": {
                    "includes": ["Supplier Quality Analysis Sample"]
                }
            }
        },
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, PowerBIConnection)


def test_presto():
    source = {
        "type": "presto",
        "serviceName": "local_presto",
        "serviceConnection": {
            "config": {
                "type": "Presto",
                "hostPort": "localhost:8080",
                "catalog": "tpcds",
                "username": "admin",
                "password": "password",
            }
        },
        "sourceConfig": {"config": {"generateSampleData": False}},
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, PrestoConnection)


def test_redash():
    source = {
        "type": "redash",
        "serviceName": "local_redash",
        "serviceConnection": {
            "config": {
                "type": "Redash",
                "hostPort": "http://localhost:5000",
                "username": "random",
                "apiKey": "api_key",
            }
        },
        "sourceConfig": {
            "config": {"dashboardFilterPattern": {}, "chartFilterPattern": {}}
        },
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, RedashConnection)


def test_redshift():
    source = {
        "type": "redshift",
        "serviceName": "aws_redshift",
        "serviceConnection": {
            "config": {
                "hostPort": "cluster.name.region.redshift.amazonaws.com:5439",
                "username": "username",
                "password": "strong_password",
                "database": "dev",
                "type": "Redshift",
            }
        },
        "sourceConfig": {
            "config": {
                "schemaFilterPattern": {
                    "excludes": ["information_schema.*", "[\\w]*event_vw.*"]
                }
            }
        },
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, RedshiftConnection)


def test_s3():
    """TODO"""


def test_salesforce():
    source = {
        "type": "salesforce",
        "serviceName": "local_salesforce",
        "serviceConnection": {
            "config": {
                "type": "Salesforce",
                "hostPort": "localhost",
                "username": "username",
                "password": "password",
                "securityToken": "securityToken",
                "scheme": "salesforce",
                "sobjectName": "sobjectName",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, SalesforceConnection)


def test_sample_data():
    source = {
        "type": "sample-data",
        "serviceName": "sample_data",
        "serviceConnection": {
            "config": {
                "type": "SampleData",
                "sampleDataFolder": "./examples/sample_data",
            }
        },
        "sourceConfig": {},
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, SampleDataConnection)


def test_singlestore():
    source = {
        "type": "singlestore",
        "serviceName": "local_singlestore",
        "serviceConnection": {
            "config": {
                "type": "SingleStore",
                "username": "openmetadata_user",
                "password": "openmetadata_password",
                "hostPort": "localhost:3306",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, SingleStoreConnection)


def test_snowflake():
    source = {
        "type": "snowflake",
        "serviceName": "snowflake",
        "serviceConnection": {
            "config": {
                "type": "Snowflake",
                "username": "username",
                "password": "password",
                "database": "database_name",
                "warehouse": "warehouse_name",
                "account": "account.region_name.cloud_service",
                "connectionArguments": {"private_key": "private_key"},
            }
        },
        "sourceConfig": {
            "config": {
                "schemaFilterPattern": {
                    "excludes": [
                        "mysql.*",
                        "information_schema.*",
                        "performance_schema.*",
                        "sys.*",
                    ]
                }
            }
        },
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, SnowflakeConnection)


def test_sqlite():
    source = {
        "type": "sqlite",
        "serviceName": "my_service",
        "serviceConnection": {"config": {"type": "SQLite"}},
        "sourceConfig": {"config": {}},
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, SQLiteConnection)


def test_superset():
    source = {
        "type": "superset",
        "serviceName": "local_superset",
        "serviceConnection": {
            "config": {
                "hostPort": "http://localhost:8080",
                "username": "admin",
                "password": "admin",
                "type": "Superset",
            }
        },
        "sourceConfig": {
            "config": {"chartFilterPattern": {}, "dashboardFilterPattern": {}}
        },
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, SupersetConnection)


def test_tableau():
    source = {
        "type": "tableau",
        "serviceName": "local_tableau",
        "serviceConnection": {
            "config": {
                "type": "Tableau",
                "username": "username",
                "password": "password",
                "env": "tableau_prod",
                "hostPort": "http://localhost",
                "siteName": "site_name",
                "apiVersion": "api_version",
                "personalAccessTokenName": "personal_access_token_name",
                "personalAccessTokenSecret": "personal_access_token_secret",
            }
        },
        "sourceConfig": {
            "config": {"dashboardFilterPattern": {}, "chartFilterPattern": {}}
        },
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, TableauConnection)


def test_trino():
    source = {
        "type": "trino",
        "serviceName": "local_trino",
        "serviceConnection": {
            "config": {
                "type": "Trino",
                "hostPort": "localhost:8080",
                "username": "user",
                "catalog": "tpcds",
            }
        },
        "sourceConfig": {"config": {}},
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, TrinoConnection)


def test_vertica():
    source = {
        "type": "vertica",
        "serviceName": "local_vertica",
        "serviceConnection": {
            "config": {
                "type": "Vertica",
                "username": "openmetadata_user",
                "password": "",
                "hostPort": "localhost:5433",
                "database": "custom_database_name",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    }

    config: WorkflowSource = WorkflowSource.parse_obj(source)
    assert isinstance(config.serviceConnection.__root__.config, VerticaConnection)
