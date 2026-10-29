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

The end-to-end behaviour is exercised by tests/unit/topology/database/test_bigtable.py.
"""

from unittest.mock import call, patch

from metadata.generated.schema.entity.services.connections.database.bigTableConnection import (
    BigTableConnection as BigTableConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.bigtable.connection import BigTableConnection

CONNECTION_MODULE = "metadata.ingestion.source.database.bigtable.connection"
CREDENTIALS_MODULE = "metadata.utils.credentials"
TARGET_SA = "target@my-project.iam.gserviceaccount.com"


def _bigtable_config(impersonate=None) -> BigTableConnectionConfig:
    credentials = {"gcpConfig": {"type": "service_account", "projectId": ["p1", "p2"]}}
    if impersonate is not None:
        credentials["gcpImpersonateServiceAccount"] = impersonate
    return BigTableConnectionConfig.model_validate({"credentials": credentials})


def test_bigtable_connection_is_base_connection():
    assert issubclass(BigTableConnection, BaseConnection)


def test_get_client_passes_impersonated_credentials_to_every_project_client():
    with (
        patch(f"{CREDENTIALS_MODULE}.get_gcp_impersonate_credentials") as mock_impersonate,
        patch(f"{CONNECTION_MODULE}.Client") as mock_client,
    ):
        BigTableConnection(_bigtable_config({"impersonateServiceAccount": TARGET_SA}))._get_client()

    mock_impersonate.assert_called_once_with(impersonate_service_account=TARGET_SA, lifetime=3600)
    impersonated = mock_impersonate.return_value
    assert mock_client.call_args_list == [
        call(project="p1", admin=True, credentials=impersonated),
        call(project="p2", admin=True, credentials=impersonated),
    ]


def test_get_client_without_impersonation_keeps_base_identity():
    with (
        patch(f"{CREDENTIALS_MODULE}.get_gcp_impersonate_credentials") as mock_impersonate,
        patch(f"{CONNECTION_MODULE}.Client") as mock_client,
    ):
        BigTableConnection(_bigtable_config())._get_client()

    mock_impersonate.assert_not_called()
    assert mock_client.call_args_list == [
        call(project="p1", admin=True, credentials=None),
        call(project="p2", admin=True, credentials=None),
    ]
