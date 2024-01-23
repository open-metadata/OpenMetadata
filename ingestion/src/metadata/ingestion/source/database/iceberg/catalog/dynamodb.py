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
Iceberg DynamoDB Catalog
"""
from pyiceberg.catalog import Catalog, load_dynamodb

from metadata.generated.schema.entity.services.connections.database.icebergConnection import (
        Catalog as IcebergCatalog,
        DynamoDbCatalogConnection,
)
from metadata.ingestion.source.database.iceberg.catalog.base import IcebergCatalogBase

class IcebergDynamoDbCatalog(IcebergCatalogBase):
    @classmethod
    def get_catalog(cls, catalog: IcebergCatalog) -> Catalog:
        """ Returns a DynamoDB Catalog for the given connection and file storage.

        For more information, check the PyIceberg [docs](https://py.iceberg.apache.org/configuration/#dynamodb-catalog)
        """
        if not isinstance(catalog.type, DynamoDbCatalogConnection):
            raise RuntimeError("'connection' is not an instance of 'DynamoDbCatalogConnection'")

        parameters = {
            **cls.get_fs_parameters(catalog.fileSystem),
            "warehouse": catalog.warehouseLocation
        }

        if catalog.type.tableName:
            parameters = {
                "table-name": catalog.type.tableName
            }

        if catalog.type.awsConfig:
            parameters = {
                **parameters,
                "aws_secret_key_id": catalog.type.awsConfig.awsAccessKeyId,
                "aws_secret_access_key": catalog.type.awsConfig.awsSecretAccessKey,
                "aws_session_token": catalog.type.awsConfig.awsSessionToken,
                "region_name": catalog.type.awsConfig.awsRegion,
                "profile_name": catalog.type.awsConfig.profileName,
            }

        return load_dynamodb(catalog.name, parameters)
