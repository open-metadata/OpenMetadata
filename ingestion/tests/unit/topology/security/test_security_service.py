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
"""Unit tests for the SecurityServiceSource base connection lifecycle."""

from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.source.security.security_service import SecurityServiceSource

SECURITY_SERVICE_MODULE = "metadata.ingestion.source.security.security_service"


class SecuritySourceForTest(SecurityServiceSource):
    """Minimal concrete source: the base's connection lifecycle is under test."""

    @classmethod
    def create(cls, config_dict, metadata, pipeline_name=None):
        """Not exercised"""

    def prepare(self):
        """Not exercised"""

    def get_client(self):
        """Legacy hook: only reached when the connector has no connection_class"""
        return LEGACY_CLIENT

    def mark_security_entities_as_deleted(self):
        """Not exercised"""


LEGACY_CLIENT = MagicMock(name="legacy_client")


@patch(f"{SECURITY_SERVICE_MODULE}.run_test_connection")
@patch(f"{SECURITY_SERVICE_MODULE}.create_connection")
def test_owned_connection_closed_when_test_connection_fails(mock_create_connection, mock_run_test_connection):
    """A failing test-connection in __init__ disposes the owned connection and
    re-raises the original error."""
    mock_run_test_connection.side_effect = RuntimeError("cannot connect")

    with pytest.raises(RuntimeError):
        SecuritySourceForTest(MagicMock(), MagicMock())

    mock_create_connection.return_value.close.assert_called_once()


@patch(f"{SECURITY_SERVICE_MODULE}.run_test_connection")
@patch(f"{SECURITY_SERVICE_MODULE}.create_connection")
def test_owned_connection_is_reused_for_the_test_step(mock_create_connection, mock_run_test_connection):
    """The source tests through the connection it owns instead of building a second one."""
    source = SecuritySourceForTest(MagicMock(), MagicMock())

    mock_run_test_connection.assert_called_once_with(source.metadata, mock_create_connection.return_value)
    assert source.connection is mock_create_connection.return_value.client
    assert source.connection_obj is source.connection
    assert source.client is source.connection


@patch(f"{SECURITY_SERVICE_MODULE}.test_connection_common")
@patch(f"{SECURITY_SERVICE_MODULE}.get_connection")
@patch(f"{SECURITY_SERVICE_MODULE}.create_connection", return_value=None)
def test_unowned_connection_reports_a_failing_test(_mock_create_connection, _mock_get_connection, mock_common):
    """Without a ``connection_class`` the test still runs through the legacy seam,
    which raises on failure instead of discarding the result."""
    mock_common.side_effect = RuntimeError("cannot connect")

    with pytest.raises(RuntimeError, match="cannot connect"):
        SecuritySourceForTest(MagicMock(), MagicMock())


@patch(f"{SECURITY_SERVICE_MODULE}.run_test_connection")
@patch(f"{SECURITY_SERVICE_MODULE}.create_connection")
def test_close_disposes_the_owned_connection(mock_create_connection, _mock_run_test_connection):
    source = SecuritySourceForTest(MagicMock(), MagicMock())

    source.close()

    mock_create_connection.return_value.close.assert_called_once()
