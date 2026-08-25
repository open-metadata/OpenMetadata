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
"""Unit tests for PinotDB connection handling."""

from metadata.generated.schema.entity.services.connections.database.pinotDBConnection import (
    PinotDBConnection as PinotDBConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.pinotDBConnection import (
    PinotDBScheme,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.pinotdb.connection import PinotDBConnection


def test_pinotdb_connection_is_base_connection():
    assert issubclass(PinotDBConnection, BaseConnection)


def test_get_connection_url_appends_controller():
    connection = PinotDBConnectionConfig(
        scheme=PinotDBScheme.pinot,
        hostPort="localhost:8099",
        pinotControllerHost="http://localhost:9000/",
    )
    assert (
        PinotDBConnection.get_connection_url(connection)
        == "pinot://localhost:8099/query/sql?controller=http://localhost:9000/"
    )
