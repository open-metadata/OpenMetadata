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
JSON DataFrame reader
"""
import gzip
import io
import json
import zipfile
from typing import Any, Dict, List, Optional, Tuple, Union

from metadata.readers.dataframe.base import (
    CHUNK_SIZE_ROWS,
    MAX_FILE_SIZE_FOR_MEMORY_LOADING,
    DataFrameReader,
)
from metadata.readers.dataframe.common import dataframe_to_chunks
from metadata.readers.dataframe.models import DatalakeColumnWrapper
from metadata.utils.constants import UTF_8
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def _get_json_text(key: str, text: bytes, decode: bool) -> Union[str, bytes]:
    processed_text: Union[str, bytes] = text
    if key.endswith(".gz"):
        processed_text = gzip.decompress(text)
    if key.endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(text)) as zip_file:
            processed_text = zip_file.read(zip_file.infolist()[0])
    if decode:
        return (
            processed_text.decode(UTF_8, errors="ignore")
            if isinstance(text, bytes)
            else text
        )
    return processed_text


class JSONDataFrameReader(DataFrameReader):
    """
    Read JSON DFs with memory-safe approach for large files
    """

    def _read_json_streaming(
        self, json_text: Union[str, bytes], chunk_size: int = CHUNK_SIZE_ROWS
    ) -> List["DataFrame"]:
        """
        Read JSON data in chunks to avoid memory issues with large files.
        """
        # pylint: disable=import-outside-toplevel
        import pandas as pd

        chunks = []

        try:
            # Try to parse as JSON Lines first (each line is a JSON object)
            if isinstance(json_text, bytes):
                json_text = json_text.decode(UTF_8, errors="ignore")

            lines = json_text.strip().split("\n")

            # Process in chunks for JSON Lines
            if len(lines) > 1:
                logger.info(
                    f"Processing JSON Lines format with {len(lines)} lines in chunks"
                )

                for i in range(0, len(lines), chunk_size):
                    chunk_lines = lines[i : i + chunk_size]
                    chunk_data = []

                    for line in chunk_lines:
                        try:
                            if line.strip():
                                chunk_data.append(json.loads(line))
                        except json.JSONDecodeError as exc:
                            logger.warning(f"Skipping invalid JSON line: {exc}")
                            continue

                    if chunk_data:
                        chunk_df = pd.DataFrame.from_records(chunk_data)
                        chunks.extend(dataframe_to_chunks(chunk_df))

                logger.info(
                    f"Successfully processed {len(chunks)} chunks from JSON Lines"
                )
                return chunks

            # Single JSON object - try to parse directly
            else:
                data = json.loads(json_text)
                # if we get a scalar value (e.g. {"a":"b"}) then we need to specify the index
                data = data if not isinstance(data, dict) else [data]
                return dataframe_to_chunks(pd.DataFrame.from_records(data))

        except json.JSONDecodeError:
            logger.warning(
                "Failed to parse as JSON Lines, trying as single JSON object"
            )
            try:
                data = json.loads(json_text)
                data = data if not isinstance(data, dict) else [data]
                return dataframe_to_chunks(pd.DataFrame.from_records(data))
            except json.JSONDecodeError as exc:
                logger.error(f"Failed to parse JSON: {exc}")
                raise exc

    @staticmethod
    def read_from_json(
        key: str, json_text: bytes, decode: bool = False, **__
    ) -> Tuple[List["DataFrame"], Optional[Dict[str, Any]]]:
        """
        Decompress a JSON file (if needed) and read its contents
        as a dataframe.

        Note that for the metadata we need to flag nested columns with a
        custom separator. For the profiler this is not needed. We require the
        correct column name to match with the metadata description.
        """
        # pylint: disable=import-outside-toplevel
        import pandas as pd

        json_text = _get_json_text(key=key, text=json_text, decode=decode)
        raw_data = None
        try:
            data = json.loads(json_text)
            if isinstance(data, dict) and data.get("$schema"):
                raw_data = json_text
        except json.decoder.JSONDecodeError:
            logger.debug("Failed to read as JSON object. Trying to read as JSON Lines")
            data = [json.loads(json_obj) for json_obj in json_text.strip().split("\n")]

        # if we get a scalar value (e.g. {"a":"b"}) then we need to specify the index
        data = data if not isinstance(data, dict) else [data]
        return dataframe_to_chunks(pd.DataFrame.from_records(data)), raw_data

    def _get_file_size_from_reader(self, key: str, bucket_name: str) -> int:
        """
        Get file size before reading the content. Override for different storage types.
        """
        try:
            # Try to get file size without reading content
            if hasattr(self.reader, "get_file_size"):
                return self.reader.get_file_size(key, bucket_name)
            elif hasattr(self.reader, "_get_file_info"):
                file_info = self.reader._get_file_info(key, bucket_name)
                return file_info.get("size", 0) if file_info else 0
            else:
                # Fallback - estimate based on whether we should read it
                return 0
        except Exception as exc:
            logger.warning(f"Could not determine file size for {key}: {exc}")
            return 0

    def _should_use_chunking(self, file_size: int) -> bool:
        """
        Determine if chunking should be used for a given file size.
        """
        return file_size > MAX_FILE_SIZE_FOR_MEMORY_LOADING

    def _read(self, *, key: str, bucket_name: str, **kwargs) -> DatalakeColumnWrapper:
        # Check file size first to determine reading strategy
        file_size = self._get_file_size_from_reader(key, bucket_name)

        if self._should_use_chunking(file_size):
            logger.info(
                f"Large JSON file ({file_size} bytes > {MAX_FILE_SIZE_FOR_MEMORY_LOADING} bytes). Using streaming approach"
            )

            # For large files, read and process in streaming mode
            text = self.reader.read(key, bucket_name=bucket_name)
            json_text = _get_json_text(key=key, text=text, decode=True)

            # Use streaming approach for large files
            dataframes = self._read_json_streaming(json_text)

            return DatalakeColumnWrapper(
                dataframes=dataframes,
                raw_data=json_text
                if len(json_text) < 1000
                else None,  # Only store raw data for small files
            )
        else:
            # For small files, use original method
            logger.debug(f"Reading small JSON file ({file_size} bytes) directly")
            text = self.reader.read(key, bucket_name=bucket_name)
            dataframes, raw_data = self.read_from_json(
                key=key, json_text=text, decode=True, **kwargs
            )
            return DatalakeColumnWrapper(
                dataframes=dataframes,
                raw_data=raw_data,
            )
