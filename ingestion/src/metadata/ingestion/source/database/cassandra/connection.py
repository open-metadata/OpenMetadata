#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Source connection handler
"""

from functools import partial  # noqa: I001
from typing import Optional

from cassandra.auth import PlainTextAuthProvider
from cassandra.cluster import (
    EXEC_PROFILE_DEFAULT,
    Cluster,
    ExecutionProfile,
    ProtocolVersion,
)
from cassandra.cluster import Session as CassandraSession
from pydantic import BaseModel

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.cassandraConnection import (
    CassandraConnection as CassandraConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import init_empty_connection_arguments
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.cassandra.queries import (
    CASSANDRA_GET_KEYSPACE_MATERIALIZED_VIEWS,
    CASSANDRA_GET_KEYSPACE_TABLES,
    CASSANDRA_GET_KEYSPACES,
    CASSANDRA_GET_RELEASE_VERSION,
)
from metadata.utils.constants import THREE_MIN


class CassandraConnection(BaseConnection[CassandraConnectionConfig, CassandraSession]):
    def _get_client(self) -> CassandraSession:
        connection = self.service_connection

        cluster_config = {}
        if hasattr(connection.authType, "cloudConfig"):
            cloud_config = connection.authType.cloudConfig  # pyright: ignore[reportOptionalMemberAccess, reportAttributeAccessIssue]
            cluster_cloud_config = {
                "connect_timeout": cloud_config.connectTimeout,  # pyright: ignore[reportOptionalMemberAccess]
                "use_default_tempdir": True,
                "secure_connect_bundle": cloud_config.secureConnectBundle,  # pyright: ignore[reportOptionalMemberAccess]
            }
            profile = ExecutionProfile(request_timeout=cloud_config.requestTimeout)  # pyright: ignore[reportOptionalMemberAccess, reportArgumentType]
            auth_provider = PlainTextAuthProvider("token", cloud_config.token)  # pyright: ignore[reportOptionalMemberAccess]
            cluster_config.update(
                {
                    "cloud": cluster_cloud_config,
                    "auth_provider": auth_provider,
                    "execution_profiles": {EXEC_PROFILE_DEFAULT: profile},
                    "protocol_version": ProtocolVersion.V4,
                }
            )
        else:
            host, port = connection.hostPort.split(":")
            cluster_config.update({"contact_points": [host], "port": port})
            if connection.username and getattr(connection.authType, "password", None):
                cluster_config["auth_provider"] = PlainTextAuthProvider(
                    username=connection.username,
                    password=connection.authType.password.get_secret_value(),  # pyright: ignore[reportOptionalMemberAccess, reportAttributeAccessIssue]
                )

        connection.connectionArguments = connection.connectionArguments or init_empty_connection_arguments()

        cluster = Cluster(
            **cluster_config,
            ssl_context=connection.connectionArguments.root.get("ssl_context"),  # pyright: ignore[reportOptionalMemberAccess]
        )
        self._on_close(cluster.shutdown)
        return cluster.connect()

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,  # noqa: UP045
        timeout_seconds: Optional[int] = THREE_MIN,  # noqa: UP045
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow
        """
        session = self.client

        class SchemaHolder(BaseModel):
            schema: Optional[str] = None  # noqa: UP045  # pyright: ignore[reportIncompatibleMethodOverride]

        holder = SchemaHolder()

        def test_get_release_version(session: CassandraSession):
            session.execute(CASSANDRA_GET_RELEASE_VERSION)

        def test_get_schemas(session: CassandraSession, holder_: SchemaHolder):
            for keyspace in session.execute(CASSANDRA_GET_KEYSPACES):
                holder_.schema = keyspace.keyspace_name
                break

        def test_get_tables(session: CassandraSession, holder_: SchemaHolder):
            session.execute(CASSANDRA_GET_KEYSPACE_TABLES, [holder_.schema])

        def test_get_views(session: CassandraSession, holder_: SchemaHolder):
            session.execute(CASSANDRA_GET_KEYSPACE_MATERIALIZED_VIEWS, [holder_.schema])

        test_fn = {
            "CheckAccess": partial(test_get_release_version, session),
            "GetSchemas": partial(test_get_schemas, session, holder),
            "GetTables": partial(test_get_tables, session, holder),
            "GetViews": partial(test_get_views, session, holder),
        }

        return test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=self.service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
