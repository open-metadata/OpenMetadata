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
"""Unit tests for Druid connection handling.

URL parity is asserted through the connector's get_connection_url rather than by
instantiating an engine, which would need a reachable broker. Dialect resolution is
checked on its own: pydruid is in the `all` / `all-dev-env` extras that both the CI
unit lane and `make install_dev_env` install, so that check runs unconditionally.
"""

import pytest
from sqlalchemy.engine.url import make_url

from metadata.generated.schema.entity.services.connections.database.druidConnection import (
    DruidConnection as DruidConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.druidConnection import (
    DruidScheme,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.druid.connection import DruidConnection


def test_druid_connection_is_base_connection():
    assert issubclass(DruidConnection, BaseConnection)


def test_get_connection_url_appends_druid_sql_path():
    connection = DruidConnectionConfig(
        scheme=DruidScheme.druid,
        hostPort="localhost:8082",
    )
    assert DruidConnection.get_connection_url(connection) == "druid://localhost:8082/druid/v2/sql"


def test_get_connection_url_with_basic_auth():
    connection = DruidConnectionConfig(
        scheme=DruidScheme.druid,
        username="openmetadata_user",
        password="openmetadata_password",
        hostPort="localhost:8082",
    )
    assert (
        DruidConnection.get_connection_url(connection)
        == "druid://openmetadata_user:openmetadata_password@localhost:8082/druid/v2/sql"
    )


@pytest.mark.parametrize(
    ("scheme", "expected_url"),
    [
        (DruidScheme.druid, "druid://localhost:8082/druid/v2/sql"),
        (DruidScheme.druid_http, "druid+http://localhost:8082/druid/v2/sql"),
        (DruidScheme.druid_https, "druid+https://localhost:8082/druid/v2/sql"),
    ],
)
def test_get_connection_url_honours_every_scheme(scheme, expected_url):
    connection = DruidConnectionConfig(scheme=scheme, hostPort="localhost:8082")
    assert DruidConnection.get_connection_url(connection) == expected_url


@pytest.mark.parametrize("scheme", list(DruidScheme))
def test_every_scheme_maps_to_an_installed_dialect(scheme):
    """A scheme the schema accepts but SQLAlchemy cannot resolve fails at engine creation.

    pydruid registers druid, druid.http and druid.https as entry points; this pins the
    enum to what is actually installed instead of to a hardcoded list.
    """
    connection = DruidConnectionConfig(scheme=scheme, hostPort="localhost:8082")
    assert make_url(DruidConnection.get_connection_url(connection)).get_dialect() is not None
