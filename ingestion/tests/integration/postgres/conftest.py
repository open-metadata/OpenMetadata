import os
import tarfile
import zipfile
from subprocess import CalledProcessError

import pytest
from testcontainers.postgres import PostgresContainer


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

    with container as container:
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
