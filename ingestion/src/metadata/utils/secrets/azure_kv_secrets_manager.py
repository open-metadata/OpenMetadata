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
import traceback
from abc import ABC
from typing import Optional

from azure.keyvault.secrets import KeyVaultSecret

from metadata.clients.azure_client import AzureClient
from metadata.generated.schema.security.secrets.secretsManagerClientLoader import (
    SecretsManagerClientLoader,
)
from metadata.generated.schema.security.secrets.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.utils.dispatch import enum_register
from metadata.utils.logger import utils_logger
from metadata.utils.secrets.external_secrets_manager import (
    SECRET_MANAGER_AIRFLOW_CONF,
    ExternalSecretsManager,
    SecretsManagerConfigException,
)

logger = utils_logger()

secrets_manager_client_loader = enum_register()


# pylint: disable=import-outside-toplevel
@secrets_manager_client_loader.add(SecretsManagerClientLoader.noop.value)
def _() -> None:
    return None


@secrets_manager_client_loader.add(SecretsManagerClientLoader.airflow.value)
def _() -> Optional["AzureCredentials"]:
    from airflow.configuration import conf

    from metadata.generated.schema.security.credentials.azureCredentials import (
        AzureCredentials,
    )

    key_vault_name = conf.get(
        SECRET_MANAGER_AIRFLOW_CONF, "azure_key_vault_name", fallback=None
    )
    if not key_vault_name:
        raise ValueError(
            "Missing `azure_key_vault_name` config for Azure Key Vault Secrets Manager Provider."
        )

    tenant_id = conf.get(SECRET_MANAGER_AIRFLOW_CONF, "azure_tenant_id", fallback=None)
    client_id = conf.get(SECRET_MANAGER_AIRFLOW_CONF, "azure_client_id", fallback=None)
    client_secret = conf.get(
        SECRET_MANAGER_AIRFLOW_CONF, "azure_client_secret", fallback=None
    )

    return AzureCredentials(
        clientId=client_id,
        clientSecret=client_secret,
        tenantId=tenant_id,
        vaultName=key_vault_name,
    )


@secrets_manager_client_loader.add(SecretsManagerClientLoader.env.value)
def _() -> Optional["AzureCredentials"]:
    from metadata.generated.schema.security.credentials.azureCredentials import (
        AzureCredentials,
    )

    # Load only the AZURE_KEY_VAULT_NAME (required) variable and use the
    # Default Auth chain
    # https://learn.microsoft.com/en-us/python/api/overview/azure/identity-readme?view=azure-python#defaultazurecredential
    key_vault_name = os.getenv("AZURE_KEY_VAULT_NAME")

    if not key_vault_name:
        raise ValueError(
            "Missing `azure_key_vault_name` config for Azure Key Vault Secrets Manager Provider."
        )

    return AzureCredentials(vaultName=key_vault_name)


class AzureKVSecretsManager(ExternalSecretsManager, ABC):
    """
    Azure Key Vault Secrets Manager class
    """

    def __init__(
        self,
        loader: SecretsManagerClientLoader,
    ):
        super().__init__(provider=SecretsManagerProvider.azure_kv, loader=loader)

        self.client = AzureClient(self.credentials).create_secret_client()

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
            raise exc

    def load_credentials(self) -> Optional["AzureCredentials"]:
        """Load the provider credentials based on the loader type"""
        try:
            loader_fn = secrets_manager_client_loader.registry.get(self.loader.value)
            return loader_fn()
        except Exception as err:
            raise SecretsManagerConfigException(f"Error loading credentials - [{err}]")
