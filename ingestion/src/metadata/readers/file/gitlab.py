#  Copyright 2025 Collate
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
Gitlab client to read files with token auth
"""
import base64
import traceback
from enum import Enum
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus

import requests

from metadata.generated.schema.security.credentials.gitlabCredentials import (
    GitlabCredentials,
)
from metadata.readers.file.api_reader import ApiReader
from metadata.readers.file.base import ReadException
from metadata.utils.constants import UTF_8
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


HOST = "https://gitlab.com/api/v4"


class UrlParts(Enum):
    FILES = "files"
    PROJECTS = "projects"
    REPOSITORY = "repository"
    TREE = "tree"


class GitlabReader(ApiReader):
    """
    Handle calls to the Gitlab API against a repo
    """

    credentials: GitlabCredentials

    def __init__(self, credentials):
        super().__init__(credentials)
        self._encoded_project_path = None

    @property
    def auth_headers(self) -> Dict[str, str]:
        """
        Build the headers to authenticate
        to the API
        """
        if self._auth_headers is None and self.credentials.token:
            self._auth_headers = {
                "PRIVATE-TOKEN": self.credentials.token.root.get_secret_value()
            }

        return self._auth_headers

    @property
    def encoded_project_path(self) -> str:
        """
        Build the URL-encoded project path for the Gitlab API
        """
        if (
            self._encoded_project_path is None
            and self.credentials.repositoryOwner.root
            and self.credentials.repositoryName.root
        ):
            self._encoded_project_path = quote_plus(
                "/".join(
                    [
                        self.credentials.repositoryOwner.root,
                        self.credentials.repositoryName.root,
                    ]
                )
            )

        return self._encoded_project_path

    @staticmethod
    def _decode_content(json_response: Dict[str, Any]) -> str:
        """
        Return the content of the response

        If no `content` there, throw the KeyError
        """
        return base64.b64decode(json_response["content"]).decode(UTF_8)

    def read(self, path: str, **__) -> str:
        """
        Read a file from a Gitlab Repo and return its
        contents as a string
        https://docs.gitlab.com/ee/api/repository_files.html
        """
        encoded_file_path = quote_plus(path)
        branch = self._get_default_branch()
        try:
            res = requests.get(
                self._build_url(
                    HOST,
                    UrlParts.PROJECTS.value,
                    self.encoded_project_path,
                    UrlParts.REPOSITORY.value,
                    UrlParts.FILES.value,
                    f"{encoded_file_path}?ref={branch}",
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
            self._build_url(HOST, UrlParts.PROJECTS.value, self.encoded_project_path),
            headers=self.auth_headers,
            timeout=30,
        )
        if res.status_code == 200:
            return res.json().get("default_branch")

        # If we don't get a 200, raise
        res.raise_for_status()
        raise RuntimeError("Could not fetch the default branch")

    def _get_tree(self, url: str = None) -> Optional[List[str]]:
        """
        Use the Gitlab Repository Tree API to iterate over tree pages recursively
        """
        if url is None:
            url = self._build_url(
                HOST,
                UrlParts.PROJECTS.value,
                self.encoded_project_path,
                UrlParts.REPOSITORY.value,
                f"{UrlParts.TREE.value}?recursive=true&pagination=keyset&per_page=100&order_by=path&sort=desc",
            )
        res = requests.get(
            url,
            headers=self.auth_headers,
            timeout=30,
        )
        if res.status_code == 200:
            paths = [elem.get("path") for elem in res.json()]
            if res.links.get("next"):
                paths.extend(self._get_tree(res.links["next"]["url"]))
            return paths

        # If we don't get a 200, raise
        res.raise_for_status()

        return None
