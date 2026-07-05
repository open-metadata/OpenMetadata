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
"""Unit tests for SAP HANA connection handling.

The SAP HANA dialect is an optional extra absent from the unit-test
environment, so URL parity is asserted via each connection-mode strategy
rather than by instantiating an engine.
"""

from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.database.sapHana.sapHanaHDBConnection import (
    SapHanaHDBConnection,
)
from metadata.generated.schema.entity.services.connections.database.sapHana.sapHanaSQLConnection import (
    SapHanaSQLConnection,
)
from metadata.generated.schema.entity.services.connections.database.sapHanaConnection import (
    SapHanaConnection as SapHanaConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.sapHanaConnection import (
    SapHanaScheme,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.saphana.connection import (
    SapHanaConnection,
    SapHanaHDBStrategy,
    SapHanaSQLStrategy,
)

CONNECTION_MODULE = "metadata.ingestion.source.database.saphana.connection"


def _sql_config(**sql_kwargs) -> SapHanaConnectionConfig:
    return SapHanaConnectionConfig(
        scheme=SapHanaScheme.hana,
        connection=SapHanaSQLConnection(
            username="openmetadata_user",
            password="openmetadata_password",
            hostPort="localhost:39041",
            **sql_kwargs,
        ),
    )


def _hdb_config() -> SapHanaConnectionConfig:
    return SapHanaConnectionConfig(
        scheme=SapHanaScheme.hana,
        connection=SapHanaHDBConnection(userKey="USER1UserKey"),
    )


def test_saphana_connection_is_base_connection():
    assert issubclass(SapHanaConnection, BaseConnection)


def test_sql_url_includes_database():
    config = _sql_config(database="HXE")
    url = SapHanaSQLStrategy(config, config.connection).get_url()
    assert url == "hana://openmetadata_user:openmetadata_password@localhost:39041/HXE"


def test_sql_url_appends_options_with_database():
    config = SapHanaConnectionConfig(
        scheme=SapHanaScheme.hana,
        connection=SapHanaSQLConnection(
            username="openmetadata_user",
            password="openmetadata_password",
            hostPort="localhost:39041",
            database="HXE",
        ),
        connectionOptions={"encrypt": "true"},
    )
    url = SapHanaSQLStrategy(config, config.connection).get_url()
    assert url == "hana://openmetadata_user:openmetadata_password@localhost:39041/HXE?encrypt=true"


def test_sql_url_without_database():
    config = _sql_config()
    url = SapHanaSQLStrategy(config, config.connection).get_url()
    assert url == "hana://openmetadata_user:openmetadata_password@localhost:39041"


def test_hdb_url_uses_user_key():
    config = _hdb_config()
    url = SapHanaHDBStrategy(config, config.connection).get_url()
    assert url == "hana://userkey=USER1UserKey"


def test_get_client_selects_sql_strategy():
    config = _sql_config(database="HXE")
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection:
        _ = SapHanaConnection(config).client
    url_fn = mock_connection.call_args.kwargs["get_connection_url_fn"]
    assert url_fn(config) == "hana://openmetadata_user:openmetadata_password@localhost:39041/HXE"


def test_get_client_selects_hdb_strategy():
    config = _hdb_config()
    with patch(f"{CONNECTION_MODULE}.create_generic_db_connection") as mock_connection:
        _ = SapHanaConnection(config).client
    url_fn = mock_connection.call_args.kwargs["get_connection_url_fn"]
    assert url_fn(config) == "hana://userkey=USER1UserKey"


@patch(f"{CONNECTION_MODULE}.inspect")
@patch(f"{CONNECTION_MODULE}.create_generic_db_connection")
def test_hdb_test_functions_tolerate_missing_database_schema(_mock_connection, mock_inspect):
    mock_inspect.return_value.get_schema_names.return_value = []
    connection = SapHanaConnection(_hdb_config())

    test_functions = connection._build_test_functions()
    test_functions["GetTables"]()
    test_functions["GetViews"]()

    mock_inspect.return_value.get_schema_names.assert_called()
