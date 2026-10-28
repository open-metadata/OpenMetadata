import textwrap
import uuid

import pytest
from cassandra.cluster import Cluster, DCAwareRoundRobinPolicy
from testcontainers.cassandra import CassandraContainer
from testcontainers.core.waiting_utils import wait_for_logs

from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)


class ReadyCassandraContainer(CassandraContainer):
    def _connect(self):
        wait_for_logs(self, "Startup complete", timeout=120)


@pytest.fixture(scope="module")
def session(tmp_path_factory):
    """
    Start a Cassandra container with the dvdrental database.
    """
    with (
        ReadyCassandraContainer() as container,
        Cluster(
            container.get_contact_points(),
            load_balancing_policy=DCAwareRoundRobinPolicy(container.get_local_datacenter()),
        ) as cluster,
    ):
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
def create_service_request(session):
    return CreateDatabaseServiceRequest.model_validate(
        {
            "name": f"docker_test_cassandra_{uuid.uuid4().hex[:8]}",
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
