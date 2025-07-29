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
Generic Delimiter-Separated-Values implementation
"""
from functools import singledispatchmethod

from pyarrow.parquet import ParquetFile

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
from metadata.readers.dataframe.base import (
    MAX_FILE_SIZE_FOR_PREVIEW,
    DataFrameReader,
    FileFormatException,
)
from metadata.readers.dataframe.common import dataframe_to_chunks
from metadata.readers.dataframe.models import DatalakeColumnWrapper
from metadata.readers.file.adls import AZURE_PATH, return_azure_storage_options
from metadata.readers.models import ConfigSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class ParquetDataFrameReader(DataFrameReader):
    """
    Manage the implementation to read DSV dataframes
    from any source based on its init client.
    """

    def _read_parquet_in_batches(
        self, parquet_file: ParquetFile, batch_size: int = 10000
    ):
        """
        Read a large parquet file in batches to avoid memory issues.
        Includes multiple fallback strategies for older PyArrow versions.

        Args:
            parquet_file: PyArrow ParquetFile or similar object
            batch_size: Number of rows to read per batch

        Returns:
            List of DataFrame chunks
        """
        chunks = []
        batch_count = 0

        try:
            # Method 1: iter_batches (PyArrow >= 3.0 - preferred)
            if hasattr(parquet_file, "iter_batches"):
                logger.info(
                    "Reading large parquet file in batches to avoid memory issues"
                )
                for batch in parquet_file.iter_batches(batch_size=batch_size):
                    df_batch = batch.to_pandas()
                    if not df_batch.empty:
                        chunks.extend(dataframe_to_chunks(df_batch))
                        batch_count += 1

                logger.info(
                    f"Successfully processed {batch_count} batches from large parquet file"
                )
                return chunks

            # Method 2: Row group reading (PyArrow >= 0.15.0)
            elif hasattr(parquet_file, "num_row_groups") and hasattr(
                parquet_file, "read_row_group"
            ):
                logger.warning(
                    "iter_batches not available, using row group reading as fallback"
                )

                for i in range(parquet_file.num_row_groups):
                    try:
                        row_group_table = parquet_file.read_row_group(i)
                        df_chunk = row_group_table.to_pandas()
                        if not df_chunk.empty:
                            # Further chunk if row group is still too large
                            if len(df_chunk) > batch_size:
                                chunks.extend(dataframe_to_chunks(df_chunk))
                            else:
                                chunks.append(df_chunk)
                            batch_count += 1
                    except Exception as row_exc:
                        logger.warning(f"Failed to read row group {i}: {row_exc}")
                        continue

                if chunks:
                    logger.info(
                        f"Successfully processed {batch_count} row groups from large parquet file"
                    )
                    return chunks

            # Method 3: Regular reading (final fallback)
            logger.warning(
                "No chunking methods available, falling back to regular reading"
            )
            df = parquet_file.read().to_pandas()
            chunks.extend(dataframe_to_chunks(df))

        except Exception as exc:
            # If all chunking fails, try regular reading as final fallback
            logger.warning(
                f"Batched reading failed: {exc}. Falling back to regular reading - this may cause memory issues for large files"
            )
            try:
                df = parquet_file.read().to_pandas()
                chunks.extend(dataframe_to_chunks(df))
            except Exception as fallback_exc:
                logger.error(f"Failed to read parquet file: {fallback_exc}")
                raise fallback_exc

        return chunks

    @singledispatchmethod
    def _read_parquet_dispatch(
        self, config_source: ConfigSource, key: str, bucket_name: str
    ) -> DatalakeColumnWrapper:
        raise FileFormatException(config_source=config_source, file_name=key)

    @_read_parquet_dispatch.register
    def _(self, _: GCSConfig, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        """
        Read the Parquet file from the gcs bucket and return a dataframe
        """
        # pylint: disable=import-outside-toplevel
        from gcsfs import GCSFileSystem

        gcs = GCSFileSystem()
        file_path = f"gs://{bucket_name}/{key}"

        # Check file size to determine reading strategy
        try:
            file_info = gcs.info(file_path)
            file_size = file_info.get("size", 0)

            file = gcs.open(file_path)
            parquet_file = ParquetFile(file)

            if self._should_use_chunking(file_size):
                # Use batched reading for large files
                return self._read_parquet_in_batches(parquet_file)
            else:
                # Use regular reading for smaller files
                dataframe_response = parquet_file.read().to_pandas(
                    split_blocks=True, self_destruct=True
                )
                return dataframe_to_chunks(dataframe_response)

        except Exception:
            # Fallback to regular reading if size check fails
            file = gcs.open(file_path)
            parquet_file = ParquetFile(file)
            dataframe_response = parquet_file.read().to_pandas(
                split_blocks=True, self_destruct=True
            )
            return dataframe_to_chunks(dataframe_response)

    @_read_parquet_dispatch.register
    def _(self, _: S3Config, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        # pylint: disable=import-outside-toplevel
        from pyarrow.fs import S3FileSystem
        from pyarrow.parquet import ParquetDataset, ParquetFile

        client_kwargs = {
            "endpoint_override": (
                str(self.config_source.securityConfig.endPointURL)
                if self.config_source.securityConfig.endPointURL
                else None
            ),
            "region": (
                self.config_source.securityConfig.awsRegion
                if self.config_source.securityConfig.awsRegion
                else None
            ),
            "access_key": self.config_source.securityConfig.awsAccessKeyId,
            "session_token": self.config_source.securityConfig.awsSessionToken,
            "role_arn": self.config_source.securityConfig.assumeRoleArn,
            "session_name": self.config_source.securityConfig.assumeRoleSessionName,
        }
        if self.config_source.securityConfig.awsSecretAccessKey:
            client_kwargs[
                "secret_key"
            ] = self.config_source.securityConfig.awsSecretAccessKey.get_secret_value()
        s3_fs = S3FileSystem(**client_kwargs)

        bucket_uri = f"{bucket_name}/{key}"

        # Check file size to determine reading strategy
        try:
            file_info = s3_fs.get_file_info(bucket_uri)
            file_size = file_info.size if hasattr(file_info, "size") else 0

            if self._should_use_chunking(file_size):
                # Use ParquetFile for batched reading of large files
                logger.info(
                    f"Large parquet file detected ({file_size} bytes > {MAX_FILE_SIZE_FOR_PREVIEW} bytes). "
                    f"Using batched reading for file: {bucket_uri}"
                )
                parquet_file = ParquetFile(bucket_uri, filesystem=s3_fs)
                return self._read_parquet_in_batches(parquet_file)
            else:
                # Use ParquetDataset for regular reading of smaller files
                logger.debug(
                    f"Reading small parquet file ({file_size} bytes): {bucket_uri}"
                )
                dataset = ParquetDataset(bucket_uri, filesystem=s3_fs)
                return dataframe_to_chunks(dataset.read_pandas().to_pandas())

        except Exception as exc:
            # Fallback to regular reading if size check fails
            logger.warning(
                f"Could not determine file size for {bucket_uri}: {exc}. Using regular reading"
            )
            dataset = ParquetDataset(bucket_uri, filesystem=s3_fs)
            return dataframe_to_chunks(dataset.read_pandas().to_pandas())

    @_read_parquet_dispatch.register
    def _(self, _: AzureConfig, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        import pandas as pd  # pylint: disable=import-outside-toplevel
        import pyarrow.fs as fs

        storage_options = return_azure_storage_options(self.config_source)
        account_url = AZURE_PATH.format(
            bucket_name=bucket_name,
            account_name=self.config_source.securityConfig.accountName,
            key=key,
        )

        # Check file size to determine reading strategy
        try:
            # Try to get file size from Azure
            azure_fs = fs.SubTreeFileSystem(
                account_url, fs.AzureFileSystem(**storage_options)
            )
            file_info = azure_fs.get_file_info("/")
            file_size = file_info.size if hasattr(file_info, "size") else 0

            if self._should_use_chunking(file_size):
                # Use PyArrow ParquetFile for batched reading of large files
                parquet_file = ParquetFile(
                    account_url, filesystem=fs.AzureFileSystem(**storage_options)
                )
                return self._read_parquet_in_batches(parquet_file)
            else:
                # Use pandas for regular reading of smaller files
                dataframe = pd.read_parquet(
                    account_url, storage_options=storage_options
                )
                return dataframe_to_chunks(dataframe)

        except Exception:
            # Fallback to regular pandas reading if size check or batching fails
            dataframe = pd.read_parquet(account_url, storage_options=storage_options)
            return dataframe_to_chunks(dataframe)

    @_read_parquet_dispatch.register
    def _(
        self,
        _: LocalConfig,
        key: str,
        bucket_name: str,  # pylint: disable=unused-argument
    ) -> DatalakeColumnWrapper:
        import os

        import pandas as pd  # pylint: disable=import-outside-toplevel

        # Check file size to determine reading strategy
        try:
            file_size = os.path.getsize(key)

            if self._should_use_chunking(file_size):
                # Use PyArrow ParquetFile for batched reading of large files
                parquet_file = ParquetFile(key)
                return self._read_parquet_in_batches(parquet_file)
            else:
                # Use pandas for regular reading of smaller files
                dataframe = pd.read_parquet(key)
                return dataframe_to_chunks(dataframe)

        except Exception:
            # Fallback to regular pandas reading if size check fails
            dataframe = pd.read_parquet(key)
            return dataframe_to_chunks(dataframe)

    def _read(self, *, key: str, bucket_name: str, **__) -> DatalakeColumnWrapper:
        return DatalakeColumnWrapper(
            dataframes=self._read_parquet_dispatch(
                self.config_source, key=key, bucket_name=bucket_name
            )
        )

    def _should_use_chunking(self, file_size: int) -> bool:
        return file_size > MAX_FILE_SIZE_FOR_PREVIEW or file_size == 0
