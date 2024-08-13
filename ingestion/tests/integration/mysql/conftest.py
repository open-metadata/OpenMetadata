import os
from subprocess import CalledProcessError

import pytest

from _openmetadata_testutils.helpers.docker import try_bind
from _openmetadata_testutils.postgres.conftest import postgres_container
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from testcontainers.mysql import MySqlContainer


@pytest.fixture(scope="module")
def mysql_container(tmp_path_factory):
    """Start a PostgreSQL container with the dvdrental database."""
    test_db_tar_path = os.path.join(
        os.path.dirname(__file__), "data", "mysql", "test_db-1.0.7.tar.gz"
    )
    container = MySqlContainer(dbname="employees")
    with (
        try_bind(container, 3306, 3307) if not os.getenv("CI") else container
    ) as container:
        docker_container = container.get_wrapped_container()
        docker_container.exec_run(["mkdir", "-p", "/data"])
        docker_container.put_archive("/data", open(test_db_tar_path, "rb"))
        for command in (
            [
                "sh",
                "-c",
                f"cd /data/test_db && mysql -uroot -p{container.password}  < employees.sql",
            ],
            [
                "sh",
                "-c",
                f'mysql -uroot -p{container.password} -e \'GRANT SELECT ON employees.* TO "test"@"%";\'',
            ],
        ):
            res = docker_container.exec_run(command)
            if res[0] != 0:
                raise CalledProcessError(
                    returncode=res[0], cmd=res, output=res[1].decode("utf-8")
                )
        yield container


@pytest.fixture(scope="module")
def create_service_request(mysql_container, tmp_path_factory):
    return CreateDatabaseServiceRequest.model_validate(
        {
            "name": "docker_test_" + tmp_path_factory.mktemp("mysql").name,
            "serviceType": DatabaseServiceType.Mysql.value,
            "connection": {
                "config": {
                    "username": mysql_container.username,
                    "authType": {"password": mysql_container.password},
                    "hostPort": "localhost:"
                    + mysql_container.get_exposed_port(mysql_container.port),
                    "databaseSchema": mysql_container.dbname,
                }
            },
        }
    )


@pytest.fixture(scope="module")
def ingestion_config(
    db_service, metadata, workflow_config, sink_config, postgres_container
):
    return {
        "source": {
            "type": db_service.connection.config.type.value.lower(),
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
            "serviceConnection": db_service.connection.dict(),
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }
