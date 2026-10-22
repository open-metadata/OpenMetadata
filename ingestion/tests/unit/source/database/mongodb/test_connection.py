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
from pymongo.errors import OperationFailure, ServerSelectionTimeoutError

from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBConnection as MongoDBConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBScheme,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.mongodb.connection import (
    DatabaseHolder,
    MongoDBConnection,
    _get_collections,
    _get_databases,
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


def _denied(name: str) -> OperationFailure:
    return OperationFailure(f"not authorized on {name} to execute command", code=13)


def _client_with(databases: list[str], denied: set[str]) -> MagicMock:
    client = MagicMock()
    client.list_database_names.return_value = databases

    def get_database(name):
        database = MagicMock(name=name)
        if name in denied:
            database.list_collection_names.side_effect = _denied(name)
        return database

    client.get_database.side_effect = get_database
    return client


def test_get_databases_uses_the_configured_database_without_listing():
    client = _client_with(["admin", "sales"], denied=set())
    holder = DatabaseHolder()
    _get_databases(client, holder, "sales")
    assert holder.databases == ["sales"]
    client.list_database_names.assert_not_called()


def test_get_databases_puts_system_databases_aside():
    client = _client_with(["__mongo_connector", "admin", "config", "local", "test"], denied=set())
    holder = DatabaseHolder()
    _get_databases(client, holder)
    assert holder.databases == ["__mongo_connector", "test"]


def test_get_databases_keeps_system_databases_when_nothing_else_is_visible():
    client = _client_with(["admin", "local"], denied=set())
    holder = DatabaseHolder()
    _get_databases(client, holder)
    assert holder.databases == ["admin", "local"]


def test_get_collections_passes_when_any_database_is_listable():
    client = _client_with([], denied={"__mongo_connector"})
    _get_collections(client, DatabaseHolder(databases=["__mongo_connector", "test"]))
    assert [c.args[0] for c in client.get_database.call_args_list] == ["__mongo_connector", "test"]


def test_get_collections_raises_when_every_database_is_denied():
    client = _client_with([], denied={"a", "b"})
    with pytest.raises(OperationFailure, match="not authorized on b"):
        _get_collections(client, DatabaseHolder(databases=["a", "b"]))


def test_get_collections_does_not_swallow_non_authorization_errors():
    client = MagicMock()
    client.get_database.return_value.list_collection_names.side_effect = ServerSelectionTimeoutError("down")
    with pytest.raises(ServerSelectionTimeoutError):
        _get_collections(client, DatabaseHolder(databases=["a", "b"]))
    client.get_database.assert_called_once_with("a")


def test_get_collections_falls_back_to_the_url_default_database():
    client = _client_with([], denied=set())
    _get_collections(client, DatabaseHolder())
    client.get_database.assert_called_once_with(None)
