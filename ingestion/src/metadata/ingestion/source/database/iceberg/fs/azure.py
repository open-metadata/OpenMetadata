#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Iceberg S3 File System.
"""
from __future__ import annotations

from metadata.generated.schema.security.credentials.azureCredentials import (
    AzureCredentials,
)
from metadata.ingestion.source.database.iceberg.fs.base import (
    FileSystemConfig,
    IcebergFileSystemBase,
)


class AzureFileSystem(IcebergFileSystemBase):
    @classmethod
    def get_fs_params(cls, fs_config: FileSystemConfig) -> dict:
        """Returns the parameters expected by PyIceberg for Azure Data Lake.

        For more information, check the
            [PyIceberg documentation](https://py.iceberg.apache.org/configuration/#azure-data-lake).
        """
        if not isinstance(fs_config, AzureCredentials):
            raise RuntimeError(
                "FileSystem Configuration is not an instance of 'AzureCredentials'."
            )

        return {
            "adlfs.account-name": fs_config.accountName,
            "adlfs.tenant-id": fs_config.tenantId,
            "adlfs.client-id": fs_config.clientId,
            "adlfs.client-secret": fs_config.clientSecret.get_secret_value(),
        }
