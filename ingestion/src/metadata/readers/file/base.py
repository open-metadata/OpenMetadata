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
Base local reader
"""

import traceback
from abc import ABC, abstractmethod
from typing import List, Optional, Union  # noqa: UP035

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class ReadException(Exception):  # noqa: N818
    """
    To be raised by any errors with the read calls
    """


class Reader(ABC):
    """
    Abstract class for all readers
    """

    @abstractmethod
    def read(self, path: str, **kwargs) -> Union[str, bytes]:  # noqa: UP007
        """
        Given a string, return a string
        """
        raise NotImplementedError("Missing read implementation")

    @abstractmethod
    def _get_tree(self) -> List[str]:  # noqa: UP006
        """
        Return the filenames of the root
        """
        raise NotImplementedError("Missing get_tree implementation")

    def get_tree(self) -> Optional[List[str]]:  # noqa: UP006, UP045
        """
        If something happens, return None
        """
        try:
            return self._get_tree()
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Error getting file tree [{err}]")
        return None

    def download(self, path: str, local_file_path: str, **kwargs):  # noqa: B027
        """
        Given a path, download the file
        """
        # To be implemented by required readers
