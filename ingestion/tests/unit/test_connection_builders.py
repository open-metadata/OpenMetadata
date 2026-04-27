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
Validate connection builder utilities
"""

from unittest import TestCase

from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.cassandraConnection import (
    CassandraConnection,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.ingestion.connections.builders import (
    get_connection_args_common,
    get_connection_options_dict,
    init_empty_connection_arguments,
)
from metadata.ingestion.models.custom_pydantic import _DATABASE_CONNECTION_MODULE_MARKER


class ConnectionBuilderTest(TestCase):
    """
    Assert utility functions
    """

    connection = MysqlConnection(
        username="username",
        authType=BasicAuth(password="password"),
        hostPort="http://localhost:1234",
    )

    connection_with_args = MysqlConnection(
        username="username",
        authType=BasicAuth(password="password"),
        hostPort="http://localhost:1234",
        connectionArguments={"hello": "world"},
    )

    connection_with_options = MysqlConnection(
        username="username",
        authType=BasicAuth(password="password"),
        hostPort="http://localhost:1234",
        connectionOptions={"hello": "world"},
    )

    def test_get_connection_args_common(self):
        """
        With null and existing params
        """
        self.assertEqual(get_connection_args_common(self.connection), {})
        self.assertEqual(
            get_connection_args_common(self.connection_with_args), {"hello": "world"}
        )

    def test_get_connection_options_dict(self):
        """
        Will null and existing params
        """
        self.assertIsNone(get_connection_options_dict(self.connection))
        self.assertEqual(
            get_connection_options_dict(self.connection_with_options),
            {"hello": "world"},
        )

    def test_init_empty_connection_arguments(self):
        """
        To allow easy key handling
        """
        new_args = init_empty_connection_arguments()
        new_args.root["hello"] = "world"

        self.assertEqual(new_args.root.get("hello"), "world")
        self.assertIsNone(new_args.root.get("not there"))

    def test_model_post_init_strips_url_scheme_from_hostport(self):
        """
        Verify that model_post_init strips URL schemes from hostPort at
        construction time so connectors that call hostPort.split(":") directly
        receive a clean hostname[:port] value.
        """
        # http:// prefix should be stripped
        conn = MysqlConnection(
            username="user",
            authType=BasicAuth(password="pass"),
            hostPort="http://localhost:3306",
        )
        self.assertEqual(conn.hostPort, "localhost:3306")

        # https:// prefix should be stripped
        conn2 = MysqlConnection(
            username="user",
            authType=BasicAuth(password="pass"),
            hostPort="https://myhost:5432",
        )
        self.assertEqual(conn2.hostPort, "myhost:5432")

        # Already clean value should pass through unchanged
        conn3 = MysqlConnection(
            username="user",
            authType=BasicAuth(password="pass"),
            hostPort="localhost:3306",
        )
        self.assertEqual(conn3.hostPort, "localhost:3306")

    def test_model_post_init_raises_for_invalid_port_in_hostport(self):
        """
        Verify that a non-numeric port in a scheme-prefixed hostPort raises
        at model construction time (fail-fast) rather than producing a
        confusing error deep in connector code.
        """
        with self.assertRaises(Exception):
            MysqlConnection(
                username="user",
                authType=BasicAuth(password="pass"),
                hostPort="http://localhost:abc",
            )

    def test_non_database_connections_not_stripped(self):
        """
        Verify that non-database connection classes (metadata, dashboard, pipeline, …)
        are NOT subject to hostPort scheme stripping because their hostPort legitimately
        stores a full URL (e.g. OpenMetadataConnection hostPort = http://localhost:8585/api).

        The guard uses the module path: only classes whose __module__ contains
        _DATABASE_CONNECTION_MODULE_MARKER ('.services.connections.database.')
        are stripped.  All others pass through unchanged.
        """
        # Confirm the marker is correct
        self.assertIn("database", _DATABASE_CONNECTION_MODULE_MARKER)

        # OpenMetadataConnection.hostPort is a plain str that expects a full URL.
        # Its module contains '.connections.metadata.' — NOT the database marker —
        # so it must NOT be stripped.
        ometa = OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
        )
        self.assertIn("http", ometa.hostPort)
        self.assertIn("localhost", ometa.hostPort)

    def test_none_hostport_does_not_crash(self):
        """
        Regression test for gitar-bot bug report: constructing a database
        connection where hostPort is Optional and left as None must NOT raise
        AttributeError from strip_hostport_scheme(None).
        """
        # CassandraConnection.hostPort is Optional[str] = None by default.
        conn = CassandraConnection()
        self.assertIsNone(conn.hostPort)
