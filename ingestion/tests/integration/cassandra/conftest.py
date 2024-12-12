import textwrap

import pytest
from cassandra.cluster import Cluster, DCAwareRoundRobinPolicy

from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)


@pytest.fixture(scope="module")
def session(tmp_path_factory):
    """
    Start a Cassandra container with the dvdrental database.
    """
    from testcontainers.cassandra import CassandraContainer

    with CassandraContainer() as container, Cluster(
        container.get_contact_points(),
        load_balancing_policy=DCAwareRoundRobinPolicy(container.get_local_datacenter()),
    ) as cluster:
        session = cluster.connect()
        session.execute(
            textwrap.dedent(
                """CREATE KEYSPACE my_database
                WITH replication = {
                    'class': 'SimpleStrategy',
                    'replication_factor': 1
                };
                """
            )
        )
        session.set_keyspace("my_database")
        session.execute(
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
        yield session


@pytest.fixture(scope="module")
def create_service_request(session, tmp_path_factory):
    return CreateDatabaseServiceRequest.model_validate(
        {
            "name": "docker_test_" + tmp_path_factory.mktemp("cassandra").name,
            "serviceType": DatabaseServiceType.Cassandra.value,
            "connection": {
                "config": {
                    "username": "cassandra",
                    "authType": {"password": "cassandra"},
                    "hostPort": f"{session.cluster.contact_points[0][0]}:{session.cluster.contact_points[0][1]}",
                }
            },
        }
    )
