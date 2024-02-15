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
import traceback
from abc import ABC
from typing import Optional

from azure.identity import ClientSecretCredential, DefaultAzureCredential
from azure.keyvault.secrets import KeyVaultSecret, SecretClient

from metadata.generated.schema.security.secrets.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.utils.logger import utils_logger
from metadata.utils.secrets.external_secrets_manager import ExternalSecretsManager

logger = utils_logger()

NULL_VALUE = "null"


class AzureKVSecretsManager(ExternalSecretsManager, ABC):
    """
    Azure Key Vault Secrets Manager class
    """

    def __init__(
        self,
        credentials: Optional["AzureCredentials"],
    ):
        super().__init__(SecretsManagerProvider.azure_kv)

        if credentials.tenantId and credentials.clientId and credentials.clientSecret:
            azure_identity = ClientSecretCredential(
                tenant_id=credentials.tenantId,
                client_id=credentials.clientId,
                client_secret=credentials.clientSecret.get_secret_value(),
            )
        else:
            azure_identity = DefaultAzureCredential()

        self.client = SecretClient(
            vault_url=f"https://{credentials.vaultName}.vault.azure.net/",
            credential=azure_identity,
        )

    def get_string_value(self, secret_id: str) -> str:
        """
        :param secret_id: The secret id to retrieve
        :return: The value of the secret
        """
        try:
            secret: KeyVaultSecret = self.client.get_secret(secret_id)
            logger.debug(f"Got value for secret {secret_id}")
            return secret.value
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Could not get the secret value of {secret_id} due to [{exc}]"
            )
