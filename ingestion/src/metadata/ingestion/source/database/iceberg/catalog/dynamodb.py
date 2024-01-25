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
from metadata.generated.schema.entity.services.connections.database.icebergConnection import (
    Catalog as IcebergCatalog,
)
from metadata.ingestion.source.database.iceberg.catalog.base import IcebergCatalogBase


class IcebergDynamoDbCatalog(IcebergCatalogBase):
    """Responsible for building a PyIceberg DynamoDB Catalog."""

    @staticmethod
    def override_boto3_dyamo_client(catalog: DynamoDbCatalog, parameters: dict):
        """
        Overrides the boto3 client created by PyIceberg.
        PyIceberg doesn't handle the Boto3 Session.
        """
        boto_session_config_keys = [
            "aws_access_key_id",
            "aws_secret_access_key",
            "aws_session_token",
            "region_name",
            "profile_name",
        ]

        session_config = {
            k: v for k, v in parameters.items() if k in boto_session_config_keys
        }
        session = boto3.Session(**session_config)
        catalog.dynamodb = session.client("dynamodb")

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
                "aws_secret_key_id": aws_config.awsAccessKeyId,
                "aws_secret_access_key": aws_config.awsSecretAccessKey
                if aws_config.awsSecretAccessKey
                else None,
                "aws_session_token": aws_config.awsSessionToken,
                "region_name": aws_config.awsRegion,
                "profile_name": aws_config.profileName,
                # Needed because the way PyIceberg instantiates the PyArrowFileIO
                # is different from how they instantiate the Boto3 Client.
                **cls.get_fs_parameters(aws_config),
            }

        dynamodb_catalog = DynamoDbCatalog(catalog.name, **parameters)

        # HACK: Overriding the Boto3 DynamoDB client due to PyIceberg not handling the
        # Boto3 Session correctly
        cls.override_boto3_dyamo_client(dynamodb_catalog, parameters)

        return dynamodb_catalog
