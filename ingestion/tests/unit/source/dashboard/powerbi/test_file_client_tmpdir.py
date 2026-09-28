#  Copyright 2026 Collate
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
Tests that the PowerBI file client handles a missing extract directory gracefully
so that 'Test Connection' can be pressed multiple times without failure (issue #33418).
"""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.services.connections.dashboard.powerbi.azureConfig import (
    AzureConfig,
)
from metadata.generated.schema.entity.services.connections.dashboard.powerbi.gcsConfig import (
    GCSConfig,
)
from metadata.generated.schema.entity.services.connections.dashboard.powerbi.s3Config import (
    S3Config,
)
from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    PowerBIConnection,
)
from metadata.ingestion.source.dashboard.powerbi.file_client import (
    PowerBiFileClient,
    get_pbit_files,
)


def _make_powerbi_connection(extract_dir: str) -> PowerBIConnection:
    return PowerBIConnection.model_validate(
        {
            "clientId": "client_id",
            "clientSecret": "client_secret",
            "tenantId": "tenant_id",
            "pbitFilesSource": {
                "pbitFileConfigType": "local",
                "pbitFilesExtractDir": extract_dir,
            },
        }
    )


class TestDeleteTmpFiles:
    def test_delete_tmp_files_no_error_when_dir_absent(self, tmp_path):
        extract_dir = str(tmp_path / "pbitFiles")
        conn = _make_powerbi_connection(extract_dir)
        file_client = PowerBiFileClient(conn)
        # Directory was never created — calling delete_tmp_files must not raise.
        file_client.delete_tmp_files()  # should not raise FileNotFoundError

    def test_delete_tmp_files_no_error_on_second_call(self, tmp_path):
        extract_dir = str(tmp_path / "pbitFiles")
        (tmp_path / "pbitFiles").mkdir()
        conn = _make_powerbi_connection(extract_dir)
        file_client = PowerBiFileClient(conn)

        file_client.delete_tmp_files()  # removes the dir
        file_client.delete_tmp_files()  # second call must not raise

    def test_delete_tmp_files_preserves_permission_error(self, tmp_path: Path):
        extract_dir = tmp_path / "pbitFiles"
        extract_dir.mkdir()
        file_client = PowerBiFileClient(_make_powerbi_connection(str(extract_dir)))

        with (
            patch("os.scandir", side_effect=PermissionError("denied")),
            pytest.raises(PermissionError),
        ):
            file_client.delete_tmp_files()

        assert extract_dir.exists()


class TestExtractDirRecreatedBeforeDownload:
    """After delete_tmp_files removes the extract dir, the next get_pbit_files
    invocation must recreate it so that file downloads succeed."""

    @patch("metadata.ingestion.source.dashboard.powerbi.file_client.get_reader")
    @patch("metadata.ingestion.source.dashboard.powerbi.file_client.AWSClient")
    def test_extract_dir_created_when_absent(self, mock_aws, _mock_get_reader, tmp_path):
        extract_dir = tmp_path / "pbitFiles"
        # Intentionally do not create extract_dir to simulate post-cleanup state.
        assert not extract_dir.exists()

        s3_config = MagicMock(spec=S3Config)
        s3_config.pbitFilesExtractDir = str(extract_dir)
        s3_config.prefixConfig = None
        s3_config.securityConfig = MagicMock()

        mock_s3_client = MagicMock()
        mock_s3_client.list_buckets.return_value = {"Buckets": [{"Name": "my-bucket"}]}
        mock_aws.return_value.get_client.return_value = mock_s3_client

        # No blobs → download_pbit_files is never called, but extract_dir must still exist
        # so that get_datamodel_schema_files_from_pbit can open it without error.
        with (
            patch(
                "metadata.ingestion.source.dashboard.powerbi.file_client.list_s3_objects",
                return_value=[],
            ),
            patch(
                "metadata.ingestion.source.dashboard.powerbi.file_client.get_datamodel_schema_files_from_pbit",
                return_value=None,
            ) as mock_schema,
        ):
            get_pbit_files(s3_config)
            mock_schema.assert_called_once_with(path=str(extract_dir))

        assert extract_dir.exists(), "extract_dir must be created by get_pbit_files before use"

    @patch("metadata.ingestion.source.dashboard.powerbi.file_client.AzureClient")
    def test_azure_extract_dir_created_when_absent(self, mock_azure: MagicMock, tmp_path: Path):
        extract_dir = tmp_path / "pbitFiles"
        azure_config = MagicMock(spec=AzureConfig)
        azure_config.pbitFilesExtractDir = str(extract_dir)
        azure_config.prefixConfig = None
        azure_config.securityConfig = MagicMock()
        mock_azure.return_value.create_blob_client.return_value.list_containers.return_value = []

        get_pbit_files(azure_config)

        assert extract_dir.is_dir()

    @patch("metadata.ingestion.source.dashboard.powerbi.file_client.set_google_credentials")
    @patch("google.cloud.storage.Client")
    def test_gcs_extract_dir_created_when_absent(
        self, mock_storage: MagicMock, _mock_credentials: MagicMock, tmp_path: Path
    ):
        extract_dir = tmp_path / "pbitFiles"
        gcs_config = MagicMock(spec=GCSConfig)
        gcs_config.pbitFilesExtractDir = str(extract_dir)
        gcs_config.prefixConfig = None
        gcs_config.securityConfig = MagicMock()
        mock_storage.return_value.list_buckets.return_value = []

        get_pbit_files(gcs_config)

        assert extract_dir.is_dir()
