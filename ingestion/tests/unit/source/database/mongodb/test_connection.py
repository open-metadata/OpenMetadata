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

from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBConnection as MongoDBConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBScheme,
)
from metadata.ingestion.connections.connection import BaseConnection
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
