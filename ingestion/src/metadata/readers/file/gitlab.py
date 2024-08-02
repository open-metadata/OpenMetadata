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

    @staticmethod
    def _encode_project_path(project_owner: str, project_name: str) -> str:
        """
        Generated a URL-encoded project path argument for the Gitlab API
        """
        return quote_plus("/".join([project_owner, project_name]))

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
        try:
            res = requests.get(
                self._build_url(
                    HOST,
                    UrlParts.PROJECTS.value,
                    self._encode_project_path(
                        self.credentials.repositoryOwner.root,
                        self.credentials.repositoryName.root,
                    ),
                    UrlParts.REPOSITORY.value,
                    UrlParts.FILES.value,
                    encoded_file_path,
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

    def _get_tree(self, page: int = 1, per_page: int = 500) -> Optional[List[str]]:
        """
        Use the Gitlab Repository Tree API to iterate over tree pages
        """
        res = requests.get(
            self._build_url(
                HOST,
                UrlParts.PROJECTS.value,
                self._encode_project_path(
                    self.credentials.repositoryOwner.root,
                    self.credentials.repositoryName.root,
                ),
                UrlParts.REPOSITORY.value,
                UrlParts.TREE.value,
                f"?recursive=true&per_page={per_page}&page={page}",
            ),
            headers=self.auth_headers,
            timeout=30,
        )
        if res.status_code == 200:
            paths = [elem.get("path") for elem in res.json()]
            if len(paths) == per_page:
                paths.append(self._get_tree(page + 1, per_page))
            return paths

        # If we don't get a 200, raise
        res.raise_for_status()

        return None
