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
Secrets manager factory module
"""
from typing import Any, Optional

from metadata.generated.schema.security.secrets.secretsManagerClientLoader import (
    SecretsManagerClientLoader,
)
from metadata.generated.schema.security.secrets.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.utils.secrets.aws_secrets_manager import AWSSecretsManager
from metadata.utils.secrets.aws_ssm_secrets_manager import AWSSSMSecretsManager
from metadata.utils.secrets.client.loader import secrets_manager_client_loader
from metadata.utils.secrets.noop_secrets_manager import DBSecretsManager
from metadata.utils.secrets.secrets_manager import SecretsManager
from metadata.utils.singleton import Singleton


class SecretsManagerConfigException(Exception):
    """
    Invalid config that does not allow us to create
    the SecretsManagerFactory
    """


class SecretsManagerFactory(metaclass=Singleton):
    """
    Singleton factory to initialize a secret manager. It will return always the same secret manager instance.
    """

    secrets_manager: SecretsManager

    def __init__(
        self,
        secrets_manager_provider: Optional[SecretsManagerProvider] = None,
        secrets_manager_loader: Optional[SecretsManagerClientLoader] = None,
    ):
        """Here the concrete class object is no passed to avoid the creation of circular dependencies

        :param secrets_manager_provider: the secrets' manager provider
        :param secrets_manager_loader: Tells the client how to pick up the creds from the environment
        """

        self._secrets_manager_provider = secrets_manager_provider
        self._secrets_manager_loader = secrets_manager_loader

        credentials = self._load_secrets_manager_credentials()

        self.secrets_manager = self._get_secrets_manager(
            secrets_manager_provider,
            credentials,
        )

    @property
    def secrets_manager_provider(self) -> Optional[SecretsManagerProvider]:
        return self._secrets_manager_provider

    @property
    def secrets_manager_loader(self) -> Optional[SecretsManagerClientLoader]:
        return self._secrets_manager_loader

    def _get_secrets_manager(
        self,
        secrets_manager_provider: SecretsManagerProvider,
        credentials: Any = None,
    ) -> SecretsManager:
        """
        Method to get the secrets manager based on the arguments passed
        :param secrets_manager_provider: the secrets' manager provider
        :param credentials: optional credentials that could be required by the clients of the secrets' manager
                            implementations
        :return: a secrets manager
        """
        if (
            secrets_manager_provider is None
            or secrets_manager_provider == SecretsManagerProvider.db
        ):
            return DBSecretsManager()
        if secrets_manager_provider in (
            SecretsManagerProvider.aws,
            SecretsManagerProvider.managed_aws,
        ):
            return AWSSecretsManager(credentials)
        if secrets_manager_provider in (
            SecretsManagerProvider.aws_ssm,
            SecretsManagerProvider.managed_aws_ssm,
        ):
            return AWSSSMSecretsManager(credentials)
        raise NotImplementedError(f"[{secrets_manager_provider}] is not implemented.")

    def get_secrets_manager(self):
        return self.secrets_manager

    def _load_secrets_manager_credentials(self) -> Optional["AWSCredentials"]:
        if not self.secrets_manager_loader:
            return None

        try:
            loader_fn = secrets_manager_client_loader.registry.get(
                self.secrets_manager_loader.value
            )
            return loader_fn(self.secrets_manager_provider)
        except Exception as err:
            raise SecretsManagerConfigException(f"Error loading credentials - [{err}]")
