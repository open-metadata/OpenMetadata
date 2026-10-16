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
"""Unit tests for MariaDB connection handling."""

from metadata.generated.schema.entity.services.connections.database.mariaDBConnection import (
    MariaDBConnection as MariaDBConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.mariaDBConnection import (
    MariaDBScheme,
)
from metadata.ingestion.source.database.mariadb.connection import MariaDBConnection


def test_basic_auth_builds_expected_url():
    connection = MariaDBConnectionConfig(
        username="openmetadata_user",
        password="openmetadata_password",
        hostPort="localhost:3306",
        databaseSchema="openmetadata_db",
        scheme=MariaDBScheme.mysql_pymysql,
    )
    engine = MariaDBConnection(connection).client
    assert (
        engine.url.render_as_string(hide_password=False)
        == "mysql+pymysql://openmetadata_user:openmetadata_password@localhost:3306/openmetadata_db"
    )
