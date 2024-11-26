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

from metadata.generated.schema.entity.services.connections.database.iceberg.icebergCatalog import (
    IcebergCatalog,
)
from metadata.generated.schema.entity.services.connections.database.iceberg.restCatalogConnection import (
    RestCatalogConnection,
)
from metadata.ingestion.source.database.iceberg.catalog.base import IcebergCatalogBase


class IcebergRestCatalog(IcebergCatalogBase):
    """Responsible for building a PyIceberg Rest Catalog."""

    @classmethod
    def get_catalog(cls, catalog: IcebergCatalog) -> Catalog:
        """Returns a Rest Catalog for the given connection and file storage.

        For more information, check the PyIceberg [docs](https://py.iceberg.apache.org/configuration/#rest-catalog)
        """
        if not isinstance(catalog.connection, RestCatalogConnection):
            raise RuntimeError(
                "'connection' is not an instance of 'RestCatalogConnection'"
            )

        if catalog.connection.credential and catalog.connection.credential.clientSecret:
            client_id = catalog.connection.credential.clientId.get_secret_value()
            client_secret = (
                catalog.connection.credential.clientSecret.get_secret_value()
            )

            credential = f"{client_id}:{client_secret}"
        else:
            credential = None

        parameters = {
            "warehouse": catalog.warehouseLocation,
            "uri": str(catalog.connection.uri),
            "credential": credential,
            "token": catalog.connection.token.get_secret_value()
            if catalog.connection.token
            else None,
        }

        if catalog.connection.fileSystem:
            parameters = {
                **parameters,
                **cls.get_fs_parameters(catalog.connection.fileSystem.type),
            }

        if catalog.connection.ssl:
            parameters = {
                **parameters,
                "ssl": {
                    "client": {
                        "cert": catalog.connection.ssl.clientCertPath,
                        "key": catalog.connection.ssl.privateKeyPath,
                    },
                    "cabundle": catalog.connection.ssl.caCertPath,
                },
            }

        if catalog.connection.sigv4:
            parameters = {
                **parameters,
                "rest.sigv4": True,
                "rest.signing_region": catalog.connection.sigv4.signingRegion,
                "rest.signing_name": catalog.connection.sigv4.signingName,
            }
        return load_rest(catalog.name, parameters)
