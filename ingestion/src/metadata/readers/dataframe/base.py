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

from metadata.generated.schema.entity.services.connections.database.datalake.azureConfig import (
    AzureConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalake.gcsConfig import (
    GCSConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
    S3Config,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    LocalConfig,
)
from metadata.readers.dataframe.models import DatalakeColumnWrapper
from metadata.readers.file.base import Reader
from metadata.readers.file.config_source_factory import get_reader
from metadata.readers.models import ConfigSource
from metadata.utils.logger import ingestion_logger

MAX_FILE_SIZE_FOR_PREVIEW = 50 * 1024 * 1024  # 50MB

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

    All readers return generators to avoid loading entire files into memory.
    Use read() for full generator, read_first_chunk() for schema inference.
    """

    config_source: ConfigSource
    reader: Reader

    def __init__(self, config_source: ConfigSource, client: Optional[Any]):
        self.config_source = config_source
        self.client = client

        self.reader = get_reader(config_source=config_source, client=client)

    def _get_file_size_mb(self, key: str, bucket_name: str) -> float:
        """
        Get file size in MB. Returns 0 if unable to determine.
        Uses efficient HEAD operations from cloud providers.
        """
        try:
            if isinstance(self.config_source, S3Config):
                response = self.client.head_object(Bucket=bucket_name, Key=key)
                return response.get("ContentLength", 0) / (1024 * 1024)

            elif isinstance(self.config_source, GCSConfig):
                from gcsfs import GCSFileSystem

                gcs = GCSFileSystem()
                file_path = f"gs://{bucket_name}/{key}"
                file_info = gcs.info(file_path)
                return file_info.get("size", 0) / (1024 * 1024)

            elif isinstance(self.config_source, AzureConfig):
                from adlfs import AzureBlobFileSystem

                from metadata.readers.file.adls import return_azure_storage_options

                storage_options = return_azure_storage_options(self.config_source)
                adlfs_fs = AzureBlobFileSystem(
                    account_name=self.config_source.securityConfig.accountName,
                    **storage_options,
                )
                file_path = f"{bucket_name}/{key}"
                file_info = adlfs_fs.info(file_path)
                return file_info.get("size", 0) / (1024 * 1024)

            elif isinstance(self.config_source, LocalConfig):
                import os

                return os.path.getsize(key) / (1024 * 1024)

        except Exception as exc:
            logger.debug(f"Could not determine file size for {key}: {exc}")
            return 0

    @abstractmethod
    def _read(self, *, key: str, bucket_name: str, **kwargs) -> DatalakeColumnWrapper:
        """
        Pass the path, bucket, or any other necessary details
        to read the dataframe from the source.
        Returns DatalakeColumnWrapper with dataframes as a generator.
        """
        raise NotImplementedError("Missing read implementation")

    def read(self, *, key: str, bucket_name: str, **kwargs) -> DatalakeColumnWrapper:
        """Returns generator of dataframe chunks for full file processing."""
        try:
            return self._read(key=key, bucket_name=bucket_name, **kwargs)
        except Exception as err:
            raise DataFrameReadException(f"Error reading dataframe due to [{err}]")

    def read_first_chunk(
        self, *, key: str, bucket_name: str, **kwargs
    ) -> DatalakeColumnWrapper:
        """
        Returns only the first chunk of data. Used for schema inference
        without loading the entire file into memory.
        Properly closes the generator to release file handles and connections.
        """
        try:
            wrapper = self._read(key=key, bucket_name=bucket_name, **kwargs)
            first_chunk = None
            dataframes_gen = wrapper.dataframes

            if dataframes_gen is not None:
                if callable(dataframes_gen):
                    dataframes_gen = dataframes_gen()
                try:
                    first_chunk = next(dataframes_gen)
                except StopIteration:
                    first_chunk = None
                finally:
                    if hasattr(dataframes_gen, "close"):
                        dataframes_gen.close()

            return DatalakeColumnWrapper(
                columns=wrapper.columns,
                dataframes=(lambda chunk=first_chunk: iter([chunk]))
                if first_chunk is not None
                else None,
                raw_data=wrapper.raw_data,
            )
        except Exception as err:
            raise DataFrameReadException(f"Error reading first chunk due to [{err}]")
