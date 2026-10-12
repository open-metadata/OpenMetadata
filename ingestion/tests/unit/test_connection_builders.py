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

from sqlalchemy import text

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


def test_create_generic_db_connection_applies_autocommit(tmp_path):
    """
    Statements must land without an explicit commit, so a read-only crawl does not
    hold a transaction -- and therefore locks -- open for the whole run (issue #29092).
    """
    engine = create_generic_db_connection(
        connection=object(),
        get_connection_url_fn=lambda _conn: f"sqlite:///{tmp_path / 'autocommit.db'}",
        get_connection_args_fn=lambda _conn: {},
    )

    with engine.connect() as writer:
        writer.execute(text("create table t (id integer)"))
        writer.execute(text("insert into t values (1)"))
        # deliberately no commit: another connection must already see the row
        with engine.connect() as reader:
            assert reader.execute(text("select count(*) from t")).scalar() == 1


def test_create_generic_db_connection_autocommit_survives_pool_checkin():
    """
    Releasing a connection must not blow up on a dialect that cannot read its own
    isolation level back. SQLAlchemy restores the level on checkin, and only falls
    back to ``default_isolation_level`` -- which ``Dialect.initialize`` leaves as
    ``None`` whenever ``get_isolation_level`` raises ``NotImplementedError`` -- when
    the level was not recorded on the dialect. Azure Synapse hits exactly that: it
    cannot query ``sys.dm_exec_sessions``, so the fallback tripped an
    ``AssertionError`` in ``reset_isolation_level`` and every test connection failed
    with a misleading "validate the credentials".
    """
    engine = create_generic_db_connection(
        connection=object(),
        get_connection_url_fn=lambda _conn: "sqlite://",
        get_connection_args_fn=lambda _conn: {},
    )

    with engine.connect() as conn:
        # initialize() has run; emulate a dialect that could not read the level back
        engine.dialect.default_isolation_level = None
        assert conn.execute(text("select 1")).scalar() == 1
    # the release above is what used to raise


def test_create_generic_db_connection_respects_explicit_isolation_level():
    engine = create_generic_db_connection(
        connection=object(),
        get_connection_url_fn=lambda _conn: "sqlite://",
        get_connection_args_fn=lambda _conn: {},
        isolation_level="SERIALIZABLE",
    )
    with engine.connect() as conn:
        assert conn.get_isolation_level() == "SERIALIZABLE"
