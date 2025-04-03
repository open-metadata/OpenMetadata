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
Iceberg FileSystem base module.
"""
from abc import ABC, abstractmethod
from typing import Union

from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.generated.schema.security.credentials.azureCredentials import (
    AzureCredentials,
)

FileSystemConfig = Union[AWSCredentials, AzureCredentials, None]


class IcebergFileSystemBase(ABC):
    @classmethod
    @abstractmethod
    def get_fs_params(cls, fs_config: FileSystemConfig) -> dict:
        """Returns a Catalog for given catalog_config."""
