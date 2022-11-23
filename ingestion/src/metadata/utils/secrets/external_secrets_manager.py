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
from abc import ABC

from metadata.generated.schema.security.secrets.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.utils.secrets.secrets_manager import SecretsManager


class ExternalSecretsManager(SecretsManager, ABC):
    """
    Abstract class for third party secrets' manager implementations
    """

    def __init__(self, provider: SecretsManagerProvider):
        self.provider = provider.name
