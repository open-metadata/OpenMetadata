#  Copyright 2022 Collate
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
Abstract class for AWS based secrets manager implementations
"""
import os
from abc import ABC, abstractmethod
from typing import Optional

from metadata.clients.aws_client import AWSClient
from metadata.generated.schema.security.secrets.secretsManagerClientLoader import (
    SecretsManagerClientLoader,
)
from metadata.generated.schema.security.secrets.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.utils.dispatch import enum_register
from metadata.utils.logger import utils_logger
from metadata.utils.secrets.external_secrets_manager import (
    SECRET_MANAGER_AIRFLOW_CONF,
    ExternalSecretsManager,
    SecretsManagerConfigException,
)

logger = utils_logger()

NULL_VALUE = "null"

secrets_manager_client_loader = enum_register()


# pylint: disable=import-outside-toplevel
@secrets_manager_client_loader.add(SecretsManagerClientLoader.noop.value)
def _() -> None:
    return None


@secrets_manager_client_loader.add(SecretsManagerClientLoader.airflow.value)
def _() -> Optional["AWSCredentials"]:
    from airflow.configuration import conf

    from metadata.generated.schema.security.credentials.awsCredentials import (
        AWSCredentials,
    )

    aws_region = conf.get(SECRET_MANAGER_AIRFLOW_CONF, "aws_region", fallback=None)
    if aws_region:
        credentials = AWSCredentials(awsRegion=aws_region)
        credentials.awsAccessKeyId = conf.get(
            SECRET_MANAGER_AIRFLOW_CONF, "aws_access_key_id", fallback=""
        )
        credentials.awsSecretAccessKey = CustomSecretStr(
            conf.get(SECRET_MANAGER_AIRFLOW_CONF, "aws_secret_access_key", fallback="")
        )
        return credentials

    return None


@secrets_manager_client_loader.add(SecretsManagerClientLoader.env.value)
def _() -> Optional["AWSCredentials"]:
    from metadata.generated.schema.security.credentials.awsCredentials import (
        AWSCredentials,
    )

    # Loading the env vars required by boto3
    # https://boto3.amazonaws.com/v1/documentation/api/latest/guide/configuration.html
    aws_region = os.getenv("AWS_DEFAULT_REGION")
    if aws_region:
        return AWSCredentials(awsRegion=aws_region)

    return None


class AWSBasedSecretsManager(ExternalSecretsManager, ABC):
    """
    AWS Secrets Manager class
    """

    def __init__(
        self,
        client: str,
        provider: SecretsManagerProvider,
        loader: SecretsManagerClientLoader,
    ):
        super().__init__(provider=provider, loader=loader)
        self.client = AWSClient(self.credentials).get_client(client)

    @abstractmethod
    def get_string_value(self, secret_id: str) -> str:
        """
        :param secret_id: The secret id to retrieve
        :return: The value of the secret
        """

    def load_credentials(self) -> Optional["AWSCredentials"]:
        """Load the provider credentials based on the loader type"""
        try:
            loader_fn = secrets_manager_client_loader.registry.get(self.loader.value)
            return loader_fn()
        except Exception as err:
            raise SecretsManagerConfigException(f"Error loading credentials - [{err}]")
