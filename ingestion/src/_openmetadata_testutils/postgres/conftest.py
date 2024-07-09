"""Test fixtures for PostgreSQL. It uses a testcontainer to start a PostgreSQL instance with the dvdrental database."""

import contextlib
import logging
import os
import tarfile
import zipfile
from subprocess import CalledProcessError

import docker
import pytest
from testcontainers.postgres import PostgresContainer


@pytest.fixture(autouse=True, scope="session")
def config_logging():
    """Set the log level of sqlfluff to CRITICAL."""
    logging.getLogger("sqlfluff").setLevel(logging.CRITICAL)


@contextlib.contextmanager
def try_bind(container, container_port, host_port):
    """Try to bind a port to the container, if it is already in use try another port."""
    try:
        with container.with_bind_ports(container_port, host_port) as container:
            yield container
    except docker.errors.APIError:
        logging.warning("Port %s is already in use, trying another port", host_port)
        with container.with_bind_ports(container_port, None) as container:
            yield container


@pytest.fixture(scope="session")
def postgres_container(tmp_path_factory):
    """Start a PostgreSQL container with the dvdrental database."""
    data_dir = tmp_path_factory.mktemp("data")
    dvd_rental_zip = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "data", "dvdrental.zip"
    )
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
        "-c",
        "track_commit_timestamp=on",
    ]

    with (
        try_bind(container, 5432, 5432) if not os.getenv("CI") else container
    ) as container:
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
