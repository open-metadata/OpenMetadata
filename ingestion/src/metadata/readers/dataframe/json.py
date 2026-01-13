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
JSON DataFrame reader - streams JSON Lines in batches to avoid OOM
"""
import gzip
import json
from contextlib import contextmanager
from functools import singledispatchmethod
from typing import Iterator, Optional

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
from metadata.readers.dataframe.models import DatalakeColumnWrapper
from metadata.readers.file.adls import return_azure_storage_options
from metadata.readers.models import ConfigSource
from metadata.utils.constants import CHUNKSIZE, UTF_8
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class JSONDataFrameReader(DataFrameReader):
    """
    Read JSON DataFrames with streaming support for JSON Lines format.
    Falls back to loading for regular JSON objects/arrays.
    """

    @staticmethod
    def _stream_json_lines(
        file_obj, is_gzipped: bool = False, batch_size: int = CHUNKSIZE
    ) -> Iterator["DataFrame"]:
        """
        Stream JSON Lines from a file-like object in batches.
        Each line is expected to be a valid JSON object.
        """
        from pandas import DataFrame

        if is_gzipped:
            file_obj = gzip.GzipFile(fileobj=file_obj)

        batch = []
        for line in file_obj:
            if isinstance(line, bytes):
                line = line.decode(UTF_8, errors="ignore")
            line = line.strip()
            if not line:
                continue
            try:
                batch.append(json.loads(line))
                if len(batch) >= batch_size:
                    yield DataFrame.from_records(batch)
                    batch = []
            except json.JSONDecodeError:
                continue
        if batch:
            yield DataFrame.from_records(batch)

    @staticmethod
    def _read_json_object(
        file_obj, key: str, is_gzipped: bool = False
    ) -> tuple[Iterator["DataFrame"], Optional[str]]:
        """
        Read a regular JSON object/array (non-streaming fallback).
        Returns generator and raw_data if $schema is present.
        """
        from pandas import DataFrame

        content = file_obj.read()
        if isinstance(content, bytes):
            if is_gzipped:
                content = gzip.decompress(content)
            content = content.decode(UTF_8, errors="ignore")

        raw_data = None
        data = json.loads(content)

        if isinstance(data, dict):
            if data.get("$schema"):
                raw_data = content
            data = [data]

        def chunk_generator():
            for i in range(0, len(data), CHUNKSIZE):
                yield DataFrame.from_records(data[i : i + CHUNKSIZE])

        return chunk_generator(), raw_data

    @staticmethod
    def _stream_large_json_array(
        file_obj, is_gzipped: bool = False, batch_size: int = CHUNKSIZE
    ) -> Iterator["DataFrame"]:
        """
        Stream large JSON arrays using ijson to avoid loading entire file into memory.
        Works for JSON arrays only, not for single objects.
        """
        try:
            import ijson
            from pandas import DataFrame

            if is_gzipped:
                file_obj = gzip.GzipFile(fileobj=file_obj)

            batch = []
            for record in ijson.items(file_obj, "item"):
                batch.append(record)
                if len(batch) >= batch_size:
                    yield DataFrame.from_records(batch)
                    batch = []
            if batch:
                yield DataFrame.from_records(batch)

        except ImportError:
            logger.warning(
                "ijson not available for streaming large JSON. "
                "Install with: pip install ijson"
            )
            raise
        except Exception as exc:
            logger.warning(
                f"Failed to stream JSON array with ijson: {exc}. "
                f"Falling back to regular reading."
            )
            raise

    @staticmethod
    def _try_stream_json_lines(
        file_obj, key: str, is_gzipped: bool = False
    ) -> tuple[Iterator["DataFrame"], Optional[str], bool]:
        """
        Try to read as JSON Lines first (streaming).
        Returns (generator, raw_data, success).
        """
        from pandas import DataFrame

        first_line = None
        if is_gzipped:
            gzip_obj = gzip.GzipFile(fileobj=file_obj)
            first_line = gzip_obj.readline()
        else:
            first_line = file_obj.readline()

        if isinstance(first_line, bytes):
            first_line = first_line.decode(UTF_8, errors="ignore")

        first_line = first_line.strip()
        if not first_line:
            return iter([]), None, True

        try:
            first_obj = json.loads(first_line)
            if isinstance(first_obj, dict) and not first_obj.get("$schema"):
                return None, None, True
            return None, None, False
        except json.JSONDecodeError:
            return None, None, False

    def _read_json_with_size_check(
        self,
        file_obj_getter,
        key: str,
        bucket_name: str,
        is_gzipped: bool,
    ) -> DatalakeColumnWrapper:
        """
        Read JSON with automatic size detection and streaming.
        Uses file_obj_getter() to get fresh file streams (callable).
        """
        with file_obj_getter() as f:
            _, raw_data, is_json_lines = self._try_stream_json_lines(f, key, is_gzipped)

        if is_json_lines:

            def chunk_generator():
                with file_obj_getter() as f:
                    yield from self._stream_json_lines(f, is_gzipped)

            return DatalakeColumnWrapper(
                dataframes=chunk_generator(), raw_data=raw_data
            )

        file_size_mb = self._get_file_size_mb(key, bucket_name)
        if file_size_mb > (MAX_FILE_SIZE_FOR_PREVIEW / (1024 * 1024)):
            logger.info(
                f"Large JSON file detected ({file_size_mb:.2f} MB). "
                f"Attempting to stream with ijson to prevent OOM."
            )
            try:

                def chunk_generator():
                    with file_obj_getter() as f:
                        yield from self._stream_large_json_array(f, is_gzipped)

                return DatalakeColumnWrapper(dataframes=chunk_generator())
            except Exception as exc:
                logger.warning(
                    f"ijson streaming failed: {exc}. Falling back to regular reading. "
                    f"This may cause OOM for very large files."
                )

        with file_obj_getter() as f:
            dataframes, raw_data = self._read_json_object(f, key, is_gzipped)
        return DatalakeColumnWrapper(dataframes=dataframes, raw_data=raw_data)

    @singledispatchmethod
    def _read_json_dispatch(
        self, config_source: ConfigSource, key: str, bucket_name: str
    ) -> DatalakeColumnWrapper:
        raise FileFormatException(config_source=config_source, file_name=key)

    @_read_json_dispatch.register
    def _(self, _: S3Config, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        """Stream JSON from S3 without loading entire file into memory."""
        is_gzipped = key.endswith(".gz")

        @contextmanager
        def get_s3_stream():
            response = self.client.get_object(Bucket=bucket_name, Key=key)
            try:
                yield response["Body"]
            finally:
                response["Body"].close()

        return self._read_json_with_size_check(
            get_s3_stream, key, bucket_name, is_gzipped
        )

    @_read_json_dispatch.register
    def _(self, _: GCSConfig, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        """Stream JSON from GCS without loading entire file into memory."""
        from gcsfs import GCSFileSystem

        gcs = GCSFileSystem()
        file_path = f"gs://{bucket_name}/{key}"
        is_gzipped = key.endswith(".gz")

        @contextmanager
        def get_gcs_stream():
            with gcs.open(file_path, "rb") as f:
                yield f

        return self._read_json_with_size_check(
            get_gcs_stream, key, bucket_name, is_gzipped
        )

    @_read_json_dispatch.register
    def _(self, _: AzureConfig, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        """Stream JSON from Azure without loading entire file into memory."""
        from adlfs import AzureBlobFileSystem

        storage_options = return_azure_storage_options(self.config_source)
        adlfs_fs = AzureBlobFileSystem(
            account_name=self.config_source.securityConfig.accountName,
            **storage_options,
        )
        file_path = f"{bucket_name}/{key}"
        is_gzipped = key.endswith(".gz")

        @contextmanager
        def get_azure_stream():
            with adlfs_fs.open(file_path, "rb") as f:
                yield f

        return self._read_json_with_size_check(
            get_azure_stream, key, bucket_name, is_gzipped
        )

    @_read_json_dispatch.register
    def _(
        self,
        _: LocalConfig,
        key: str,
        bucket_name: str,  # pylint: disable=unused-argument
    ) -> DatalakeColumnWrapper:
        """Stream JSON from local filesystem without loading entire file into memory."""
        is_gzipped = key.endswith(".gz")

        @contextmanager
        def get_local_stream():
            with open(key, "rb") as f:
                yield f

        return self._read_json_with_size_check(
            get_local_stream, key, bucket_name, is_gzipped
        )

    def _read(self, *, key: str, bucket_name: str, **__) -> DatalakeColumnWrapper:
        return self._read_json_dispatch(
            self.config_source, key=key, bucket_name=bucket_name
        )
