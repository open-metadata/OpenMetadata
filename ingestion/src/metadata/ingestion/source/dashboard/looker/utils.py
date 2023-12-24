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
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def _clone_repo(
    repo_name: str,
    path: str,
    credential: Optional[
        Union[
            NoGitCredentials,
            GitHubCredentials,
            BitBucketCredentials,
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
        if isinstance(credential, GitHubCredentials):
            url = f"https://x-oauth-basic:{credential.token.__root__.get_secret_value()}@github.com/{repo_name}.git"
        elif isinstance(credential, BitBucketCredentials):
            url = f"https://x-token-auth::{credential.token.__root__.get_secret_value()}@bitbucket.or/{repo_name}.git"

        assert url is not None

        Repo.clone_from(url, path)

        logger.info(f"repo {repo_name} cloned to {path}")
    except Exception as exc:
        logger.error(f"GitHubCloneReader::_clone: ERROR {exc} ")
