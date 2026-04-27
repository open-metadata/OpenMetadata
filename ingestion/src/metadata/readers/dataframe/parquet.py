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

from __future__ import annotations

import os  # noqa: F401
from functools import singledispatchmethod
from typing import TYPE_CHECKING, Optional

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
from metadata.utils.constants import CHUNKSIZE
from metadata.utils.logger import ingestion_logger

if TYPE_CHECKING:
    from pyarrow.parquet import ParquetFile

logger = ingestion_logger()


class ParquetDataFrameReader(DataFrameReader):
    """
    Manage the implementation to read DSV dataframes
    from any source based on its init client.
    """

    def _read_parquet_in_batches(self, parquet_file: ParquetFile, batch_size: int = CHUNKSIZE):
        """
        Read a large parquet file in batches to avoid memory issues.
        Includes multiple fallback strategies for older PyArrow versions.

        Args:
            parquet_file: PyArrow ParquetFile or similar object
            batch_size: Number of rows to read per batch

        Yields:
            DataFrame chunks
        """
        batch_count = 0

        try:
            # Method 1: iter_batches (PyArrow >= 3.0 - preferred)
            if hasattr(parquet_file, "iter_batches"):
                logger.info("Reading large parquet file in batches to avoid memory issues")
                for batch in parquet_file.iter_batches(batch_size=batch_size):
                    df_batch = batch.to_pandas()
                    if not df_batch.empty:
                        yield from dataframe_to_chunks(df_batch)
                        batch_count += 1

                logger.info(f"Successfully processed {batch_count} batches from large parquet file")
                return

            # Method 2: Row group reading (PyArrow >= 0.15.0)
            elif hasattr(parquet_file, "num_row_groups") and hasattr(parquet_file, "read_row_group"):
                logger.warning("iter_batches not available, using row group reading as fallback")

                for i in range(parquet_file.num_row_groups):
                    try:
                        row_group_table = parquet_file.read_row_group(i)
                        df_chunk = row_group_table.to_pandas()
                        if not df_chunk.empty:
                            # Further chunk if row group is still too large
                            if len(df_chunk) > batch_size:
                                yield from dataframe_to_chunks(df_chunk)
                            else:
                                yield df_chunk
                            batch_count += 1
                    except Exception as row_exc:
                        logger.warning(f"Failed to read row group {i}: {row_exc}")
                        continue

                logger.info(f"Successfully processed {batch_count} row groups from large parquet file")
                return

            # Method 3: Regular reading (final fallback)
            logger.warning("No chunking methods available, falling back to regular reading")
            df = parquet_file.read().to_pandas()
            yield from dataframe_to_chunks(df)

        except Exception as exc:
            # If all chunking fails, try regular reading as final fallback
            logger.warning(
                f"Batched reading failed: {exc}. Falling back to regular reading - this may cause memory issues for large files"
            )
            try:
                df = parquet_file.read().to_pandas()
                yield from dataframe_to_chunks(df)
            except Exception as fallback_exc:
                logger.error(f"Failed to read parquet file: {fallback_exc}")
                raise fallback_exc

    @singledispatchmethod
    def _read_parquet_dispatch(self, config_source: ConfigSource, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        raise FileFormatException(config_source=config_source, file_name=key)

    @_read_parquet_dispatch.register
    def _(self, _: GCSConfig, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        """
        Read the Parquet file from the gcs bucket and return a dataframe
        """
        # pylint: disable=import-outside-toplevel
        from gcsfs import GCSFileSystem
        from pyarrow.parquet import ParquetFile

        gcs = GCSFileSystem()
        file_path = f"gs://{bucket_name}/{key}"

        # Check file size to determine reading strategy
        try:
            file_info = gcs.info(file_path)
            file_size = file_info.get("size", 0)

            if self._should_use_chunking(file_size):
                # Use batched reading for large files
                def chunk_generator():
                    file = gcs.open(file_path)
                    parquet_file = ParquetFile(file)
                    yield from self._read_parquet_in_batches(parquet_file)

                return DatalakeColumnWrapper(dataframes=chunk_generator, raw_data=None, columns=None)
            else:
                # Use regular reading for smaller files
                def chunk_generator():
                    file = gcs.open(file_path)
                    parquet_file = ParquetFile(file)
                    dataframe_response = parquet_file.read().to_pandas(split_blocks=True, self_destruct=True)
                    yield from dataframe_to_chunks(dataframe_response)

                return DatalakeColumnWrapper(dataframes=chunk_generator, raw_data=None, columns=None)

        except Exception as exc:
            # Fallback to regular reading if size check fails
            logger.warning(f"Error reading parquet file from GCS '{file_path}': {exc}. Falling back to regular reading")

            def chunk_generator():
                file = gcs.open(file_path)
                parquet_file = ParquetFile(file)
                dataframe_response = parquet_file.read().to_pandas(split_blocks=True, self_destruct=True)
                yield from dataframe_to_chunks(dataframe_response)

            return DatalakeColumnWrapper(dataframes=chunk_generator, raw_data=None, columns=None)

    def _build_s3fs_filesystem(self):
        """Build an s3fs filesystem using credentials from the boto3 session.

        Uses the session created by AWSClient which already handles
        AssumeRole, instance profiles, ECS task roles, etc.
        Falls back to default credential chain if no session is available
        (e.g., when called from profiler).
        """
        # pylint: disable=import-outside-toplevel
        from s3fs import S3FileSystem

        kwargs = {}
        if self.session:
            credentials = self.session.get_credentials()
            if credentials is not None:
                creds = credentials.get_frozen_credentials()
                kwargs["key"] = creds.access_key
                kwargs["secret"] = creds.secret_key
                kwargs["token"] = creds.token
        elif self.config_source.securityConfig.awsAccessKeyId:
            kwargs["key"] = self.config_source.securityConfig.awsAccessKeyId
            if self.config_source.securityConfig.awsSecretAccessKey:
                kwargs["secret"] = self.config_source.securityConfig.awsSecretAccessKey.get_secret_value()
            if self.config_source.securityConfig.awsSessionToken:
                kwargs["token"] = self.config_source.securityConfig.awsSessionToken

        client_kwargs = {}
        if self.config_source.securityConfig.endPointURL:
            client_kwargs["endpoint_url"] = str(self.config_source.securityConfig.endPointURL)
        if self.config_source.securityConfig.awsRegion:
            client_kwargs["region_name"] = self.config_source.securityConfig.awsRegion

        if client_kwargs:
            kwargs["client_kwargs"] = client_kwargs

        return S3FileSystem(**kwargs)

    @_read_parquet_dispatch.register
    def _(self, _: S3Config, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        # pylint: disable=import-outside-toplevel
        from pyarrow.parquet import ParquetFile

        s3_fs = self._build_s3fs_filesystem()
        file_path = f"{bucket_name}/{key}"
        file_size = getattr(self, "_file_size", None)

        if file_size is None:
            try:
                file_size = s3_fs.info(file_path)["size"]
            except Exception as exc:
                logger.warning(f"Could not determine file size for {file_path}: {exc}. Assuming large file.")
                file_size = 0

        if self._should_use_chunking(file_size):

            def chunk_generator():
                if file_size:
                    logger.info(
                        f"Large parquet file detected ({file_size} bytes > "
                        f"{MAX_FILE_SIZE_FOR_PREVIEW} bytes). "
                        f"Using batched reading for file: {file_path}"
                    )
                else:
                    logger.info(f"Unknown file size. Using batched reading for file: {file_path}")
                with s3_fs.open(file_path) as f:
                    parquet_file = ParquetFile(f)
                    yield from self._read_parquet_in_batches(parquet_file)

        else:

            def chunk_generator():
                with s3_fs.open(file_path) as f:
                    parquet_file = ParquetFile(f)
                    yield from dataframe_to_chunks(parquet_file.read().to_pandas())

        return DatalakeColumnWrapper(dataframes=chunk_generator, raw_data=None, columns=None)

    @_read_parquet_dispatch.register
    def _(self, _: AzureConfig, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        import pandas as pd  # pylint: disable=import-outside-toplevel
        from adlfs import AzureBlobFileSystem
        from pyarrow.fs import FSSpecHandler, PyFileSystem
        from pyarrow.parquet import ParquetFile

        storage_options = return_azure_storage_options(self.config_source)
        account_url = AZURE_PATH.format(
            bucket_name=bucket_name,
            account_name=self.config_source.securityConfig.accountName,
            key=key,
        )

        # Check file size to determine reading strategy
        try:
            # Use adlfs (fsspec-based) filesystem which supports service principal auth
            adlfs_fs = AzureBlobFileSystem(
                account_name=self.config_source.securityConfig.accountName,
                **storage_options,
            )
            file_path = f"{bucket_name}/{key}"
            file_info = adlfs_fs.info(file_path)
            file_size = file_info.get("size", 0)

            if self._should_use_chunking(file_size):

                def arrow_chunk_generator():
                    logger.info(
                        f"Large parquet file detected ({file_size} bytes > {MAX_FILE_SIZE_FOR_PREVIEW} bytes). "
                        f"Using batched reading for file: {account_url}"
                    )
                    arrow_fs = PyFileSystem(FSSpecHandler(adlfs_fs))
                    parquet_file = ParquetFile(file_path, filesystem=arrow_fs)
                    yield from self._read_parquet_in_batches(parquet_file)

                return DatalakeColumnWrapper(dataframes=arrow_chunk_generator, raw_data=None, columns=None)
            else:

                def chunk_generator():
                    # Use pandas for regular reading of smaller files
                    dataframe = pd.read_parquet(account_url, storage_options=storage_options)
                    yield from dataframe_to_chunks(dataframe)

                return DatalakeColumnWrapper(dataframes=chunk_generator, raw_data=None, columns=None)

        except Exception as exc:
            logger.warning(
                f"Error reading parquet file from Azure '{account_url}': {exc}. Falling back to pandas reading"
            )

            def chunk_generator():
                dataframe = pd.read_parquet(account_url, storage_options=storage_options)
                yield from dataframe_to_chunks(dataframe)

            return DatalakeColumnWrapper(dataframes=chunk_generator, raw_data=None, columns=None)

    @_read_parquet_dispatch.register
    def _(
        self,
        _: LocalConfig,
        key: str,
        bucket_name: str,  # pylint: disable=unused-argument
    ) -> DatalakeColumnWrapper:
        import os  # noqa: F811

        import pandas as pd  # pylint: disable=import-outside-toplevel
        from pyarrow.parquet import ParquetFile

        # Check file size to determine reading strategy
        try:
            file_size = os.path.getsize(key)

            if self._should_use_chunking(file_size):

                def arrow_chunk_generator():
                    logger.info(
                        f"Large parquet file detected ({file_size} bytes > {MAX_FILE_SIZE_FOR_PREVIEW} bytes). "
                        f"Using batched reading for file: {key}"
                    )
                    parquet_file = ParquetFile(key)
                    yield from self._read_parquet_in_batches(parquet_file)

                return DatalakeColumnWrapper(dataframes=arrow_chunk_generator, raw_data=None, columns=None)
            else:

                def chunk_generator():
                    # Use pandas for regular reading of smaller files
                    dataframe = pd.read_parquet(key)
                    yield from dataframe_to_chunks(dataframe)

                return DatalakeColumnWrapper(dataframes=chunk_generator, raw_data=None, columns=None)

        except Exception as exc:
            logger.warning(f"Error reading parquet file from local path '{key}': {exc}. Falling back to pandas reading")

            def chunk_generator():
                dataframe = pd.read_parquet(key)
                yield from dataframe_to_chunks(dataframe)

            return DatalakeColumnWrapper(dataframes=chunk_generator, raw_data=None, columns=None)

    def _read(self, *, key: str, bucket_name: str, file_size: Optional[int] = None, **__) -> DatalakeColumnWrapper:
        self._file_size = file_size
        return self._read_parquet_dispatch(self.config_source, key=key, bucket_name=bucket_name)

    def _should_use_chunking(self, file_size: int) -> bool:
        return file_size > MAX_FILE_SIZE_FOR_PREVIEW or file_size == 0
