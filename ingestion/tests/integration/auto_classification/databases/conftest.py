import os

import pytest
from testcontainers.postgres import PostgresContainer

from _openmetadata_testutils.helpers.docker import try_bind


@pytest.fixture(scope="module")
def postgres_container():
    """Start a PostgreSQL container with the test database."""
    init_file = os.path.join(os.path.dirname(__file__), "init.sql")  # noqa: PTH118, PTH120
    container = PostgresContainer("postgres:15", dbname="test_db").with_volume_mapping(
        init_file, "/docker-entrypoint-initdb.d/init.sql"
    )

    with try_bind(container, 5432, 5432) if not os.getenv("CI") else container as container:
        yield container
