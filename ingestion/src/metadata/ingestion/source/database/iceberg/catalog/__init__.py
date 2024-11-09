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
Iceberg Catalog Factory.
"""
from typing import Dict, Type

from pyiceberg.catalog import Catalog

from metadata.generated.schema.entity.services.connections.database.iceberg.dynamoDbCatalogConnection import (
    DynamoDbCatalogConnection,
)
from metadata.generated.schema.entity.services.connections.database.iceberg.glueCatalogConnection import (
    GlueCatalogConnection,
)
from metadata.generated.schema.entity.services.connections.database.iceberg.hiveCatalogConnection import (
    HiveCatalogConnection,
)
from metadata.generated.schema.entity.services.connections.database.iceberg.icebergCatalog import (
    IcebergCatalog,
)
from metadata.generated.schema.entity.services.connections.database.iceberg.restCatalogConnection import (
    RestCatalogConnection,
)
from metadata.ingestion.source.database.iceberg.catalog.base import IcebergCatalogBase
from metadata.ingestion.source.database.iceberg.catalog.dynamodb import (
    IcebergDynamoDbCatalog,
)
from metadata.ingestion.source.database.iceberg.catalog.glue import IcebergGlueCatalog
from metadata.ingestion.source.database.iceberg.catalog.hive import IcebergHiveCatalog
from metadata.ingestion.source.database.iceberg.catalog.rest import IcebergRestCatalog


class IcebergCatalogFactory:
    """Factory Class to get any PyIceberg implemented Catalog."""

    catalog_type_map: Dict[str, Type[IcebergCatalogBase]] = {
        RestCatalogConnection.__name__: IcebergRestCatalog,
        HiveCatalogConnection.__name__: IcebergHiveCatalog,
        GlueCatalogConnection.__name__: IcebergGlueCatalog,
        DynamoDbCatalogConnection.__name__: IcebergDynamoDbCatalog,
    }

    @classmethod
    def from_connection(cls, catalog: IcebergCatalog) -> Catalog:
        """Returns a PyIceberg Catalog from the given catalog configuration."""
        catalog_type = cls.catalog_type_map.get(
            catalog.connection.__class__.__name__, None
        )

        if not catalog_type:
            raise NotImplementedError(
                f"Iceberg Catalog of type ['{catalog.connection.__class__.__name__}'] Not Implemmented."
            )

        return catalog_type.get_catalog(catalog)
