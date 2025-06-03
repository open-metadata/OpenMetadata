import os
import shutil
import tempfile

import pytest
from sqlalchemy import create_engine, text
from testcontainers.mssql import SqlServerContainer

from _openmetadata_testutils.helpers.docker import copy_dir_to_container, try_bind
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection,
    MssqlScheme,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)

from ..conftest import ingestion_config as base_ingestion_config


@pytest.fixture(scope="session")
def db_name():
    return "AdventureWorksLT2022"


class CustomSqlServerContainer(SqlServerContainer):
    def start(self) -> "DbContainer":
        dockerfile = f"""
            FROM {self.image}
            USER root
            RUN mkdir -p /data
            RUN chown mssql /data
            USER mssql
            """
        temp_dir = os.path.join(tempfile.gettempdir(), "mssql")
        os.makedirs(temp_dir, exist_ok=True)
        temp_dockerfile_path = os.path.join(temp_dir, "Dockerfile")
        with open(temp_dockerfile_path, "w") as temp_dockerfile:
            temp_dockerfile.write(dockerfile)
        self.get_docker_client().build(temp_dir, tag=self.image)
        return super().start()

    def _configure(self) -> None:
        super()._configure()
        self.with_env("SQL_SA_PASSWORD", self.password)


@pytest.fixture(scope="session")
def mssql_container(tmp_path_factory, db_name):
    container = CustomSqlServerContainer(
        "mcr.microsoft.com/mssql/server:2022-latest", dbname="master"
    )
    data_dir = tmp_path_factory.mktemp("data")
    shutil.copy(
        os.path.join(os.path.dirname(__file__), "data", f"{db_name}.bak"),
        str(data_dir),
    )
    with open(data_dir / "install.sql", "w") as f:
        f.write(
            f"""
USE [master]
RESTORE FILELISTONLY
    FROM DISK = '/data/{db_name}.bak';
GO

RESTORE DATABASE [{db_name}]
    FROM DISK = '/data/{db_name}.bak'
    WITH MOVE '{db_name}_Data' TO '/var/opt/mssql/data/{db_name}.mdf',
         MOVE '{db_name}_Log' TO '/var/opt/mssql/data/{db_name}.ldf';
GO
        """
        )

    with try_bind(container, 1433, 1433) as container:
        docker_container = container.get_wrapped_container()
        copy_dir_to_container(str(data_dir), docker_container, "/data")
        res = docker_container.exec_run(
            [
                "bash",
                "-c",
                " ".join(
                    [
                        "/opt/mssql-tools*/bin/sqlcmd",
                        "-U",
                        container.username,
                        "-P",
                        f"'{container.password}'",
                        "-d",
                        "master",
                        "-i",
                        "/data/install.sql",
                        "-C",
                    ]
                ),
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
                    f"SELECT * INTO {db_name}.SalesLT.CustomerCopy FROM {db_name}.SalesLT.Customer;"
                )
            )
            transaciton.commit()
        yield container


@pytest.fixture(
    scope="module",
    params=[
        MssqlScheme.mssql_pytds,
        MssqlScheme.mssql_pyodbc,
    ],
)
def scheme(request):
    return request.param


@pytest.fixture(scope="module")
def create_service_request(mssql_container, scheme, tmp_path_factory, db_name):
    return CreateDatabaseServiceRequest(
        name="docker_test_" + tmp_path_factory.mktemp("mssql").name + "_" + scheme.name,
        serviceType=DatabaseServiceType.Mssql,
        connection=DatabaseConnection(
            config=MssqlConnection(
                username=mssql_container.username,
                password=mssql_container.password,
                hostPort="localhost:"
                + mssql_container.get_exposed_port(mssql_container.port),
                database=db_name,
                scheme=scheme,
                ingestAllDatabases=True,
                connectionOptions={
                    "TrustServerCertificate": "yes",
                    "MARS_Connection": "yes",
                },
            )
        ),
    )


@pytest.fixture(scope="module")
def ingestion_config(
    db_service,
    tmp_path_factory,
    workflow_config,
    sink_config,
    base_ingestion_config,
    db_name,
):
    base_ingestion_config["source"]["sourceConfig"]["config"][
        "databaseFilterPattern"
    ] = {
        "includes": ["TestDB", db_name],
    }
    return base_ingestion_config


@pytest.fixture(scope="module")
def unmask_password(create_service_request):
    def inner(service: DatabaseService):
        service.connection.config.password = (
            create_service_request.connection.config.password
        )
        return service

    return inner
