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
"""Unit tests for the MongoDB BaseConnection wiring.

MongoDB is the first non-Engine connector: its client is a ``pymongo.MongoClient``
rather than a SQLAlchemy ``Engine``, so ``BaseConnection``'s client type is
``MongoClient`` and ``test_connection`` drives pymongo calls directly.
"""

from collections.abc import Iterator
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest
from pymongo.errors import OperationFailure

from metadata.core.connections.test_connection.check import CheckError, collect_checks
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBConnection as MongoDBConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBScheme,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.mongodb.connection import (
    MongoDBChecks,
    MongoDBConnection,
)

CONNECTION_MODULE = "metadata.ingestion.source.database.mongodb.connection"


def _config(**kwargs) -> MongoDBConnectionConfig:
    base = {
        "scheme": MongoDBScheme.mongodb,
        "username": "user",
        "password": "pass",
        "hostPort": "localhost:27017",
    }
    base.update(kwargs)
    return MongoDBConnectionConfig(**base)


def test_mongodb_connection_is_base_connection():
    assert issubclass(MongoDBConnection, BaseConnection)


def test_get_client_builds_a_mongo_client_from_the_url():
    with patch(f"{CONNECTION_MODULE}.MongoClient") as mock_mongo:
        client = MongoDBConnection(_config()).client
    args, kwargs = mock_mongo.call_args
    assert args[0].startswith("mongodb://")
    assert kwargs == {}
    assert client is mock_mongo.return_value


def test_get_client_passes_connection_options_as_kwargs():
    config = _config(connectionOptions={"serverSelectionTimeoutMS": "5000"})
    with patch(f"{CONNECTION_MODULE}.MongoClient") as mock_mongo:
        _ = MongoDBConnection(config).client
    assert mock_mongo.call_args.kwargs["serverSelectionTimeoutMS"] == "5000"


def test_close_releases_the_mongo_client_pool():
    with patch(f"{CONNECTION_MODULE}.MongoClient") as mock_mongo:
        connection = MongoDBConnection(_config())
        _ = connection.client
        connection.close()
    mock_mongo.return_value.close.assert_called_once_with()


def _client(databases: list[str], authorized: list[str]) -> MagicMock:
    """A client that only lets `authorized` databases list their collections"""
    client = MagicMock()
    client.server_info.return_value = {"version": "6.0.16"}
    client.list_database_names.return_value = databases

    def get_database(name: str) -> MagicMock:
        database = MagicMock()
        if name in authorized:
            database.list_collection_names.return_value = ["orders"]
        else:
            database.list_collection_names.side_effect = OperationFailure(f"not authorized on {name}")
        return database

    client.get_database.side_effect = get_database
    return client


@contextmanager
def _checks(config: MongoDBConnectionConfig, client: MagicMock) -> Iterator[MongoDBChecks]:
    """The provider, with the driver patched for as long as its checks run.

    The client is borrowed, so it is built on first read - inside the step, not at
    construction.
    """
    with patch(f"{CONNECTION_MODULE}.MongoClient", return_value=client):
        yield MongoDBConnection(config).checks()


def _probed_databases(client: MagicMock) -> list[str]:
    return [call.args[0] for call in client.get_database.call_args_list]


def test_mongodb_checks_cover_the_definition_steps():
    with _checks(_config(), _client(["testdb"], ["testdb"])) as checks:
        steps = collect_checks(checks)
    assert set(steps) == {DatabaseStep.CheckAccess, DatabaseStep.GetDatabases, DatabaseStep.GetCollections}


def test_get_collections_skips_the_databases_filtered_out():
    """The probe must not read a database the ingestion is configured to skip"""
    config = _config(schemaFilterPattern={"excludes": ["__mongo_connector", "admin", "local"]})
    client = _client(["__mongo_connector", "admin", "local", "testdb"], authorized=["testdb"])

    with _checks(config, client) as checks:
        evidence = checks.get_collections()

    assert _probed_databases(client) == ["testdb"]
    assert "testdb" in evidence.summary


def test_get_collections_passes_when_one_database_can_be_read():
    """Without filters the probe keeps going until a database lets us in"""
    client = _client(["admin", "local", "testdb"], authorized=["testdb"])

    with _checks(_config(), client) as checks:
        evidence = checks.get_collections()

    assert _probed_databases(client) == ["admin", "local", "testdb"]
    assert "testdb" in evidence.summary


def test_get_collections_fails_when_no_database_can_be_read():
    client = _client(["admin", "testdb"], authorized=[])

    with _checks(_config(), client) as checks, pytest.raises(CheckError):
        checks.get_collections()


def test_database_schema_is_the_only_database_probed():
    """`databaseSchema` pins the run to one database, so nothing is listed"""
    client = _client(["admin", "testdb"], authorized=["testdb"])

    with _checks(_config(databaseSchema="testdb"), client) as checks:
        checks.get_databases()
        evidence = checks.get_collections()

    client.list_database_names.assert_not_called()
    assert _probed_databases(client) == ["testdb"]
    assert "testdb" in evidence.summary


def test_get_collections_without_a_database_in_scope_is_a_caveat_not_a_failure():
    """Nothing to read collections from is a configuration answer, not an error"""
    config = _config(schemaFilterPattern={"excludes": [".*"]})
    client = _client(["admin", "testdb"], authorized=["testdb"])

    with _checks(config, client) as checks:
        evidence = checks.get_collections()

    assert _probed_databases(client) == []
    assert evidence.caveat is not None


def test_check_access_reports_the_server_version():
    with _checks(_config(), _client(["testdb"], ["testdb"])) as checks:
        assert "6.0.16" in checks.check_access().summary
