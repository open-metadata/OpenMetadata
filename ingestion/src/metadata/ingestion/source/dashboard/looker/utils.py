import os
import shutil
from typing import Optional

from ingestion.src.metadata.utils.logger import ingestion_logger
from git import Repo

logger = ingestion_logger()


def _clone_repo(
    repo_name: str, path: str, token: str, overwrite: Optional[bool] = False
):
    """Clone a repo to local `path`"""
    try:
        if overwrite:
            shutil.rmtree(path, ignore_errors=True)
        if os.path.isdir(path):
            logger.debug(f"GitHubCloneReader::_clone: repo {path} already cloned.")
            return

        url = f"https://x-oauth-basic:{token}@github.com/{repo_name}.git"
        Repo.clone_from(url, path)

        logger.info(f"repo {repo_name} cloned to {path}")
    except Exception as e:
        logger.error(f"GitHubCloneReader::_clone: ERROR {e} ")
