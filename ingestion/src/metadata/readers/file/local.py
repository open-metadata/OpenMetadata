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
Local Reader
"""
import os
import traceback
from pathlib import Path
from typing import List, Optional, Union

from metadata.readers.file.base import Reader, ReadException
from metadata.utils.constants import UTF_8
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class LocalReader(Reader):
    """
    Read files locally
    """

    def __init__(self, base_path: Optional[Path] = None):
        self.base_path = base_path or Path(__file__)

    def read(self, path: str, **kwargs) -> Union[str, bytes]:
        """
        simple local reader

        If we cannot encode the file contents, we fallback and returns the bytes
        to let the client use this data as needed.
        """
        try:
            with open(self.base_path / path, encoding=UTF_8) as file:
                return file.read()

        except UnicodeDecodeError:
            logger.debug(
                "Cannot read the file with UTF-8 encoding. Trying to read bytes..."
            )
            with open(self.base_path / path, "rb") as file:
                return file.read()

        except Exception as err:
            logger.debug(traceback.format_exc())
            raise ReadException(f"Error reading file [{path}] locally: {err}")

    def _get_tree(self) -> Optional[List[str]]:
        """
        Return the tree with the files relative to the base path
        """
        return [
            str(path).replace(str(self.base_path) + "/", "")
            for path in Path(self.base_path).rglob("*")
        ]

    def get_local_files(
        self, search_key: str, excluded_files: Optional[List[str]] = None
    ) -> List[str]:
        """Scan through local path recursively
        and retuns file path based on `search_key`"""

        if excluded_files is None:
            excluded_files = []

        file_paths = []
        for root, _, file in os.walk(self.base_path):
            for fle in file:
                if search_key in fle and fle not in excluded_files:
                    file_paths.append(f"{root}/{fle}")

        return file_paths

    def download(
        self,
        path: str,
        local_file_path: str,
        *,
        bucket_name: str = None,
        verbose: bool = True,
        **__,
    ):
        # Nothing to download for local files
        pass
