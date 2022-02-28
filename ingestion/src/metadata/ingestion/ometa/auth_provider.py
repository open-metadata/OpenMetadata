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
Interface definition for an Auth provider
"""

from abc import ABCMeta, abstractmethod
from dataclasses import dataclass

from metadata.config.common import ConfigModel


@dataclass(init=False)  # type: ignore[misc]
class AuthenticationProvider(metaclass=ABCMeta):
    """
    Interface definition for an Authentification provider
    """

    @classmethod
    @abstractmethod
    def create(cls, config: ConfigModel) -> "AuthenticationProvider":
        """
        Create authentication

        Arguments:
            config (ConfigModel): configuration
        Returns:
            AuthenticationProvider
        """

    @abstractmethod
    def auth_token(self) -> str:
        """
        Authentication token

        Returns:
            str
        """

    @abstractmethod
    def get_access_token(self):
        """
        Authentication token

        Returns:
            str
        """
