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
Source connection handler
"""
from dataclasses import dataclass
from functools import singledispatch

from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    AzureConfig,
    DatalakeConnection,
    GCSConfig,
    S3Config,
)
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.utils.credentials import set_google_credentials


# Only import specific datalake dependencies if necessary
# pylint: disable=import-outside-toplevel
@dataclass
class DatalakeClient:
    def __init__(self, client, config) -> None:
        self.client = client
        self.config = config


@singledispatch
def get_datalake_client(config):
    """
    Method to retrieve datalake client from the config
    """
    if config:
        msg = f"Config not implemented for type {type(config)}: {config}"
        raise NotImplementedError(msg)


@get_datalake_client.register
def _(config: S3Config):
    from metadata.clients.aws_client import AWSClient

    s3_client = AWSClient(config.securityConfig).get_client(service_name="s3")
    return s3_client


@get_datalake_client.register
def _(config: GCSConfig):
    from google.cloud import storage

    set_google_credentials(gcs_credentials=config.securityConfig)
    gcs_client = storage.Client()
    return gcs_client


@get_datalake_client.register
def _(config: AzureConfig):
    from azure.identity import ClientSecretCredential
    from azure.storage.blob import BlobServiceClient

    try:
        credentials = ClientSecretCredential(
            config.securityConfig.tenantId,
            config.securityConfig.clientId,
            config.securityConfig.clientSecret.get_secret_value(),
        )

        azure_client = BlobServiceClient(
            f"https://{config.securityConfig.accountName}.blob.core.windows.net/",
            credential=credentials,
        )
        return azure_client

    except Exception as exc:
        raise RuntimeError(
            f"Unknown error connecting with {config.securityConfig}: {exc}."
        )


def get_connection(connection: DatalakeConnection) -> DatalakeClient:
    """
    Create connection.

    Returns an AWS, Azure or GCS Clients.
    """
    return DatalakeClient(
        client=get_datalake_client(connection.configSource),
        config=connection,
    )


def test_connection(connection: DatalakeClient) -> None:
    """
    Test that we can connect to the source using the given aws resource
    :param engine: boto service resource to test
    :return: None or raise an exception if we cannot connect
    """
    from botocore.client import ClientError

    try:
        config = connection.config.configSource
        if isinstance(config, GCSConfig):
            if connection.config.bucketName:
                connection.client.get_bucket(connection.config.bucketName)
            else:
                connection.client.list_buckets()

        if isinstance(config, S3Config):
            if connection.config.bucketName:
                connection.client.list_objects(Bucket=connection.config.bucketName)
            else:
                connection.client.list_buckets()

        if isinstance(config, AzureConfig):
            connection.client.list_containers(name_starts_with="")

    except ClientError as err:
        msg = f"Connection error for {connection}: {err}. Check the connection details."
        raise SourceConnectionException(msg) from err
