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

from unittest.mock import MagicMock, patch

import pytest
from pymongo.errors import OperationFailure

from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBConnection as MongoDBConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBScheme,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.database.mongodb.connection import MongoDBConnection

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


def _fake_client(databases: list[str], authorized: list[str]) -> MagicMock:
    """A client that only lets `authorized` databases list their collections"""
    client = MagicMock()
    client.list_database_names.return_value = databases

    def get_database(name: str) -> MagicMock:
        database = MagicMock()
        if name in authorized:
            database.list_collection_names.return_value = ["collection"]
        else:
            database.list_collection_names.side_effect = OperationFailure(f"not authorized on {name}")
        return database

    client.get_database.side_effect = get_database
    return client


def _test_steps(config: MongoDBConnectionConfig, client: MagicMock) -> dict:
    """Build the test connection steps against `client` and hand them back to be run"""
    with (
        patch(f"{CONNECTION_MODULE}.MongoClient", return_value=client),
        patch(f"{CONNECTION_MODULE}.test_connection_steps") as mock_steps,
    ):
        MongoDBConnection(config).test_connection(metadata=MagicMock())
    return mock_steps.call_args.kwargs["test_fn"]


def _probed_databases(client: MagicMock) -> list[str]:
    return [call.args[0] for call in client.get_database.call_args_list]


def test_get_collections_skips_the_databases_filtered_out():
    """The probe must not touch a database the ingestion is configured to skip"""
    config = _config(schemaFilterPattern={"excludes": ["__mongo_connector", "admin", "local"]})
    client = _fake_client(["__mongo_connector", "admin", "local", "testdb"], authorized=["testdb"])

    steps = _test_steps(config, client)
    steps["GetDatabases"]()
    steps["GetCollections"]()

    assert _probed_databases(client) == ["testdb"]


def test_get_collections_only_probes_the_included_databases():
    config = _config(schemaFilterPattern={"includes": ["testdb"]})
    client = _fake_client(["admin", "testdb"], authorized=["testdb"])

    steps = _test_steps(config, client)
    steps["GetDatabases"]()
    steps["GetCollections"]()

    assert _probed_databases(client) == ["testdb"]


def test_get_collections_passes_when_one_database_can_be_read():
    """Without filters the probe keeps going until a database lets us in"""
    client = _fake_client(["admin", "local", "testdb"], authorized=["testdb"])

    steps = _test_steps(_config(), client)
    steps["GetDatabases"]()
    steps["GetCollections"]()

    assert _probed_databases(client) == ["admin", "local", "testdb"]


def test_get_collections_fails_when_no_database_can_be_read():
    client = _fake_client(["admin", "testdb"], authorized=[])

    steps = _test_steps(_config(), client)
    steps["GetDatabases"]()

    with pytest.raises(OperationFailure):
        steps["GetCollections"]()


def test_database_schema_is_the_only_database_probed():
    """`databaseSchema` restricts the ingestion to one database, so it needs no listing"""
    config = _config(databaseSchema="testdb")
    client = _fake_client(["admin", "testdb"], authorized=["testdb"])

    steps = _test_steps(config, client)
    steps["GetDatabases"]()
    steps["GetCollections"]()

    client.list_database_names.assert_not_called()
    assert _probed_databases(client) == ["testdb"]


def test_get_collections_passes_when_no_database_is_in_scope():
    """Nothing to read collections from is not a connection failure"""
    config = _config(schemaFilterPattern={"excludes": [".*"]})
    client = _fake_client(["admin", "testdb"], authorized=["testdb"])

    steps = _test_steps(config, client)
    steps["GetDatabases"]()
    steps["GetCollections"]()

    client.get_database.assert_not_called()


def test_get_collections_fails_when_the_databases_could_not_be_listed():
    """A failed GetDatabases must not leave GetCollections reporting success"""
    client = _fake_client([], authorized=[])
    client.list_database_names.side_effect = OperationFailure("not authorized on admin")

    steps = _test_steps(_config(), client)
    with pytest.raises(OperationFailure):
        steps["GetDatabases"]()

    with pytest.raises(SourceConnectionException):
        steps["GetCollections"]()
