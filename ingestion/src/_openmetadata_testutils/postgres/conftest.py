"""Test fixtures for PostgreSQL. It uses a testcontainer to start a PostgreSQL instance with the dvdrental database."""

import logging
import os
import zipfile
from subprocess import CalledProcessError

import pytest
from sqlalchemy import create_engine
from testcontainers.postgres import PostgresContainer

from _openmetadata_testutils.helpers.docker import copy_dir_to_container, try_bind


@pytest.fixture(autouse=True, scope="session")
def config_logging():
    """Set the log level of sqlfluff to CRITICAL."""
    logging.getLogger("sqlfluff").setLevel(logging.CRITICAL)


@pytest.fixture(scope="module")
def postgres_container(tmp_path_factory):
    """Start a PostgreSQL container with the dvdrental database."""
    data_dir = tmp_path_factory.mktemp("data")
    dvd_rental_zip = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "data", "dvdrental.zip"
    )
    zipfile.ZipFile(dvd_rental_zip, "r").extractall(str(data_dir))
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
        copy_dir_to_container(str(data_dir), docker_container, "/data")
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
        engine = create_engine(container.get_connection_url())
        engine.execute(
            "ALTER TABLE customer ADD COLUMN json_field JSONB DEFAULT '{}'::JSONB;"
        )
        yield container
