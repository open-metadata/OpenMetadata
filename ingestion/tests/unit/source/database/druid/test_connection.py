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

The Druid dialect (pydruid) is an optional extra absent from the unit-test
environment, so URL parity is asserted via the connector's get_connection_url
rather than by instantiating an engine.
"""

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
