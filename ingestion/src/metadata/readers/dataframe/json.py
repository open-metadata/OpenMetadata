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
import zipfile
from collections.abc import Generator
from contextlib import contextmanager
from functools import singledispatchmethod
from typing import Any, Iterator, Optional

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
    Supports gzip and zip compression. Memory-efficient streaming for large files.
    """

    @staticmethod
    @contextmanager
    def _decompress(file_obj, key: str):
        """Decompress file if needed. Handles gzip and zip transparently."""
        if key.endswith(".gz"):
            with gzip.GzipFile(fileobj=file_obj) as decompressed:
                yield decompressed
        elif key.endswith(".zip"):
            with zipfile.ZipFile(file_obj) as zf:
                json_files = [
                    n for n in zf.namelist() if n.endswith((".json", ".jsonl"))
                ]
                if not json_files:
                    raise ValueError("No JSON files found in zip archive")
                with zf.open(json_files[0]) as decompressed:
                    yield decompressed
        else:
            yield file_obj

    @staticmethod
    def _stream_json_lines(
        file_obj, batch_size: int = CHUNKSIZE
    ) -> Iterator["DataFrame"]:
        """Stream JSON Lines in batches. Memory efficient."""
        from pandas import DataFrame

        batch = []
        while True:
            line = file_obj.readline()
            if not line:
                break

            line = (
                line.decode(UTF_8, errors="ignore") if isinstance(line, bytes) else line
            )
            line = line.strip()
            if not line:
                logger.debug("Skipping empty line while reading JSON Lines.")
                continue
            try:
                batch.append(json.loads(line))
                if len(batch) >= batch_size:
                    yield DataFrame.from_records(batch)
                    batch = []
            except json.JSONDecodeError as error:
                logger.info(
                    f"Skipping invalid JSON line {line} due to an error: {error}"
                )
        if batch:
            yield DataFrame.from_records(batch)

    @staticmethod
    def _stream_json_array(
        file_obj, batch_size: int = CHUNKSIZE
    ) -> Iterator["DataFrame"]:
        """Stream large JSON arrays using ijson. Memory efficient."""
        import ijson
        from pandas import DataFrame

        batch = []
        for record in ijson.items(file_obj, "item"):
            batch.append(record)
            if len(batch) >= batch_size:
                yield DataFrame.from_records(batch)
                batch = []
        if batch:
            yield DataFrame.from_records(batch)

    @staticmethod
    def _read_json_object(
        content: bytes,
    ) -> tuple[Generator["DataFrame", Any, None], Optional[str]]:
        """Load entire JSON object/array. Non-streaming fallback for small files."""
        from pandas import DataFrame

        content = (
            content.decode(UTF_8, errors="ignore")
            if isinstance(content, bytes)
            else content
        )
        data = json.loads(content)
        raw_data = content if isinstance(data, dict) and data.get("$schema") else None
        data = [data] if isinstance(data, dict) else data

        def chunk_generator():
            for i in range(0, len(data), CHUNKSIZE):
                yield DataFrame.from_records(data[i : i + CHUNKSIZE])

        return chunk_generator, raw_data

    @staticmethod
    def _is_json_lines(file_obj) -> bool:
        """Check if file is JSON Lines by reading first line."""
        first_line = file_obj.readline()
        if isinstance(first_line, bytes):
            first_line = first_line.decode(UTF_8, errors="ignore")
        first_line = first_line.strip()
        if not first_line:
            return True
        try:
            obj = json.loads(first_line)
            return isinstance(obj, dict) and not obj.get("$schema")
        except json.JSONDecodeError:
            return False

    def _read_json_smart(
        self, file_obj_getter, key: str, bucket_name: str
    ) -> DatalakeColumnWrapper:
        """
        Smart JSON reading with automatic format detection and streaming.
        Handles JSON Lines, arrays, and objects efficiently.
        """
        with file_obj_getter() as f:
            with self._decompress(f, key) as decompressed:
                is_json_lines = self._is_json_lines(decompressed)

        if is_json_lines:

            def chunk_generator():
                with file_obj_getter() as f:
                    with self._decompress(f, key) as decompressed:
                        yield from self._stream_json_lines(decompressed)

            return DatalakeColumnWrapper(
                dataframes=chunk_generator, raw_data=None, columns=None
            )

        file_size_mb = self._get_file_size_mb(key, bucket_name)
        if file_size_mb > (MAX_FILE_SIZE_FOR_PREVIEW / (1024 * 1024)):
            logger.info(
                f"Large JSON file ({file_size_mb:.2f} MB). Streaming with ijson."
            )
            try:

                def ijson_chunk_generator():
                    with file_obj_getter() as f:
                        with self._decompress(f, key) as decompressed:
                            yield from self._stream_json_array(decompressed)

                return DatalakeColumnWrapper(
                    dataframes=ijson_chunk_generator, raw_data=None, columns=None
                )
            except Exception as exc:
                logger.warning(
                    f"ijson streaming failed: {exc}. Loading entire file (may cause OOM)."
                )

        with file_obj_getter() as f:
            with self._decompress(f, key) as decompressed:
                content = decompressed.read()
        dataframes, raw_data = self._read_json_object(content)
        return DatalakeColumnWrapper(
            dataframes=dataframes, raw_data=raw_data, columns=None
        )

    @singledispatchmethod
    def _read_json_dispatch(
        self, config_source: ConfigSource, key: str, bucket_name: str
    ) -> DatalakeColumnWrapper:
        raise FileFormatException(config_source=config_source, file_name=key)

    @_read_json_dispatch.register
    def _(self, _: S3Config, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        @contextmanager
        def get_stream():
            response = self.client.get_object(Bucket=bucket_name, Key=key)
            try:
                yield response["Body"]
            finally:
                response["Body"].close()

        return self._read_json_smart(get_stream, key, bucket_name)

    @_read_json_dispatch.register
    def _(self, _: GCSConfig, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        from gcsfs import GCSFileSystem

        gcs = GCSFileSystem()
        file_path = f"gs://{bucket_name}/{key}"

        @contextmanager
        def get_stream():
            with gcs.open(file_path, "rb") as f:
                yield f

        return self._read_json_smart(get_stream, key, bucket_name)

    @_read_json_dispatch.register
    def _(self, _: AzureConfig, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        from adlfs import AzureBlobFileSystem

        storage_options = return_azure_storage_options(self.config_source)
        adlfs_fs = AzureBlobFileSystem(
            account_name=self.config_source.securityConfig.accountName,
            **storage_options,
        )
        file_path = f"{bucket_name}/{key}"

        @contextmanager
        def get_stream():
            with adlfs_fs.open(file_path, "rb") as f:
                yield f

        return self._read_json_smart(get_stream, key, bucket_name)

    @_read_json_dispatch.register
    def _(
        self,
        _: LocalConfig,
        key: str,
        bucket_name: str,  # pylint: disable=unused-argument
    ) -> DatalakeColumnWrapper:
        @contextmanager
        def get_stream():
            with open(key, "rb") as f:
                yield f

        return self._read_json_smart(get_stream, key, bucket_name)

    def _read(self, *, key: str, bucket_name: str, **__) -> DatalakeColumnWrapper:
        return self._read_json_dispatch(
            self.config_source, key=key, bucket_name=bucket_name
        )
