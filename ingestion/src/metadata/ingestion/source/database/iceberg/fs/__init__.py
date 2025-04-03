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
Iceberg FileSystem Factory module.
"""
from __future__ import annotations

from typing import Dict, Optional, Type

from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.generated.schema.security.credentials.azureCredentials import (
    AzureCredentials,
)
from metadata.ingestion.source.database.iceberg.fs.azure import AzureFileSystem
from metadata.ingestion.source.database.iceberg.fs.base import (
    FileSystemConfig,
    IcebergFileSystemBase,
)
from metadata.ingestion.source.database.iceberg.fs.s3 import S3FileSystem


class IcebergFileSystemFactory:
    """Factory class to return any supported PyIceberg FileSystem."""

    file_system_config_map: Dict[str, Type[IcebergFileSystemBase]] = {
        AWSCredentials.__name__: S3FileSystem,
        AzureCredentials.__name__: AzureFileSystem,
    }

    @classmethod
    def parse(cls, fs_config: Optional[FileSystemConfig]) -> dict:
        """Returns the Iceberg FileSystem parameters, depending on specific implementation."""
        if not fs_config:
            return {}

        file_system_type = cls.file_system_config_map.get(fs_config.__class__.__name__)

        if not file_system_type:
            raise NotImplementedError(
                f"Iceberg File System type ['{fs_config.__class__.__name__}'] Not Implemented."
            )

        return file_system_type.get_fs_params(fs_config)
