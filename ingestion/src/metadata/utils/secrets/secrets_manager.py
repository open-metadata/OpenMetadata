#  Copyright 2022 Collate
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
Secrets manager interface
"""
from abc import abstractmethod

from metadata.utils.logger import ingestion_logger
from metadata.utils.singleton import Singleton

logger = ingestion_logger()
SECRET_PREFIX = "secret:"


class SecretsManager(metaclass=Singleton):
    """
    Abstract class implemented by different secrets' manager providers.

    It contains a set of auxiliary methods for adding missing fields which have been encrypted in the secrets' manager
    providers.
    """

    @abstractmethod
    def get_string_value(self, secret_id: str) -> str:
        """
        :param secret_id: The secret id to retrieve
        :return: The value of the secret
        """

    def remove_secret_prefix(self, secret_ref: str) -> str:
        """
        Remove the 'secret:' prefix from a secret reference string.

        :param secret_ref: The secret reference string ('secret:my-secret-id')
        :return: The secret id without the prefix ('my-secret-id')
        """
        if secret_ref and secret_ref.startswith(SECRET_PREFIX):
            return secret_ref.replace(SECRET_PREFIX, "")
        return secret_ref
