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
Dataframe base reader
"""

from abc import ABC, abstractmethod
from typing import Any, Optional

from metadata.readers.dataframe.models import DatalakeColumnWrapper
from metadata.readers.file.base import Reader
from metadata.readers.file.config_source_factory import get_reader
from metadata.readers.models import ConfigSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class FileFormatException(Exception):
    def __init__(self, config_source: Any, file_name: str) -> None:
        message = f"Missing implementation for {config_source.__class__.__name__} for {file_name}"
        super().__init__(message)


class DataFrameReadException(Exception):
    """
    To be raised by any errors with the read calls
    """


class DataFrameReader(ABC):
    """
    Abstract class for all readers.

    Readers are organized by Format, not by Source Type (S3, GCS or ADLS).

    Some DF readers first need to read the full file and then prepare the
    dataframe. This is why we add the File Reader as well.
    """

    config_source: ConfigSource
    reader: Reader

    def __init__(self, config_source: ConfigSource, client: Optional[Any]):
        self.config_source = config_source
        self.client = client

        self.reader = get_reader(config_source=config_source, client=client)

    @abstractmethod
    def _read(self, *, key: str, bucket_name: str, **kwargs) -> DatalakeColumnWrapper:
        """
        Pass the path, bucket, or any other necessary details
        to read the dataframe from the source.
        """
        raise NotImplementedError("Missing read implementation")

    def read(self, *, key: str, bucket_name: str, **kwargs) -> DatalakeColumnWrapper:
        try:
            return self._read(key=key, bucket_name=bucket_name, **kwargs)
        except Exception as err:
            raise DataFrameReadException(f"Error reading dataframe due to [{err}]")
