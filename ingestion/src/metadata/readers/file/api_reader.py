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
GitHub client to read files with token auth
"""

from abc import ABC
from typing import Dict, Union

from metadata.generated.schema.security.credentials.bitbucketCredentials import (
    BitBucketCredentials,
)
from metadata.generated.schema.security.credentials.githubCredentials import (
    GitHubCredentials,
)
from metadata.generated.schema.security.credentials.gitlabCredentials import (
    GitlabCredentials,
)
from metadata.readers.file.base import Reader
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

ReadersCredentials = Union[GitHubCredentials, BitBucketCredentials, GitlabCredentials]


class ApiReader(Reader, ABC):
    """
    Generic API Reader
    """

    def __init__(self, credentials: ReadersCredentials):
        self._auth_headers = None
        self.credentials = credentials

    @property
    def auth_headers(self) -> Dict[str, str]:
        """
        Build the headers to authenticate
        to the API
        """
        if self._auth_headers is None and self.credentials.token:
            self._auth_headers = {
                "Authorization": f"Bearer {self.credentials.token.root.get_secret_value()}"
            }

        return self._auth_headers

    @staticmethod
    def _build_url(*parts: str):
        """
        Build URL parts
        """
        return "/".join(parts)
