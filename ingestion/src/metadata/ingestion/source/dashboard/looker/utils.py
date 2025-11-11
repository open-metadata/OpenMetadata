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
Utilities for Looker service
"""

import os
import shutil
from typing import Optional, Union

from git import Repo

from metadata.generated.schema.entity.services.connections.dashboard.lookerConnection import (
    NoGitCredentials,
)
from metadata.generated.schema.security.credentials.bitbucketCredentials import (
    BitBucketCredentials,
)
from metadata.generated.schema.security.credentials.githubCredentials import (
    GitHubCredentials,
)
from metadata.generated.schema.security.credentials.gitlabCredentials import (
    GitlabCredentials,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def _extract_hostname(git_host_url) -> str:
    """Extract hostname from git host URL by removing protocol prefix"""
    # Handle both string and AnyUrl/HttpUrl objects from Pydantic
    url_str = str(git_host_url)
    # Remove protocol and trailing slash
    hostname = url_str.replace("https://", "").replace("http://", "").rstrip("/")
    return hostname


def _clone_repo(
    repo_name: str,
    path: str,
    credential: Optional[
        Union[
            NoGitCredentials, GitHubCredentials, BitBucketCredentials, GitlabCredentials
        ]
    ],
    overwrite: Optional[bool] = False,
):
    """Clone a repo to local `path`"""
    try:
        if overwrite:
            shutil.rmtree(path, ignore_errors=True)
        if os.path.isdir(path):
            logger.debug(f"_clone_repo: repo {path} already cloned.")
            return

        url = None
        allow_unsafe_protocols = False
        if isinstance(credential, GitHubCredentials):
            git_host = credential.gitHostURL or "https://github.com"
            hostname = _extract_hostname(git_host)
            url = f"https://x-oauth-basic:{credential.token.root.get_secret_value()}@{hostname}/{repo_name}.git"
        elif isinstance(credential, BitBucketCredentials):
            git_host = credential.gitHostURL or "https://bitbucket.org"
            hostname = _extract_hostname(git_host)
            url = f"https://x-token-auth:{credential.token.root.get_secret_value()}@{hostname}/{repo_name}.git"
            allow_unsafe_protocols = True
        elif isinstance(credential, GitlabCredentials):
            git_host = credential.gitHostURL or "https://gitlab.com"
            hostname = _extract_hostname(git_host)
            url = f"https://x-token-auth:{credential.token.root.get_secret_value()}@{hostname}/{repo_name}.git"

        assert url is not None

        Repo.clone_from(url, path, allow_unsafe_protocols=allow_unsafe_protocols)

        logger.info(f"repo {repo_name} cloned to {path}")
    except Exception as exc:
        logger.error(f"GitHubCloneReader::_clone: ERROR {exc} ")
