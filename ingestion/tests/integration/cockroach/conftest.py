import textwrap
import uuid

import pytest
from sqlalchemy import create_engine, text
from testcontainers.cockroachdb import CockroachDBContainer  # noqa: TID251
from testcontainers.core.config import testcontainers_config
from testcontainers.core.waiting_utils import wait_for_logs

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

# Partitioning requires v24.3+ for license-free single-node development clusters.
COCKROACH_IMAGE = "cockroachdb/cockroach:v24.3.0"


@pytest.fixture(scope="module")
def cockroach_container():
    old_max_tries = testcontainers_config.max_tries
    testcontainers_config.max_tries = 240
    try:
        with CockroachDBContainer(image=COCKROACH_IMAGE) as container:
            # Testcontainers returns after user creation, before database privileges are granted.
            wait_for_logs(container, "end running init files from /docker-entrypoint-initdb.d")
            testcontainers_config.max_tries = old_max_tries
            yield container
    finally:
        testcontainers_config.max_tries = old_max_tries


@pytest.fixture(scope="module")
def cockroach_engine(cockroach_container):
    engine = create_engine(cockroach_container.get_connection_url())
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture(scope="module")
def user_profiles(cockroach_engine):
    with cockroach_engine.connect() as conn:
        conn.execute(
            text(
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
        )
        conn.commit()


@pytest.fixture(scope="module")
def create_service_request(cockroach_container):
    return CreateDatabaseServiceRequest(
        name=f"docker_test_cockroach_{uuid.uuid4().hex[:8]}",
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
def create_test_data(cockroach_engine, user_profiles):
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

    with cockroach_engine.connect() as conn:
        for stmt in setup_statements:
            conn.execute(text(textwrap.dedent(stmt)))
        conn.commit()

    yield
