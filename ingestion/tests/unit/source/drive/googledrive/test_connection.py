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
"""Unit tests for Google Drive connection handling."""

from unittest.mock import MagicMock, patch

from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.drive.googledrive.connection import GoogleDriveConnection

CONNECTION_MODULE = "metadata.ingestion.source.drive.googledrive.connection"


def test_googledrive_connection_is_base_connection():
    assert issubclass(GoogleDriveConnection, BaseConnection)


def test_get_client_builds_googledrive_client():
    config = MagicMock()
    config.credentials.gcpImpersonateServiceAccount = None
    with (
        patch(f"{CONNECTION_MODULE}.set_google_credentials"),
        patch(f"{CONNECTION_MODULE}.default", return_value=(MagicMock(), None)),
        patch(f"{CONNECTION_MODULE}.build") as mock_build,
    ):
        client = GoogleDriveConnection(config).client

    assert client is not None
    assert mock_build.call_count == 2


def test_test_connection_runs_steps():
    conn = GoogleDriveConnection(MagicMock())
    conn._client = MagicMock()
    with patch(f"{CONNECTION_MODULE}.test_connection_steps") as mock_steps:
        result = conn.test_connection(metadata=MagicMock())

    assert result is mock_steps.return_value
