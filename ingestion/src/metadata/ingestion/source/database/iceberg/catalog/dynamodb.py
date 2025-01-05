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
import boto3
from pyiceberg.catalog import Catalog
from pyiceberg.catalog.dynamodb import DynamoDbCatalog

from metadata.generated.schema.entity.services.connections.database.iceberg.dynamoDbCatalogConnection import (
    DynamoDbCatalogConnection,
)
from metadata.generated.schema.entity.services.connections.database.iceberg.icebergCatalog import (
    IcebergCatalog,
)
from metadata.ingestion.source.database.iceberg.catalog.base import IcebergCatalogBase


class IcebergDynamoDbCatalog(IcebergCatalogBase):
    """Responsible for building a PyIceberg DynamoDB Catalog."""

    @classmethod
    def get_catalog(cls, catalog: IcebergCatalog) -> Catalog:
        """Returns a DynamoDB Catalog for the given connection and file storage.

        For more information, check the PyIceberg [docs](https://py.iceberg.apache.org/configuration/#dynamodb-catalog)
        """
        if not isinstance(catalog.connection, DynamoDbCatalogConnection):
            raise RuntimeError(
                "'connection' is not an instance of 'DynamoDbCatalogConnection'"
            )

        parameters = {"warehouse": catalog.warehouseLocation}

        if catalog.connection.tableName:
            parameters = {"table-name": catalog.connection.tableName}

        if catalog.connection.awsConfig:
            aws_config = catalog.connection.awsConfig

            parameters = {
                **parameters,
                "dynamodb.access-key-id": aws_config.awsAccessKeyId,
                "dynamodb.secret-access-key": aws_config.awsSecretAccessKey
                if aws_config.awsSecretAccessKey
                else None,
                "dynamodb.session-token": aws_config.awsSessionToken,
                "dynamodb.region": aws_config.awsRegion,
                "dynamodb.profile-name": aws_config.profileName,
                # Needed because the way PyIceberg instantiates the PyArrowFileIO
                # is different from how they instantiate the Boto3 Client.
                **cls.get_fs_parameters(aws_config),
            }

        return DynamoDbCatalog(catalog.name, **parameters)
