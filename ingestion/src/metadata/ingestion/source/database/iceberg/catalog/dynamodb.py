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


class CustomDynamoDbCatalog(DynamoDbCatalog):
    """Custom DynamoDb Catalog implementation to override the PyIceberg one.
    This is needed due to PyIceberg not handling the __init__ method correctly by
    instantiating the Boto3 Client without the correct configuration and having side
    effects on it.
    """

    @staticmethod
    def get_boto3_client(parameters: dict):
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
        return session.client("dynamodb")

    def __init__(self, name: str, **properties: str):
        # HACK: Runs Catalog.__init__ without running DynamoDbCatalog.__init__
        super(DynamoDbCatalog, self).__init__(  # pylint: disable=E1003,I0021
            name, **properties
        )

        self.dynamodb = self.get_boto3_client(properties)
        self.dynamodb_table_name = self.properties.get("table-name", "iceberg")


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

        return CustomDynamoDbCatalog(catalog.name, **parameters)
