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
"""Unit tests for Greenplum connection handling."""

from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.greenplumConnection import (
    GreenplumConnection as GreenplumConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.greenplumConnection import (
    GreenplumScheme,
)
from metadata.ingestion.source.database.greenplum.connection import GreenplumConnection


def test_basic_auth_builds_expected_url():
    connection = GreenplumConnectionConfig(
        username="openmetadata_user",
        authType=BasicAuth(password="openmetadata_password"),
        hostPort="localhost:5432",
        database="openmetadata_db",
        scheme=GreenplumScheme.postgresql_psycopg2,
    )
    engine = GreenplumConnection(connection).client
    assert (
        engine.url.render_as_string(hide_password=False)
        == "postgresql+psycopg2://openmetadata_user:openmetadata_password@localhost:5432/openmetadata_db"
    )
