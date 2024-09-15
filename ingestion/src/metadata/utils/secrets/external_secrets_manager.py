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
Abstract class for third party secrets' manager implementations
"""
from abc import ABC, abstractmethod
from typing import Any

from metadata.generated.schema.security.secrets.secretsManagerClientLoader import (
    SecretsManagerClientLoader,
)
from metadata.generated.schema.security.secrets.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.utils.secrets.secrets_manager import SecretsManager

SECRET_MANAGER_AIRFLOW_CONF = "openmetadata_secrets_manager"


class SecretsManagerConfigException(Exception):
    """
    Invalid config that does not allow us to create
    the SecretsManagerFactory
    """


class ExternalSecretsManager(SecretsManager, ABC):
    """
    Abstract class for third party secrets' manager implementations
    """

    def __init__(
        self, provider: SecretsManagerProvider, loader: SecretsManagerClientLoader
    ):
        self.provider = provider
        self.loader = loader

        self.credentials = self.load_credentials()

    @abstractmethod
    def load_credentials(self) -> Any:
        """Load the provider credentials based on the loader type"""
