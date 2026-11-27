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

import io
from asyncio import get_running_loop, run
from pathlib import Path
from threading import get_ident
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import fsspec
import pytest
from adlfs import AzureBlobFileSystem
from azure.core.credentials import AccessTokenInfo
from azure.core.pipeline.transport import AioHttpTransport, AsyncHttpResponse
from azure.identity import ClientSecretCredential
from azure.storage.blob import BlobClient
from requests.structures import CaseInsensitiveDict

from metadata.clients.azure_client import AzureClient
from metadata.generated.schema.entity.services.connections.database.datalake.azureConfig import (
    AzureConfig,
)
from metadata.generated.schema.security.credentials.azureCredentials import (
    AzureCredentials,
)
from metadata.ingestion.source.database.datalake.clients.azure_blob import (
    DatalakeAzureBlobClient,
)
from metadata.readers.dataframe.dsv import CSVDataFrameReader
from metadata.readers.dataframe.json import JSONDataFrameReader
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
        assert isinstance(opts["credential"].sync_credential, ClientSecretCredential)
        assert opts["credential"].sync_credential._authority == "https://login.microsoftonline.us"

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

        assert opts.keys() == {"credential"}
        assert opts["credential"].sync_credential is sentinel_cred
        mock_default_credential.assert_called_once_with()

        fs = AzureBlobFileSystem(account_name="miacct", **opts)
        assert fs.account_url == "https://miacct.blob.core.windows.net"
        assert fs.credential is opts["credential"]

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

        assert opts.keys() == {"credential", "account_host"}
        assert opts["credential"].sync_credential is sentinel_cred
        assert opts["account_host"] == "govmiacct.blob.core.usgovcloudapi.net"
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


class TestConnectionScopedAzureFilesystem:
    @pytest.mark.parametrize(
        ("owned", "executor_stopped"),
        [
            pytest.param(True, False, id="owned"),
            pytest.param(False, False, id="borrowed"),
            pytest.param(True, True, id="stopped-executor"),
        ],
    )
    def test_adlfs_credential_close_can_be_awaited(self, monkeypatch, owned, executor_stopped):
        config = AzureConfig(
            securityConfig=AzureCredentials(accountName="govacct", endpointSuffix="core.usgovcloudapi.net")
        )
        close_threads = []
        credential = SimpleNamespace(close=lambda: close_threads.append(get_ident()))
        monkeypatch.setattr(AzureClient, "create_client", lambda _client: credential)
        client = None if owned else SimpleNamespace(credential=credential)
        adapter = return_azure_storage_options(config, client)["credential"]

        async def close_as_adlfs_does():
            if executor_stopped:
                await get_running_loop().shutdown_default_executor()
            await adapter.close()

        loop_thread = get_ident()
        run(close_as_adlfs_does())
        if owned:
            [close_thread] = close_threads
            assert (close_thread == loop_thread) is executor_stopped
        else:
            assert close_threads == []

    @pytest.mark.parametrize(
        ("endpoint_suffix", "authority", "client_secret"),
        [
            ("core.usgovcloudapi.net", None, "gov-secret"),
            ("core.windows.net", "https://login.microsoftonline.us", "gov-secret"),
            ("core.usgovcloudapi.net", None, None),
        ],
        ids=["sovereign", "explicit-authority", "managed-identity"],
    )
    def test_blob_request_fetches_token_off_fsspec_event_loop(
        self, monkeypatch, endpoint_suffix, authority, client_secret
    ):
        config = AzureConfig(
            securityConfig=AzureCredentials(
                accountName="govacct",
                clientId="gov-client",
                clientSecret=client_secret,
                tenantId=VALID_TENANT_ID,
                endpointSuffix=endpoint_suffix,
                authority=authority,
            )
        )
        connection = DatalakeAzureBlobClient.from_config(config)
        token_threads = []
        storage_threads = []

        def get_token_info(_credential, *_scopes, **_options):
            token_threads.append(get_ident())
            return AccessTokenInfo("test-token", 4_000_000_000)

        class BlobPropertiesResponse(AsyncHttpResponse):
            def body(self) -> bytes:
                return b""

        async def send(_transport, request, **_kwargs):
            storage_threads.append(get_ident())
            assert request.url == f"https://govacct.blob.{endpoint_suffix}/raw-zone/sales.json"
            assert request.headers["Authorization"] == "Bearer test-token"
            response = BlobPropertiesResponse(request, None)
            response.status_code = 200
            response.headers = CaseInsensitiveDict(
                {
                    "content-length": "10",
                    "last-modified": "Thu, 19 Nov 2026 00:00:00 GMT",
                    "x-ms-blob-type": "BlockBlob",
                }
            )
            return response

        monkeypatch.setattr(type(connection.client.credential), "get_token_info", get_token_info)
        monkeypatch.setattr(AioHttpTransport, "send", send)
        try:
            options = return_azure_storage_options(config, connection.client)
            filesystem = AzureBlobFileSystem(account_name="govacct", **options)
            assert filesystem.info("raw-zone/sales.json")["size"] == 10
            assert len(token_threads) == len(storage_threads) == 1
            assert token_threads[0] != storage_threads[0]
        finally:
            connection.close(service_connection=None)

    @pytest.mark.parametrize(
        ("reader_class", "key", "payload"),
        [
            (JSONDataFrameReader, "sales.json", b'[{"id": 1}]'),
            (CSVDataFrameReader, "sales.csv", b"id\n1\n"),
        ],
        ids=["adlfs-direct", "pandas-storage-options"],
    )
    def test_repeated_reads_share_one_filesystem_released_on_close(self, reader_class, key: str, payload: bytes):
        config = AzureConfig(
            securityConfig=AzureCredentials(
                accountName="govacct",
                clientId="gov-client",
                clientSecret="gov-secret",
                tenantId=VALID_TENANT_ID,
                endpointSuffix="core.usgovcloudapi.net",
            )
        )
        connection = DatalakeAzureBlobClient.from_config(config)
        credential = connection.client.credential

        def connection_filesystems() -> list[AzureBlobFileSystem]:
            return [
                fs
                for fs in AzureBlobFileSystem._cache.values()
                if getattr(fs.credential, "sync_credential", None) is credential
            ]

        with (
            patch.object(AzureBlobFileSystem, "open", lambda *_, **__: io.BytesIO(payload)),
            patch.object(BlobClient, "get_blob_properties", return_value=SimpleNamespace(size=len(payload))),
        ):
            for _ in range(50):
                wrapper = reader_class(config_source=config, client=connection.client).read(
                    key=key, bucket_name="raw-zone"
                )
                assert next(iter(wrapper.dataframes()))["id"].tolist() == [1]

        [filesystem] = connection_filesystems()

        with (
            patch.object(credential, "close", wraps=credential.close) as close_credential,
            patch.object(filesystem.service_client, "close", wraps=filesystem.service_client.close) as close_filesystem,
        ):
            connection.close(service_connection=None)

        assert connection_filesystems() == []
        close_credential.assert_called_once_with()
        close_filesystem.assert_awaited_once_with()

    def test_blob_client_close_error_does_not_skip_reader_cleanup(self):
        config = AzureConfig(
            securityConfig=AzureCredentials(accountName="govacct", endpointSuffix="core.usgovcloudapi.net")
        )
        connection = DatalakeAzureBlobClient.from_config(config)
        options = return_azure_storage_options(config, connection.client)
        filesystem = AzureBlobFileSystem(account_name="govacct", **options)
        credential = connection.client.credential

        with (
            patch.object(connection.client, "close", side_effect=RuntimeError("Blob shutdown failed")),
            patch.object(credential, "close", wraps=credential.close) as close_credential,
            pytest.raises(RuntimeError, match="Blob shutdown failed"),
        ):
            connection.close(service_connection=None)

        assert filesystem not in AzureBlobFileSystem._cache.values()
        close_credential.assert_called_once_with()
