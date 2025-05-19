import os
from subprocess import CalledProcessError

import pytest
from sqlalchemy import create_engine
from testcontainers.mysql import MySqlContainer

from _openmetadata_testutils.helpers.docker import try_bind
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)


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
        engine = create_engine(container.get_connection_url())
        engine.execute(
            "ALTER TABLE employees ADD COLUMN last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        )
        engine.execute(
            "UPDATE employees SET last_update = hire_date + INTERVAL FLOOR(1 + RAND() * 500000) SECOND"
        )
        engine.dispose()
        assert_dangling_connections(container, 1)
        yield container
        # Needs to be handled for Test Cases https://github.com/open-metadata/OpenMetadata/issues/21187
        assert_dangling_connections(container, 9)


def assert_dangling_connections(container, max_connections):
    engine = create_engine(container.get_connection_url())
    with engine.connect() as conn:
        result = conn.execute("SHOW PROCESSLIST")
    processes = result.fetchall()
    # Count all connections except system processes (Daemon, Binlog Dump)
    # Note: We include Sleep connections as they are still open connections
    active_connections = len(
        [p for p in processes if p[1] not in ["Daemon", "Binlog Dump"]]
    )

    assert (
        active_connections <= max_connections
    ), f"Found {active_connections} open connections to MySQL"


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
