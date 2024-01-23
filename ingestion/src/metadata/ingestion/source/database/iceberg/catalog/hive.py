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

from metadata.generated.schema.entity.services.connections.database.icebergConnection import (
    Catalog as IcebergCatalog,
    HiveCatalogConnection,
)
from metadata.ingestion.source.database.iceberg.catalog.base import IcebergCatalogBase

class IcebergHiveCatalog(IcebergCatalogBase):
    @classmethod
    def get_catalog(cls, catalog: IcebergCatalog) -> Catalog:
        """ Returns a Hive Catalog for the given connection and file storage.

        For more information, check the PyIceberg [docs](https://py.iceberg.apache.org/configuration/#hive-catalog)
        """
        if not isinstance(catalog.type, HiveCatalogConnection):
            raise RuntimeError("'connection' is not an instance of 'HiveCatalogConnection'")

        parameters = {
            **cls.get_fs_parameters(catalog.fileSystem),
            "warehouse": catalog.warehouseLocation,
            "uri": catalog.type.uri,
        }

        return load_hive(catalog.name, parameters)
