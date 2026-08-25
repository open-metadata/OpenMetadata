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
"""Unit tests for SFTP connection handling."""

from unittest.mock import MagicMock, patch

from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.drive.sftp.connection import SftpConnection

CONNECTION_MODULE = "metadata.ingestion.source.drive.sftp.connection"


def test_sftp_connection_is_base_connection():
    assert issubclass(SftpConnection, BaseConnection)


def test_get_client_builds_sftp_client():
    from metadata.generated.schema.entity.services.connections.drive.sftpConnection import (
        BasicAuth,
    )
    from metadata.generated.schema.entity.services.connections.drive.sftpConnection import (
        SftpConnection as SftpConnectionConfig,
    )

    config = SftpConnectionConfig(host="localhost", port=22, authType=BasicAuth(username="u", password="p"))
    with (
        patch(f"{CONNECTION_MODULE}.Transport") as mock_transport,
        patch(f"{CONNECTION_MODULE}.SFTPClient") as mock_sftp,
    ):
        client = SftpConnection(config).client

    assert client.sftp is mock_sftp.from_transport.return_value
    mock_transport.assert_called_once_with(("localhost", 22))


def test_test_connection_runs_steps():
    conn = SftpConnection(MagicMock())
    conn._client = MagicMock()
    with patch(f"{CONNECTION_MODULE}.test_connection_steps") as mock_steps:
        result = conn.test_connection(metadata=MagicMock())

    assert result is mock_steps.return_value
