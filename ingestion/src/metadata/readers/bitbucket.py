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
import traceback
from enum import Enum

import requests

from metadata.generated.schema.security.credentials.bitbucketCredentials import (
    BitBucketCredentials,
)
from metadata.readers.api_reader import ApiReader
from metadata.readers.base import ReadException
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


HOST = "https://api.bitbucket.org/2.0"


class UrlParts(Enum):
    REPOS = "repositories"
    SRC = "src"


class BitBucketReader(ApiReader):
    """
    Handle calls to the GitHub API against a repo
    """

    credentials: BitBucketCredentials

    def read(self, path: str) -> str:
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
                    self.credentials.repositoryOwner.__root__,
                    self.credentials.repositoryName.__root__,
                    UrlParts.SRC.value,
                    self.credentials.branch,
                    path,
                ),
                headers=self.auth_headers,
                timeout=30,
            )
            if res.status_code == 200:
                return res.text

            # If we don't get a 200, raise
            res.raise_for_status()

        except Exception as err:
            logger.debug(traceback.format_exc())
            raise ReadException(f"Error fetching file [{path}] from repo: {err}")

        raise ReadException(f"Could not fetch file [{path}] from repo")
