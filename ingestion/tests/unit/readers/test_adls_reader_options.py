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
"""
Unit tests for ADLS reader path builder, storage options, and ADLSReader methods.
"""

from pathlib import Path
from unittest.mock import MagicMock, patch

import fsspec
import pytest
from adlfs import AzureBlobFileSystem
from azure.identity import ClientSecretCredential

from metadata.generated.schema.entity.services.connections.database.datalake.azureConfig import (
    AzureConfig,
)
from metadata.generated.schema.security.credentials.azureCredentials import (
    AzureCredentials,
)
from metadata.readers.file.adls import (
    AZURE_PATH,
    ADLSReader,
    build_azure_abfs_path,
    ensure_azure_pandas_storage_options,
    return_azure_storage_options,
)
from metadata.readers.file.base import ReadException

VALID_TENANT_ID = "11111111-2222-3333-4444-555555555555"


class TestADLSPathAndStorageOptions:
    def test_backwards_compatible_azure_path_constant(self):
        assert AZURE_PATH == "abfs://{bucket_name}@{account_name}.dfs.core.windows.net/{key}"

    @pytest.mark.parametrize(
        ("endpoint_suffix", "expected_url"),
        [
            (None, "abfs://raw-zone@myacct.dfs.core.windows.net/sales/2026.parquet"),
            (
                "core.windows.net",
                "abfs://raw-zone@myacct.dfs.core.windows.net/sales/2026.parquet",
            ),
            (
                "core.usgovcloudapi.net",
                "abfs://raw-zone@myacct.dfs.core.usgovcloudapi.net/sales/2026.parquet",
            ),
            (
                " .core.chinacloudapi.cn ",
                "abfs://raw-zone@myacct.dfs.core.chinacloudapi.cn/sales/2026.parquet",
            ),
            (
                "core.customcloud.local",
                "abfs://raw-zone@myacct.dfs.core.customcloud.local/sales/2026.parquet",
            ),
        ],
    )
    def test_build_azure_abfs_path(self, endpoint_suffix: str | None, expected_url: str):
        assert (
            build_azure_abfs_path(
                bucket_name="raw-zone",
                account_name="myacct",
                key="sales/2026.parquet",
                endpoint_suffix=endpoint_suffix,
            )
            == expected_url
        )

    @pytest.mark.parametrize(
        "system_container",
        ["$web", "$logs", "$root", "$blobchangefeed"],
    )
    def test_build_azure_abfs_path_accepts_azure_system_containers(self, system_container: str):
        commercial_url = build_azure_abfs_path(
            bucket_name=system_container,
            account_name="commacct",
            key="index.json",
        )
        gov_url = build_azure_abfs_path(
            bucket_name=system_container,
            account_name="govacct",
            key="index.json",
            endpoint_suffix="core.usgovcloudapi.net",
        )
        assert commercial_url == f"abfs://{system_container}@commacct.dfs.core.windows.net/index.json"
        assert gov_url == f"abfs://{system_container}@govacct.dfs.core.usgovcloudapi.net/index.json"

    @pytest.mark.parametrize(
        "malicious_container",
        ["$web@evil", "$bad/path", "$bad?sas=1", "$bad#frag", "$bad.dot", "$WEB", "$"],
    )
    def test_build_azure_abfs_path_rejects_malicious_dollar_containers(self, malicious_container: str):
        with pytest.raises(ValueError):
            build_azure_abfs_path(
                bucket_name=malicious_container,
                account_name="govacct",
                key="index.json",
                endpoint_suffix="core.usgovcloudapi.net",
            )

    def test_return_azure_storage_options_commercial_service_principal(self):
        config = AzureConfig(
            securityConfig=AzureCredentials(
                accountName="commacct",
                clientId="comm-client",
                clientSecret="comm-secret",
                tenantId=VALID_TENANT_ID,
            )
        )
        opts = return_azure_storage_options(config)

        assert opts == {
            "tenant_id": VALID_TENANT_ID,
            "client_id": "comm-client",
            "client_secret": "comm-secret",
        }
        assert "account_name" not in opts
        assert "account_host" not in opts

    def test_return_azure_storage_options_us_gov_accepted_by_real_adlfs_and_fsspec(
        self,
    ):
        config = AzureConfig(
            securityConfig=AzureCredentials(
                accountName="govacct",
                clientId="gov-client",
                clientSecret="gov-secret",
                tenantId=VALID_TENANT_ID,
                endpointSuffix="core.usgovcloudapi.net",
            )
        )
        opts = return_azure_storage_options(config)

        assert "account_name" not in opts
        assert opts["account_host"] == "govacct.blob.core.usgovcloudapi.net"
        assert isinstance(opts["credential"], ClientSecretCredential)
        assert opts["credential"]._authority == "https://login.microsoftonline.us"

        # Real adlfs.AzureBlobFileSystem direct call (used in parquet/json/avro/mf4 readers)
        fs = AzureBlobFileSystem(account_name="govacct", **opts)
        assert fs.account_url == "https://govacct.blob.core.usgovcloudapi.net"
        assert fs.service_client.url == "https://govacct.blob.core.usgovcloudapi.net/"

        # Real fsspec.open call (used by pandas read_parquet / read_csv on abfs:// URLs)
        abfs_url = build_azure_abfs_path(
            bucket_name="gov-container",
            account_name="govacct",
            key="folder/data.csv",
            endpoint_suffix="core.usgovcloudapi.net",
        )
        pandas_opts = ensure_azure_pandas_storage_options(opts, "govacct")
        open_file = fsspec.open(abfs_url, "rb", **pandas_opts)
        assert open_file.fs.account_url == "https://govacct.blob.core.usgovcloudapi.net"
        assert open_file.path == "gov-container/folder/data.csv"

    @patch("azure.identity.DefaultAzureCredential")
    def test_return_azure_storage_options_default_credential_when_client_secret_none(self, mock_default_credential):
        sentinel_cred = MagicMock(name="DefaultAzureCredentialInstance")
        mock_default_credential.return_value = sentinel_cred

        config = AzureConfig(
            securityConfig=AzureCredentials(
                accountName="miacct",
                clientId="optional-managed-id-client",
                clientSecret=None,
            )
        )
        opts = return_azure_storage_options(config)

        assert opts == {"credential": sentinel_cred}
        mock_default_credential.assert_called_once_with()

        fs = AzureBlobFileSystem(account_name="miacct", **opts)
        assert fs.account_url == "https://miacct.blob.core.windows.net"
        assert fs.credential is sentinel_cred

    @patch("azure.identity.DefaultAzureCredential")
    def test_return_azure_storage_options_us_gov_default_credential(self, mock_default_credential):
        sentinel_cred = MagicMock(name="GovDefaultCredential")
        mock_default_credential.return_value = sentinel_cred

        config = AzureConfig(
            securityConfig=AzureCredentials(
                accountName="govmiacct",
                endpointSuffix="core.usgovcloudapi.net",
            )
        )
        opts = return_azure_storage_options(config)

        assert opts == {
            "credential": sentinel_cred,
            "account_host": "govmiacct.blob.core.usgovcloudapi.net",
        }
        mock_default_credential.assert_called_once_with(authority="https://login.microsoftonline.us")

    @pytest.mark.parametrize(
        ("endpoint_suffix", "authority", "account_name"),
        [
            ("core.windows.net", None, None),
            ("core.windows.net", None, "   "),
            ("core.windows.net", None, "bad/acct"),
            ("evil.com/path", None, "validacct"),
            ("169.254.169.254", None, "validacct"),
            ("core.windows.net", "http://login.microsoftonline.us", "validacct"),
            ("core.windows.net", "https://169.254.169.254", "validacct"),
            ("core.usgovcloudapi.net", None, "bad/acct"),
            ("core.usgovcloudapi.net", None, None),
        ],
    )
    def test_return_azure_storage_options_rejects_invalid_inputs(
        self,
        endpoint_suffix: str,
        authority: str | None,
        account_name: str | None,
    ):
        config = AzureConfig(
            securityConfig=AzureCredentials(
                accountName=account_name,
                clientId="cid",
                clientSecret="sec",
                tenantId=VALID_TENANT_ID,
                endpointSuffix=endpoint_suffix,
                authority=authority,
            )
        )
        with pytest.raises(ValueError):
            return_azure_storage_options(config)

    def test_return_azure_storage_options_missing_security_config_raises(self):
        with pytest.raises(ValueError, match="Azure securityConfig is required"):
            return_azure_storage_options(AzureConfig(securityConfig=None))


class TestADLSFileReader:
    def test_read_and_download_and_error_handling(self, tmp_path: Path):
        mock_blob_service = MagicMock()
        mock_container = MagicMock()
        mock_blob = MagicMock()
        mock_blob.download_blob.return_value.readall.return_value = b"col1,col2\n1,2\n"
        mock_container.get_blob_client.return_value = mock_blob
        mock_blob_service.get_container_client.return_value = mock_container

        reader = ADLSReader(mock_blob_service)
        payload = reader.read("folder/test.csv", bucket_name="my-container")
        assert payload == b"col1,col2\n1,2\n"

        dest = tmp_path / "downloaded.csv"
        reader.download("folder/test.csv", str(dest), bucket_name="my-container")
        assert dest.read_bytes() == b"col1,col2\n1,2\n"

        with pytest.raises(NotImplementedError):
            reader._get_tree()

        mock_blob.download_blob.side_effect = RuntimeError("boom")
        with pytest.raises(ReadException, match="Error fetching file"):
            reader.read("folder/test.csv", bucket_name="my-container", verbose=False)
        with pytest.raises(ReadException, match="Error downloading file"):
            reader.download("folder/test.csv", str(dest), bucket_name="my-container", verbose=False)
