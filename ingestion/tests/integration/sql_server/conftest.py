import logging
import os
import shutil

import pytest
from helpers.docker import try_bind
from helpers.markers import xfail_param
from sqlalchemy import create_engine, text
from testcontainers.mssql import SqlServerContainer

from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlScheme,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture(scope="session", autouse=True)
def config_logging():
    logging.getLogger("sqlfluff").setLevel(logging.CRITICAL)


@pytest.fixture(scope="session")
def mssql_container(tmp_path_factory):
    container = SqlServerContainer(
        "mcr.microsoft.com/mssql/server:2017-latest", dbname="AdventureWorks"
    )
    data_dir = tmp_path_factory.mktemp("data")
    shutil.copy(
        os.path.join(os.path.dirname(__file__), "data", "AdventureWorks2017.bak"),
        str(data_dir),
    )
    with open(data_dir / "install.sql", "w") as f:
        f.write(
            """
USE [master]
RESTORE DATABASE [AdventureWorks]
    FROM DISK = '/data/AdventureWorks2017.bak'
        WITH MOVE 'AdventureWorks2017' TO '/var/opt/mssql/data/AdventureWorks.mdf',
        MOVE 'AdventureWorks2017_log' TO '/var/opt/mssql/data/AdventureWorks_log.ldf'
GO
        """
        )

    container.volumes = {str(data_dir): {"bind": "/data"}}
    with try_bind(container, 1433, 1433) as container:
        docker_container = container.get_wrapped_container()
        res = docker_container.exec_run(
            [
                "/opt/mssql-tools/bin/sqlcmd",
                "-S",
                "localhost",
                "-U",
                container.username,
                "-P",
                container.password,
                "-d",
                "master",
                "-i",
                "/data/install.sql",
            ]
        )
        if res[0] != 0:
            raise Exception("Failed to create mssql database:" + res[1].decode("utf-8"))
        engine = create_engine(
            "mssql+pytds://" + container.get_connection_url().split("://")[1],
            connect_args={"autocommit": True},
        )
        with engine.connect() as conn:
            transaciton = conn.begin()
            conn.execute(
                text(
                    "SELECT * INTO AdventureWorks.HumanResources.DepartmenCopy FROM AdventureWorks.HumanResources.Department;"
                )
            )
            transaciton.commit()
        yield container


@pytest.fixture(
    scope="module",
    params=[
        "english",
        xfail_param(
            "german",
            "failes due to date format handling (https://github.com/open-metadata/OpenMetadata/issues/16434)",
        ),
    ],
)
def mssql_server_config(mssql_container, request):
    language = request.param
    engine = create_engine(
        "mssql+pytds://" + mssql_container.get_connection_url().split("://")[1],
        connect_args={"autocommit": True},
    )
    engine.execute(
        f"ALTER LOGIN {mssql_container.username} WITH DEFAULT_LANGUAGE={language};"
    )


@pytest.fixture(
    scope="module",
    params=[
        MssqlScheme.mssql_pytds,
        xfail_param(
            MssqlScheme.mssql_pyodbc,
            "sql server fails with pyodbc (https://github.com/open-metadata/OpenMetadata/issues/16435)",
        ),
    ],
)
def ingest_metadata(
    mssql_container, mssql_server_config, metadata: OpenMetadata, request
):
    workflow_config = {
        "source": {
            "type": "mssql",
            "serviceName": "integration_test_mssql_" + request.param.name,
            "serviceConnection": {
                "config": {
                    "type": "Mssql",
                    "scheme": request.param,
                    "username": mssql_container.username,
                    "password": mssql_container.password,
                    "hostPort": "localhost:"
                    + mssql_container.get_exposed_port(mssql_container.port),
                    "database": "AdventureWorks",
                    "ingestAllDatabases": True,
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "DatabaseMetadata",
                    "databaseFilterPattern": {"includes": ["TestDB", "AdventureWorks"]},
                },
            },
        },
        "sink": {"type": "metadata-rest", "config": {}},
        "workflowConfig": {
            "loggerLevel": "INFO",
            "openMetadataServerConfig": metadata.config.dict(),
        },
    }
    metadata_ingestion = MetadataWorkflow.create(workflow_config)
    metadata_ingestion.execute()
    metadata_ingestion.raise_from_status()
    metadata_ingestion.stop()
    db_service = metadata.get_by_name(
        DatabaseService, workflow_config["source"]["serviceName"]
    )
    yield db_service
    metadata.delete(DatabaseService, db_service.id, recursive=True, hard_delete=True)


@pytest.fixture(scope="module")
def run_lineage_workflow(
    ingest_metadata: DatabaseService, mssql_container, metadata: OpenMetadata
):
    workflow_config = {
        "source": {
            "type": "mssql-lineage",
            "serviceName": ingest_metadata.fullyQualifiedName.__root__,
            "serviceConnection": {
                "config": {
                    "type": "Mssql",
                    "scheme": ingest_metadata.connection.config.scheme,
                    "username": mssql_container.username,
                    "password": mssql_container.password,
                    "hostPort": "localhost:"
                    + mssql_container.get_exposed_port(mssql_container.port),
                    "database": "AdventureWorks",
                    "ingestAllDatabases": True,
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "DatabaseLineage",
                    "databaseFilterPattern": {"includes": ["TestDB", "AdventureWorks"]},
                },
            },
        },
        "sink": {"type": "metadata-rest", "config": {}},
        "workflowConfig": {
            "loggerLevel": "INFO",
            "openMetadataServerConfig": metadata.config.dict(),
        },
    }
    metadata_ingestion = MetadataWorkflow.create(workflow_config)
    metadata_ingestion.execute()
    metadata_ingestion.raise_from_status()
    metadata_ingestion.stop()
