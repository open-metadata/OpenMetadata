import contextlib
import logging
import os
import tarfile
import zipfile
from subprocess import CalledProcessError

import docker
import pytest
from testcontainers.postgres import PostgresContainer

from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    Sink,
    Source,
    SourceConfig,
    WorkflowConfig,
)
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture(autouse=True, scope="session")
def config_logging():
    logging.getLogger("sqlfluff").setLevel(logging.CRITICAL)


@contextlib.contextmanager
def try_bind(container, container_port, host_port):
    try:
        with container.with_bind_ports(container_port, host_port) as container:
            yield container
    except docker.errors.APIError:
        logging.warning("Port %s is already in use, trying another port", host_port)
        with container.with_bind_ports(container_port, None) as container:
            yield container


@pytest.fixture(scope="session")
def postgres_container(tmp_path_factory):
    data_dir = tmp_path_factory.mktemp("data")
    dvd_rental_zip = os.path.join(os.path.dirname(__file__), "data", "dvdrental.zip")
    zipfile.ZipFile(dvd_rental_zip, "r").extractall(str(data_dir))
    with tarfile.open(data_dir / "dvdrental_data.tar", "w") as tar:
        tar.add(data_dir / "dvdrental.tar", arcname="dvdrental.tar")

    container = PostgresContainer("postgres:15", dbname="dvdrental")
    container._command = [
        "-c",
        "shared_preload_libraries=pg_stat_statements",
        "-c",
        "pg_stat_statements.max=10000",
        "-c",
        "pg_stat_statements.track=all",
    ]

    with try_bind(container, 5432, 5432) if not os.getenv(
        "CI"
    ) else container as container:
        docker_container = container.get_wrapped_container()
        docker_container.exec_run(["mkdir", "/data"])
        docker_container.put_archive(
            "/data/", open(data_dir / "dvdrental_data.tar", "rb")
        )
        for query in (
            "CREATE USER postgres SUPERUSER;",
            "CREATE EXTENSION pg_stat_statements;",
        ):
            res = docker_container.exec_run(
                ["psql", "-U", container.username, "-d", container.dbname, "-c", query]
            )
            if res[0] != 0:
                raise CalledProcessError(
                    returncode=res[0], cmd=res, output=res[1].decode("utf-8")
                )
        res = docker_container.exec_run(
            [
                "pg_restore",
                "-U",
                container.username,
                "-d",
                container.dbname,
                "/data/dvdrental.tar",
            ]
        )
        if res[0] != 0:
            raise CalledProcessError(
                returncode=res[0], cmd=res, output=res[1].decode("utf-8")
            )
        yield container


@pytest.fixture(scope="module")
def db_service(metadata, postgres_container):
    service = CreateDatabaseServiceRequest(
        name="docker_test_db",
        serviceType=DatabaseServiceType.Postgres,
        connection=DatabaseConnection(
            config=PostgresConnection(
                username=postgres_container.username,
                authType=BasicAuth(password=postgres_container.password),
                hostPort="localhost:"
                + postgres_container.get_exposed_port(postgres_container.port),
                database="dvdrental",
            )
        ),
    )
    service_entity = metadata.create_or_update(data=service)
    service_entity.connection.config.authType.password = postgres_container.password
    yield service_entity
    metadata.delete(
        DatabaseService, service_entity.id, recursive=True, hard_delete=True
    )


@pytest.fixture(scope="module")
def ingest_metadata(db_service, metadata: OpenMetadata):
    workflow_config = OpenMetadataWorkflowConfig(
        source=Source(
            type=db_service.connection.config.type.value.lower(),
            serviceName=db_service.fullyQualifiedName.__root__,
            serviceConnection=db_service.connection,
            sourceConfig=SourceConfig(config={}),
        ),
        sink=Sink(
            type="metadata-rest",
            config={},
        ),
        workflowConfig=WorkflowConfig(openMetadataServerConfig=metadata.config),
    )
    metadata_ingestion = MetadataWorkflow.create(workflow_config)
    search_cache.clear()
    metadata_ingestion.execute()
    metadata_ingestion.raise_from_status()
