import os
import textwrap

import pytest
from sqlalchemy import create_engine

from _openmetadata_testutils.helpers.docker import try_bind
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.connections.database.cockroachConnection import (
    CockroachConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseServiceType,
)


@pytest.fixture(scope="module")
def cockroach_container(tmp_path_factory):
    """
    Start a Cockroach container.
    """
    from testcontainers.cockroachdb import CockroachDBContainer

    container = CockroachDBContainer(image="cockroachdb/cockroach:v23.1.0")

    with (
        try_bind(container, 26257, None) if not os.getenv("CI") else container
    ) as container:
        engine = create_engine(container.get_connection_url())
        engine.execute(
            textwrap.dedent(
                """
                CREATE TABLE user_profiles (
                    user_id UUID PRIMARY KEY,
                    first_name TEXT,
                    last_name TEXT,
                    email TEXT,
                    signup_date TIMESTAMP,
                    is_active BOOLEAN
                );
                """
            )
        )

        yield container


@pytest.fixture(scope="module")
def create_service_request(cockroach_container, tmp_path_factory):
    return CreateDatabaseServiceRequest(
        name="docker_test_" + tmp_path_factory.mktemp("cockroach").name,
        serviceType=DatabaseServiceType.Cockroach,
        connection=DatabaseConnection(
            config=CockroachConnection(
                username=cockroach_container.username,
                authType={"password": cockroach_container.password},
                hostPort=f"localhost:{cockroach_container.get_exposed_port(26257)}",
                database=cockroach_container.dbname,
            )
        ),
    )


@pytest.fixture(scope="module")
def create_test_data(cockroach_container):
    engine = create_engine(cockroach_container.get_connection_url())

    setup_statements = [
        """
        INSERT INTO user_profiles (user_id, first_name, last_name, email, signup_date, is_active)
        VALUES (gen_random_uuid(), 'Alice', 'Smith', 'alice.smith@example.com', '2023-01-15 10:00:00', TRUE)
        """,
        """
        INSERT INTO user_profiles (user_id, first_name, last_name, email, signup_date, is_active)
        VALUES (gen_random_uuid(), 'Bob', 'Jones', 'bob.jones@example.com', '2023-02-20 12:30:00', TRUE)
        """,
        """
        INSERT INTO user_profiles (user_id, first_name, last_name, email, signup_date, is_active)
        VALUES (gen_random_uuid(), 'Carol', 'Williams', 'carol.williams@example.com', '2023-03-10 09:15:00', FALSE)
        """,
        """
        INSERT INTO user_profiles (user_id, first_name, last_name, email, signup_date, is_active)
        VALUES (gen_random_uuid(), 'David', 'Brown', 'david.brown@example.com', '2023-04-05 14:45:00', TRUE)
        """,
        """
        INSERT INTO user_profiles (user_id, first_name, last_name, email, signup_date, is_active)
        VALUES (gen_random_uuid(), 'Eve', 'Davis', 'eve.davis@example.com', '2023-05-22 08:00:00', FALSE)
        """,
        """
        CREATE TABLE kv (
            k INT8 NOT NULL,
            v BYTES NOT NULL,
            CONSTRAINT kv_pkey PRIMARY KEY (k ASC)
        )
        """,
        "INSERT INTO kv (k, v) VALUES (1, b'\\x00\\x01\\x02\\x03')",
        "INSERT INTO kv (k, v) VALUES (2, b'\\x68\\x65\\x6c\\x6c\\x6f')",
        "INSERT INTO kv (k, v) VALUES (3, b'\\xde\\xad\\xbe\\xef')",
        "INSERT INTO kv (k, v) VALUES (4, b'\\xca\\xfe\\xba\\xbe')",
        "INSERT INTO kv (k, v) VALUES (5, b'\\xff\\x00\\xff\\x00')",
        """
        CREATE TABLE employees (
            employee_id INT8 PRIMARY KEY DEFAULT unique_rowid(),
            full_name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            department TEXT,
            hire_date TIMESTAMP
        )
        """,
        """
        INSERT INTO employees (full_name, email, phone, department, hire_date)
        VALUES ('John Doe', 'john.doe@company.com', '555-0101', 'Engineering', '2021-06-01 09:00:00')
        """,
        """
        INSERT INTO employees (full_name, email, phone, department, hire_date)
        VALUES ('Jane Smith', 'jane.smith@company.com', '555-0102', 'Marketing', '2021-07-15 09:00:00')
        """,
        """
        INSERT INTO employees (full_name, email, phone, department, hire_date)
        VALUES ('Robert Johnson', 'robert.johnson@company.com', '555-0103', 'Finance', '2022-01-10 09:00:00')
        """,
        """
        INSERT INTO employees (full_name, email, phone, department, hire_date)
        VALUES ('Maria Garcia', 'maria.garcia@company.com', '555-0104', 'HR', '2022-03-20 09:00:00')
        """,
        """
        INSERT INTO employees (full_name, email, phone, department, hire_date)
        VALUES ('James Wilson', 'james.wilson@company.com', '555-0105', 'Engineering', '2023-02-14 09:00:00')
        """,
    ]

    for stmt in setup_statements:
        engine.execute(textwrap.dedent(stmt))

    yield
