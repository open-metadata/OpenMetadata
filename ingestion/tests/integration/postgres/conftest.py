import os
import zipfile
from subprocess import CalledProcessError

import pytest
from testcontainers.postgres import PostgresContainer


@pytest.fixture(scope="session")
def postgres_container(tmp_path_factory):
    data_dir = tmp_path_factory.mktemp("data")
    dvd_rental_zip = os.path.join(os.path.dirname(__file__), "data", "dvdrental.zip")
    zipfile.ZipFile(dvd_rental_zip, "r").extractall(str(data_dir))

    container = PostgresContainer("postgres:15", dbname="dvdrental")
    container.volumes = {str(data_dir): {"bind": "/data"}}
    container._command = [
        "-c",
        "shared_preload_libraries=pg_stat_statements",
        "-c",
        "pg_stat_statements.max=10000",
        "-c",
        "pg_stat_statements.track=all",
    ]

    with container as container:
        docker_container = container.get_wrapped_container()
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
