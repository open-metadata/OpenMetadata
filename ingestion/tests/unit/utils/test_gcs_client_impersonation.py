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
"""Every place that builds a GCS storage client from user GCP credentials must honour
gcpImpersonateServiceAccount, otherwise it silently runs as the base service account."""

import contextlib
from unittest.mock import patch

import pytest
from google.auth.credentials import AnonymousCredentials
from google.auth.impersonated_credentials import Credentials as ImpersonatedCredentials

from metadata.generated.schema.entity.services.connections.dashboard.powerbi.gcsConfig import (
    GCSConfig as PowerBIGCSConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalake.gcsConfig import (
    GCSConfig as DatalakeGCSConfig,
)
from metadata.generated.schema.metadataIngestion.dbtconfig.dbtGCSConfig import DbtGcsConfig
from metadata.generated.schema.metadataIngestion.storage.storageMetadataGCSConfig import (
    StorageMetadataGcsConfig,
)
from metadata.ingestion.source.dashboard.powerbi.file_client import get_pbit_files
from metadata.ingestion.source.database.datalake.clients.gcs import DatalakeGcsClient
from metadata.ingestion.source.database.dbt.dbt_config import get_dbt_details
from metadata.utils.storage_metadata_config import get_manifest

TARGET_SA = "target@my-project.iam.gserviceaccount.com"


def _security_config(impersonate: bool) -> dict:
    config = {"gcpConfig": {"type": "service_account", "projectId": "p1"}}
    if impersonate:
        config["gcpImpersonateServiceAccount"] = {"impersonateServiceAccount": TARGET_SA}
    return config


def _datalake(security, _):
    DatalakeGcsClient.get_gcs_client(DatalakeGCSConfig.model_validate({"securityConfig": security}))


def _storage_manifest(security, _):
    get_manifest(
        StorageMetadataGcsConfig.model_validate(
            {"securityConfig": security, "prefixConfig": {"containerName": "bucket"}}
        )
    )


def _dbt(security, _):
    list(
        get_dbt_details(
            DbtGcsConfig.model_validate(
                {
                    "dbtConfigType": "gcs",
                    "dbtSecurityConfig": security,
                    "dbtPrefixConfig": {"dbtBucketName": "bucket"},
                }
            )
        )
    )


def _powerbi(security, tmp_path):
    get_pbit_files(
        PowerBIGCSConfig.model_validate(
            {"pbitFileConfigType": "gcs", "securityConfig": security, "pbitFilesExtractDir": str(tmp_path)}
        )
    )


@pytest.fixture
def storage_client():
    """Patch the GCP boundary: ADC (the base identity) and the storage client itself."""
    with (
        patch("google.auth.default", return_value=(AnonymousCredentials(), "p1")),
        patch("google.cloud.storage.Client") as mock_client,
    ):
        mock_client.return_value.list_buckets.return_value = []
        yield mock_client


@pytest.mark.parametrize("build", [_datalake, _storage_manifest, _dbt, _powerbi])
def test_storage_client_impersonates_target(build, storage_client, tmp_path):
    # Only the credentials handed to the client matter here; whatever the caller does with
    # the mocked client afterwards is out of scope.
    with contextlib.suppress(Exception):
        build(_security_config(impersonate=True), tmp_path)

    credentials = storage_client.call_args.kwargs["credentials"]
    assert isinstance(credentials, ImpersonatedCredentials)
    assert credentials.service_account_email == TARGET_SA


@pytest.mark.parametrize("build", [_datalake, _storage_manifest, _dbt, _powerbi])
def test_storage_client_keeps_base_identity_without_target(build, storage_client, tmp_path):
    with contextlib.suppress(Exception):
        build(_security_config(impersonate=False), tmp_path)

    assert storage_client.call_args.kwargs["credentials"] is None
