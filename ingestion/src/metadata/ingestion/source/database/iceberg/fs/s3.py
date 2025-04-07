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
Iceberg S3 File System.
"""
from __future__ import annotations

from pyiceberg.io import (
    S3_ACCESS_KEY_ID,
    S3_ENDPOINT,
    S3_REGION,
    S3_SECRET_ACCESS_KEY,
    S3_SESSION_TOKEN,
)

from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.ingestion.source.database.iceberg.fs.base import (
    FileSystemConfig,
    IcebergFileSystemBase,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

SUPPORTED_KEYS = [
    "endPointURL",
    "awsAccessKeyId",
    "awsSecretAccessKey",
    "awsSessionToken",
    "awsRegion",
]


class S3FileSystem(IcebergFileSystemBase):
    """Responsible for returning a PyIceberg S3FileSystem compatible configuration."""

    @classmethod
    def get_fs_params(cls, fs_config: FileSystemConfig) -> dict:
        """Returns the parameters expected by PyIceberg for AWS S3.

        For more information, check the [PyIceberg documentation](https://py.iceberg.apache.org/configuration/#s3).
        """
        if not isinstance(fs_config, AWSCredentials):
            raise RuntimeError(
                "FileSystem Configuration is not an instance of 'AWSCredentials'."
            )

        unused_keys = []

        for key, value in fs_config.model_dump().items():
            if key not in SUPPORTED_KEYS and value:
                unused_keys.append(key)

        if unused_keys:
            logger.warning(
                "[%s] Not Supported by the Iceberg Connector. They won't be used.",
                ",".join(unused_keys),
            )

        return {
            S3_ENDPOINT: str(fs_config.endPointURL),
            S3_ACCESS_KEY_ID: fs_config.awsAccessKeyId,
            S3_SECRET_ACCESS_KEY: fs_config.awsSecretAccessKey.get_secret_value()
            if fs_config.awsSecretAccessKey
            else None,
            S3_SESSION_TOKEN: fs_config.awsSessionToken,
            S3_REGION: fs_config.awsRegion,
        }
