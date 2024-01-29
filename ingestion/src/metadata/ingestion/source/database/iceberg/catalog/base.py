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
Iceberg Catalog base module.
"""
from abc import ABC, abstractmethod
from typing import Optional

from pyiceberg.catalog import Catalog

from metadata.generated.schema.entity.services.connections.database.iceberg.icebergCatalog import (
    IcebergCatalog,
)
from metadata.ingestion.source.database.iceberg.fs import (
    FileSystemConfig,
    IcebergFileSystemFactory,
)


class IcebergCatalogBase(ABC):
    @classmethod
    @abstractmethod
    def get_catalog(cls, catalog: IcebergCatalog) -> Catalog:
        """Returns a Catalog for given catalog configuration."""

    @staticmethod
    def get_fs_parameters(fs_config: Optional[FileSystemConfig]) -> dict:
        """Gets the FileSystem parameters based on passed configuration."""
        if not fs_config:
            return {}
        return IcebergFileSystemFactory.parse(fs_config)
