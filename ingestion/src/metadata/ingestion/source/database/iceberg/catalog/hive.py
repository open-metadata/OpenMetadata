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
Iceberg Hive Catalog
"""
from pyiceberg.catalog import Catalog, load_hive

from metadata.generated.schema.entity.services.connections.database.iceberg.hiveCatalogConnection import (
    HiveCatalogConnection,
)
from metadata.generated.schema.entity.services.connections.database.iceberg.icebergCatalog import (
    IcebergCatalog,
)
from metadata.ingestion.source.database.iceberg.catalog.base import IcebergCatalogBase


class IcebergHiveCatalog(IcebergCatalogBase):
    """Responsible for building a PyIceberg Hive Catalog."""

    @classmethod
    def get_catalog(cls, catalog: IcebergCatalog) -> Catalog:
        """Returns a Hive Catalog for the given connection and file storage.

        For more information, check the PyIceberg [docs](https://py.iceberg.apache.org/configuration/#hive-catalog)
        """
        if not isinstance(catalog.connection, HiveCatalogConnection):
            raise RuntimeError(
                "'connection' is not an instance of 'HiveCatalogConnection'"
            )

        parameters = {
            "warehouse": catalog.warehouseLocation,
            "uri": str(catalog.connection.uri),
        }

        if catalog.connection.fileSystem:
            parameters = {
                **parameters,
                **cls.get_fs_parameters(catalog.connection.fileSystem.type),
            }

        return load_hive(catalog.name, parameters)
