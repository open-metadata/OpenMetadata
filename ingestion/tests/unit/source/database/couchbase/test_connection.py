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
"""Unit tests for the Couchbase BaseConnection wiring (non-Engine: SDK Cluster).

The couchbase SDK is an optional dependency imported lazily inside
``_get_client``/``test_connection``, so this module only asserts the
BaseConnection wiring without importing the SDK.
"""

from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.couchbase.connection import CouchbaseConnection


def test_couchbase_connection_is_base_connection():
    assert issubclass(CouchbaseConnection, BaseConnection)
