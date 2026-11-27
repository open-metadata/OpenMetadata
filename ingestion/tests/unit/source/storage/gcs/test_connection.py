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
"""Unit tests for GCS object store connection handling."""

from unittest.mock import MagicMock, call, patch

import pytest

from metadata.generated.schema.entity.services.connections.storage.gcsConnection import (
    GcsConnection as GcsConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.storage.gcs.connection import GcsConnection, get_connection

CONNECTION_MODULE = "metadata.ingestion.source.storage.gcs.connection"
CREDENTIALS_MODULE = "metadata.utils.credentials"


def test_gcs_connection_is_base_connection():
    assert issubclass(GcsConnection, BaseConnection)


def test_get_client_delegates_to_get_connection():
    with patch(f"{CONNECTION_MODULE}.get_connection") as mock_get:
        conn = GcsConnection(MagicMock())
        client = conn.client

    assert client is mock_get.return_value
    mock_get.assert_called_once_with(conn.service_connection)


def test_test_connection_runs_steps():
    conn = GcsConnection(MagicMock())
    conn._client = MagicMock()
    with patch(f"{CONNECTION_MODULE}.test_connection_steps") as mock_steps:
        result = conn.test_connection(metadata=MagicMock())

    assert result is mock_steps.return_value


TARGET_SA = "target@my-project.iam.gserviceaccount.com"


def _gcs_config(impersonate=None) -> GcsConnectionConfig:
    credentials = {"gcpConfig": {"type": "service_account", "projectId": ["p1", "p2"]}}
    if impersonate is not None:
        credentials["gcpImpersonateServiceAccount"] = impersonate
    return GcsConnectionConfig.model_validate({"credentials": credentials})


def test_get_connection_passes_impersonated_credentials_to_every_client():
    with (
        patch(f"{CREDENTIALS_MODULE}.get_gcp_impersonate_credentials") as mock_impersonate,
        patch(f"{CONNECTION_MODULE}.Client") as mock_client,
        patch(f"{CONNECTION_MODULE}.MetricServiceClient") as mock_metrics,
    ):
        get_connection(_gcs_config({"impersonateServiceAccount": f" {TARGET_SA} ", "lifetime": 600}))

    mock_impersonate.assert_called_once_with(impersonate_service_account=TARGET_SA, lifetime=600)
    impersonated = mock_impersonate.return_value
    assert mock_client.call_args_list == [
        call(project="p1", credentials=impersonated),
        call(project="p2", credentials=impersonated),
    ]
    mock_metrics.assert_called_once_with(credentials=impersonated)


@pytest.mark.parametrize(
    "impersonate",
    [None, {"impersonateServiceAccount": "   "}, {"lifetime": 600}],
    ids=["not-configured", "blank-target", "no-target"],
)
def test_get_connection_without_target_keeps_base_identity(impersonate):
    with (
        patch(f"{CREDENTIALS_MODULE}.get_gcp_impersonate_credentials") as mock_impersonate,
        patch(f"{CONNECTION_MODULE}.Client") as mock_client,
        patch(f"{CONNECTION_MODULE}.MetricServiceClient") as mock_metrics,
    ):
        get_connection(_gcs_config(impersonate))

    mock_impersonate.assert_not_called()
    assert mock_client.call_args_list == [
        call(project="p1", credentials=None),
        call(project="p2", credentials=None),
    ]
    mock_metrics.assert_called_once_with(credentials=None)
