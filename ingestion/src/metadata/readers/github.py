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
import base64
import traceback
from enum import Enum
from typing import Any, Dict

import requests

from metadata.generated.schema.security.credentials.githubCredentials import (
    GitHubCredentials,
)
from metadata.readers.base import Reader, ReadException
from metadata.utils.constants import UTF_8
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


HOST = "https://api.github.com"


class UrlParts(Enum):
    REPOS = "repos"
    CONTENTS = "contents"


class GitHubReader(Reader):
    """
    Handle calls to the GitHub API against a repo
    """

    def __init__(self, credentials: GitHubCredentials):
        self.credentials = credentials

        self._auth_headers = None

    @property
    def auth_headers(self) -> Dict[str, str]:
        """
        Build the headers to authenticate
        to the API
        """
        if self._auth_headers is None:
            self._auth_headers = {"Authentication": f"token {self.credentials.token}"}

        return self._auth_headers

    @staticmethod
    def _build_url(*parts: str):
        """
        Build URL parts
        """
        return "/".join(parts)

    @staticmethod
    def _decode_content(json_response: Dict[str, Any]) -> str:
        """
        Return the content of the response

        If no `content` there, throw the KeyError
        """
        return base64.b64decode(json_response["content"]).decode(UTF_8)

    def read(self, path: str) -> str:
        """
        Read a file from a GitHub Repo and return its
        contents as a string
        https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28#get-repository-content
        """
        try:
            res = requests.get(
                self._build_url(
                    HOST,
                    UrlParts.REPOS.value,
                    self.credentials.repositoryOwner,
                    self.credentials.repositoryName,
                    UrlParts.CONTENTS.value,
                    path,
                ),
                timeout=30,
            )
            if res.status_code == 200:
                return self._decode_content(res.json())

        except Exception as err:
            logger.debug(traceback.format_exc())
            raise ReadException(f"Error fetching file [{path}] from repo: {err}")

        raise ReadException(f"Could not fetch file [{path}] from repo")
