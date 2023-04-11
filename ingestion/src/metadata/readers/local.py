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
Local Reader
"""
import traceback
from pathlib import Path

from metadata.readers.base import Reader, ReadException
from metadata.utils.constants import UTF_8
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class LocalReader(Reader):
    """
    Read files locally
    """

    def __init__(self, base_path: Path):
        self.base_path = base_path

    def read(self, path: str) -> str:
        """
        simple local reader
        """
        try:
            with open(self.base_path / path, encoding=UTF_8) as file:
                return file.read()

        except Exception as err:
            logger.debug(traceback.format_exc())
            raise ReadException(f"Error reading file [{path}] locally: {err}")
