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
"""Unit tests for Doris connection handling."""

from metadata.generated.schema.entity.services.connections.database.dorisConnection import (
    DorisConnection as DorisConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.dorisConnection import (
    DorisScheme,
)
from metadata.ingestion.connections.builders import get_connection_url_common
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.doris.connection import DorisConnection


def test_doris_connection_is_base_connection():
    assert issubclass(DorisConnection, BaseConnection)


def test_basic_auth_builds_expected_url():
    connection = DorisConnectionConfig(
        username="openmetadata_user",
        password="openmetadata_password",
        hostPort="localhost:9030",
        databaseSchema="openmetadata_db",
        scheme=DorisScheme.doris,
    )
    # Assert via the URL builder, not .client: the doris dialect (pydoris-custom,
    # mysqlclient DBAPI) is installed --no-deps in runtime images only and is
    # absent from the unit-test environment.
    assert (
        get_connection_url_common(connection)
        == "doris://openmetadata_user:openmetadata_password@localhost:9030/openmetadata_db"
    )
