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
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.ingestion.connections.builders import (
    _dialect_supports_autocommit,
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
    init_empty_connection_arguments,
)


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
        self.assertEqual(get_connection_args_common(self.connection_with_args), {"hello": "world"})

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


class FakeDialectWithAutocommit:
    def get_isolation_level_values(self, dbapi_conn):
        return ("READ COMMITTED", "AUTOCOMMIT")


class FakeDialectNoAutocommit:
    def get_isolation_level_values(self, dbapi_conn):
        return ("READ COMMITTED",)


class FakeDialectRaises:
    def get_isolation_level_values(self, dbapi_conn):
        raise NotImplementedError("dialect has no isolation levels")


def test_dialect_supports_autocommit_true():
    assert _dialect_supports_autocommit(FakeDialectWithAutocommit()) is True


def test_dialect_supports_autocommit_false_when_absent():
    assert _dialect_supports_autocommit(FakeDialectNoAutocommit()) is False


def test_dialect_supports_autocommit_false_when_raises():
    assert _dialect_supports_autocommit(FakeDialectRaises()) is False


def test_create_generic_db_connection_applies_autocommit():
    engine = create_generic_db_connection(
        connection=object(),
        get_connection_url_fn=lambda _conn: "sqlite://",
        get_connection_args_fn=lambda _conn: {},
    )
    assert engine.get_execution_options().get("isolation_level") == "AUTOCOMMIT"


def test_create_generic_db_connection_respects_explicit_isolation_level():
    engine = create_generic_db_connection(
        connection=object(),
        get_connection_url_fn=lambda _conn: "sqlite://",
        get_connection_args_fn=lambda _conn: {},
        isolation_level="SERIALIZABLE",
    )
    assert engine.get_execution_options().get("isolation_level") != "AUTOCOMMIT"
