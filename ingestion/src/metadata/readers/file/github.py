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
from typing import Any, Dict, List, Optional

import requests

from metadata.generated.schema.security.credentials.githubCredentials import (
    GitHubCredentials,
)
from metadata.readers.file.api_reader import ApiReader
from metadata.readers.file.base import ReadException
from metadata.utils.constants import UTF_8
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


HOST = "https://api.github.com"


class UrlParts(Enum):
    REPOS = "repos"
    CONTENTS = "contents"


class GitHubReader(ApiReader):
    """
    Handle calls to the GitHub API against a repo
    """

    credentials: GitHubCredentials

    @staticmethod
    def _decode_content(json_response: Dict[str, Any]) -> str:
        """
        Return the content of the response

        If no `content` there, throw the KeyError
        """
        return base64.b64decode(json_response["content"]).decode(UTF_8)

    def read(self, path: str, **__) -> str:
        """
        Read a file from a GitHub Repo and return its
        contents as a string
        https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28#get-repository-content

        This does not care if the path starts with `/` or not.
        """
        try:
            res = requests.get(
                self._build_url(
                    HOST,
                    UrlParts.REPOS.value,
                    self.credentials.repositoryOwner.root,
                    self.credentials.repositoryName.root,
                    UrlParts.CONTENTS.value,
                    path,
                ),
                headers=self.auth_headers,
                timeout=30,
            )
            if res.status_code == 200:
                return self._decode_content(res.json())

            # If we don't get a 200, raise
            res.raise_for_status()

        except Exception as err:
            logger.debug(traceback.format_exc())
            raise ReadException(f"Error fetching file [{path}] from repo: {err}")

        raise ReadException(f"Could not fetch file [{path}] from repo")

    def _get_default_branch(self) -> str:
        """
        Get repo default branch
        """
        res = requests.get(
            self._build_url(
                HOST,
                UrlParts.REPOS.value,
                self.credentials.repositoryOwner.root,
                self.credentials.repositoryName.root,
            ),
            headers=self.auth_headers,
            timeout=30,
        )
        if res.status_code == 200:
            return res.json().get("default_branch")

        # If we don't get a 200, raise
        res.raise_for_status()
        raise RuntimeError("Could not fetch the default branch")

    def _get_tree(self) -> Optional[List[str]]:
        """
        Use the GitHub Tree API
        """
        # First, get the default branch
        branch = self._get_default_branch()
        if branch:
            res = requests.get(
                self._build_url(
                    HOST,
                    UrlParts.REPOS.value,
                    self.credentials.repositoryOwner.root,
                    self.credentials.repositoryName.root,
                    "git",
                    "trees",
                    f"{branch}?recursive=1",
                ),
                headers=self.auth_headers,
                timeout=30,
            )
            if res.status_code == 200:
                return [elem.get("path") for elem in res.json().get("tree")]

            # If we don't get a 200, raise
            res.raise_for_status()

        # If we don't find a branch, return None
        return None
