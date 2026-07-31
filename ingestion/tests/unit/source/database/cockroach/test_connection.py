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
"""Unit tests for CockroachDB connection handling."""

from metadata.generated.schema.entity.services.connections.database.cockroachConnection import (
    CockroachConnection as CockroachConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.cockroachConnection import (
    CockroachScheme,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.ingestion.source.database.cockroach.connection import CockroachConnection


def test_basic_auth_builds_expected_url():
    connection = CockroachConnectionConfig(
        username="openmetadata_user",
        authType=BasicAuth(password="openmetadata_password"),
        hostPort="localhost:26257",
        database="openmetadata_db",
        scheme=CockroachScheme.cockroachdb_psycopg2,
    )
    engine = CockroachConnection(connection).client
    assert (
        engine.url.render_as_string(hide_password=False)
        == "cockroachdb+psycopg2://openmetadata_user:openmetadata_password@localhost:26257/openmetadata_db"
    )
