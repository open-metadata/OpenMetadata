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
Tests for unitycatalog.connection.get_sqlalchemy_connection.
"""

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.databricks.personalAccessToken import (
    PersonalAccessToken,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)
from metadata.ingestion.source.database.unitycatalog.connection import (
    get_sqlalchemy_connection,
)


def _connection(**overrides) -> UnityCatalogConnection:
    defaults = {
        "hostPort": "test-host:443",
        "authType": PersonalAccessToken(token="test-token"),
    }
    defaults.update(overrides)
    return UnityCatalogConnection(**defaults)


def test_returns_engine_when_http_path_and_connection_args_are_unset():
    """
    Regression for the AttributeError raised on
    `connection.connectionArguments.root.update(auth_args)` when both
    httpPath and connectionArguments are omitted from the service config.
    """
    connection = _connection()
    assert connection.httpPath is None
    assert connection.connectionArguments is None

    engine = get_sqlalchemy_connection(connection)

    assert isinstance(engine, Engine)


def test_returns_engine_when_http_path_is_set():
    """Engine is created and http_path is accepted as a connect arg."""
    connection = _connection(httpPath="/sql/1.0/warehouses/abc")

    engine = get_sqlalchemy_connection(connection)

    assert isinstance(engine, Engine)
    assert engine.url.host == "test-host"
