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
"""Unit tests for the BigTable BaseConnection wiring (non-Engine: MultiProjectClient).

Client building requires a full GCP service-account credential; the end-to-end
behaviour is exercised by tests/unit/topology/database/test_bigtable.py.
"""

from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.bigtable.connection import BigTableConnection


def test_bigtable_connection_is_base_connection():
    assert issubclass(BigTableConnection, BaseConnection)
