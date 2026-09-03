import os
import shutil
import tempfile
import uuid

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

from ..conftest import ingestion_config as base_ingestion_config  # noqa: F401, TID252

# The second database and its descriptions are asserted from the tests, so the
# expected values live here rather than being repeated in each of them.
SECOND_DATABASE = "TestDB"
SECOND_SCHEMA = "catalog_test"
SECOND_DATABASE_DESCRIPTION = "Catalogue test database"
SECOND_SCHEMA_DESCRIPTION = "Catalogue test schema"
SECOND_TABLE_DESCRIPTION = "Orders placed by customers"
SECOND_PROCEDURE_DESCRIPTION = "Fetch the order identifiers"
# Shipped inside AdventureWorksLT2022.bak as MS_Description properties.
FIRST_DATABASE_DESCRIPTION = "AdventureWorksLT 2012 Sample OLTP Database"
FIRST_SCHEMA_DESCRIPTION = "Contains objects related to products, customers, sales orders, and sales territories."


@pytest.fixture(scope="package")
def db_name():
    return "AdventureWorksLT2022"


class CustomSqlServerContainer(SqlServerContainer):
    def start(self) -> "DbContainer":  # noqa: F821
        dockerfile = f"""
            FROM {self.image}
            USER root
            RUN mkdir -p /data
            RUN chown mssql /data
            USER mssql
            """
        temp_dir = os.path.join(tempfile.gettempdir(), "mssql")  # noqa: PTH118
        os.makedirs(temp_dir, exist_ok=True)  # noqa: PTH103
        temp_dockerfile_path = os.path.join(temp_dir, "Dockerfile")  # noqa: PTH118
        with open(temp_dockerfile_path, "w") as temp_dockerfile:  # noqa: PTH123
            temp_dockerfile.write(dockerfile)
        self.get_docker_client().build(temp_dir, tag=self.image)
        return super().start()

    def _configure(self) -> None:
        super()._configure()
        self.with_env("SQL_SA_PASSWORD", self.password)


@pytest.fixture(scope="package")
def mssql_container(tmp_path_factory, db_name):
    container = CustomSqlServerContainer("mcr.microsoft.com/mssql/server:2022-latest", dbname="master")
    data_dir = tmp_path_factory.mktemp("data")
    shutil.copy(
        os.path.join(os.path.dirname(__file__), "data", f"{db_name}.bak"),  # noqa: PTH118, PTH120
        str(data_dir),
    )
    with open(data_dir / "install.sql", "w") as f:  # noqa: PTH123
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

/* A second database, so anything read per database is exercised against more
   than one of them: the description queries are scoped to the connected
   database, and a run that reads them against the wrong one looks identical to
   a database that simply has no descriptions. */
CREATE DATABASE [{SECOND_DATABASE}];
GO
USE [{SECOND_DATABASE}];
GO
CREATE SCHEMA {SECOND_SCHEMA};
GO
CREATE TABLE {SECOND_SCHEMA}.orders (
    id INT NOT NULL PRIMARY KEY,
    code NVARCHAR(20) NOT NULL,
    region NVARCHAR(20) NOT NULL,
    ref NVARCHAR(20) NOT NULL,
    CONSTRAINT uq_orders_code UNIQUE (code),
    CONSTRAINT uq_orders_region_ref UNIQUE (region, ref)
);
GO
CREATE VIEW {SECOND_SCHEMA}.orders_plain AS SELECT id, code FROM {SECOND_SCHEMA}.orders;
GO
/* An indexed view is materialized, and SQL Server only accepts one when the
   session carries these options. */
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO
CREATE VIEW {SECOND_SCHEMA}.orders_indexed WITH SCHEMABINDING AS
    SELECT id, code FROM {SECOND_SCHEMA}.orders;
GO
CREATE UNIQUE CLUSTERED INDEX ix_orders_indexed ON {SECOND_SCHEMA}.orders_indexed (id);
GO
CREATE PROCEDURE {SECOND_SCHEMA}.get_orders AS SELECT id FROM {SECOND_SCHEMA}.orders;
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'{SECOND_DATABASE_DESCRIPTION}';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'{SECOND_SCHEMA_DESCRIPTION}',
    @level0type = N'SCHEMA', @level0name = N'{SECOND_SCHEMA}';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'{SECOND_TABLE_DESCRIPTION}',
    @level0type = N'SCHEMA', @level0name = N'{SECOND_SCHEMA}',
    @level1type = N'TABLE', @level1name = N'orders';
GO
EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'{SECOND_PROCEDURE_DESCRIPTION}',
    @level0type = N'SCHEMA', @level0name = N'{SECOND_SCHEMA}',
    @level1type = N'PROCEDURE', @level1name = N'get_orders';
GO
USE [{db_name}];
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
            raise Exception("Failed to create mssql database:" + res[1].decode("utf-8"))  # noqa: TRY002
        engine = create_engine(
            "mssql+pytds://" + container.get_connection_url().split("://")[1],
            connect_args={"autocommit": True},
        )
        with engine.connect() as conn:
            transaciton = conn.begin()
            conn.execute(text(f"SELECT * INTO {db_name}.SalesLT.CustomerCopy FROM {db_name}.SalesLT.Customer;"))
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
def create_service_request(mssql_container, scheme, db_name):
    return CreateDatabaseServiceRequest(
        name=f"docker_test_mssql_{uuid.uuid4().hex[:8]}_{scheme.name}",
        serviceType=DatabaseServiceType.Mssql,
        connection=DatabaseConnection(
            config=MssqlConnection(
                username=mssql_container.username,
                password=mssql_container.password,
                hostPort="localhost:" + mssql_container.get_exposed_port(mssql_container.port),
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
    base_ingestion_config,  # noqa: F811
    db_name,
):
    base_ingestion_config["source"]["sourceConfig"]["config"]["databaseFilterPattern"] = {
        "includes": ["TestDB", db_name],
    }
    return base_ingestion_config


@pytest.fixture(scope="module")
def unmask_password(create_service_request):
    def inner(service: DatabaseService):
        service.connection.config.password = create_service_request.connection.config.password
        return service

    return inner
