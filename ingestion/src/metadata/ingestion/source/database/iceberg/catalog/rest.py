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
Iceberg Rest Catalog
"""
from pyiceberg.catalog import Catalog, load_rest

from metadata.generated.schema.entity.services.connections.database.icebergConnection import (
    Catalog as IcebergCatalog,
    RestCatalogConnection,
)
from metadata.ingestion.source.database.iceberg.catalog.base import IcebergCatalogBase

class IcebergRestCatalog(IcebergCatalogBase):
    @classmethod
    def get_catalog(cls, catalog: IcebergCatalog) -> Catalog:
        """ Returns a Rest Catalog for the given connection and file storage.

        For more information, check the PyIceberg [docs](https://py.iceberg.apache.org/configuration/#rest-catalog)
        """
        if not isinstance(catalog.type, RestCatalogConnection):
            raise RuntimeError("'connection' is not an instance of 'RestCatalogConnection'")

        parameters = {
            **cls.get_fs_parameters(catalog.fileSystem),
            "warehouse": catalog.warehouseLocation,
            "uri": catalog.type.uri,
            "credential": catalog.type.credential,
            "token": catalog.type.token,
        }

        if catalog.type.ssl:
            parameters = {
                **parameters,
                "ssl": {
                    "client": {
                        "cert": catalog.type.ssl.clientCertPath,
                        "key": catalog.type.ssl.privateKeyPath
                    },
                    "cabundle": catalog.type.ssl.caCertPath
                }
            }

        if catalog.type.sigv4:
            parameters = {
                **parameters,
                "rest.sigv4": True,
                "rest.signing_region": catalog.type.sigv4.signingRegion,
                "rest.signing_name": catalog.type.sigv4.signingName
            }
        return load_rest(catalog.name, parameters)
