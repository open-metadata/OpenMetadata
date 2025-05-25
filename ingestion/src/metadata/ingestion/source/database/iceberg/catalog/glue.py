#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Iceberg Glue Catalog
"""
import boto3
from pyiceberg.catalog import Catalog
from pyiceberg.catalog.glue import GlueCatalog

from metadata.generated.schema.entity.services.connections.database.iceberg.glueCatalogConnection import (
    GlueCatalogConnection,
)
from metadata.generated.schema.entity.services.connections.database.iceberg.icebergCatalog import (
    IcebergCatalog,
)
from metadata.ingestion.source.database.iceberg.catalog.base import IcebergCatalogBase


class IcebergGlueCatalog(IcebergCatalogBase):
    """Responsible for building a PyIceberg Glue Catalog."""

    @staticmethod
    def override_boto3_glue_client(catalog: GlueCatalog, parameters: dict):
        """
        Overrides the boto3 client created by PyIceberg.
        This is needed because PyIceberg 0.4.0 has a bug
        where they try to pass the 'aws_access_key_id' as 'aws_secret_key_id' and
        it breaks.
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
        catalog.glue = session.client("glue")

    @classmethod
    def get_catalog(cls, catalog: IcebergCatalog) -> Catalog:
        """Returns a Glue Catalog for the given connection and file storage.

        For more information, check the PyIceberg [docs](https://py.iceberg.apache.org/configuration/#glue-catalog)
        """
        if not isinstance(catalog.connection, GlueCatalogConnection):
            raise RuntimeError(
                "'connection' is not an instance of 'GlueCatalogConnection'"
            )

        parameters = {"warehouse": catalog.warehouseLocation}

        if catalog.connection.awsConfig:
            aws_config = catalog.connection.awsConfig

            parameters = {
                **parameters,
                "aws_access_key_id": aws_config.awsAccessKeyId,
                "aws_secret_access_key": aws_config.awsSecretAccessKey.get_secret_value()
                if aws_config.awsSecretAccessKey
                else None,
                "aws_session_token": aws_config.awsSessionToken,
                "region_name": aws_config.awsRegion,
                "profile_name": aws_config.profileName,
                # Needed because the way PyIceberg instantiates the PyArrowFileIO
                # is different from how they instantiate the Boto3 Client.
                **cls.get_fs_parameters(aws_config),
            }

        glue_catalog: GlueCatalog = GlueCatalog(catalog.name, **parameters)

        # HACK: Overriding the Boto3 Glue client due to PyIceberg 0.4.0 Bug.
        cls.override_boto3_glue_client(glue_catalog, parameters)

        return glue_catalog
