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
"""StorageServiceSource owns a single BaseConnection and reuses it for the
test-connection step."""

from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.source.storage.s3.metadata import S3Source

S3_CONFIG = {
    "type": "s3",
    "serviceName": "s3_test",
    "serviceConnection": {"config": {"type": "S3", "awsConfig": {"awsRegion": "us-east-1"}}},
    "sourceConfig": {"config": {"type": "StorageMetadata"}},
}


def test_owned_connection_closed_when_test_connection_fails():
    with patch("metadata.ingestion.source.storage.storage_service.create_connection") as mock_create_connection:
        owned_connection = mock_create_connection.return_value
        with (
            patch(
                "metadata.ingestion.source.storage.storage_service.run_test_connection",
                side_effect=RuntimeError("cannot connect"),
            ),
            pytest.raises(RuntimeError),
        ):
            S3Source.create(S3_CONFIG, MagicMock())

        owned_connection.close.assert_called_once()
