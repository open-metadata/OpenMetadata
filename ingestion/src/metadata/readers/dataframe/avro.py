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
Avro DataFrame reader
"""
import io

from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.type.schema import DataTypeTopic
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

PD_AVRO_FIELD_MAP = {
    DataTypeTopic.BOOLEAN.value: "bool",
    DataTypeTopic.INT.value: "int",
    DataTypeTopic.LONG.value: "float",
    DataTypeTopic.FLOAT.value: "float",
    DataTypeTopic.DOUBLE.value: "float",
    DataTypeTopic.TIMESTAMP.value: "float",
    DataTypeTopic.TIMESTAMPZ.value: "float",
}

AVRO_SCHEMA = "avro.schema"


class AvroDataFrameReader(DataFrameReader):
    """
    Manage the implementation to read Avro dataframes
    from any source based on its init client with memory-safe approach.
    """

    def _get_streaming_file_object(self, key: str, bucket_name: str):
        """
        Get a streaming file object from the underlying storage client.
        This avoids loading the entire file into memory.
        """
        try:
            # Try to get streaming access based on reader type
            if hasattr(self.reader, "client"):
                client = self.reader.client

                # S3 streaming
                if hasattr(client, "get_object"):
                    response = client.get_object(Bucket=bucket_name, Key=key)
                    return response["Body"]

                # GCS streaming
                elif hasattr(client, "bucket"):
                    bucket = client.bucket(bucket_name)
                    blob = bucket.blob(key)
                    return blob.open("rb")

                # ADLS streaming
                elif hasattr(client, "get_file_client"):
                    file_client = client.get_file_client(key)
                    return file_client.download_file()

            # Fallback to regular read if streaming not available
            logger.warning(
                f"Streaming not available for reader type {type(self.reader)}. Using regular read."
            )
            return io.BytesIO(self.reader.read(key, bucket_name=bucket_name))

        except Exception as exc:
            logger.warning(
                f"Failed to get streaming access: {exc}. Falling back to regular read."
            )
            return io.BytesIO(self.reader.read(key, bucket_name=bucket_name))

    def _read_avro_streaming(
        self, key: str, bucket_name: str, chunk_size: int = CHUNK_SIZE_ROWS
    ) -> DatalakeColumnWrapper:
        """
        Read AVRO data in chunks directly from storage to avoid memory issues with large files.
        """
        # pylint: disable=import-outside-toplevel
        from avro.datafile import DataFileReader
        from avro.errors import InvalidAvroBinaryEncoding
        from avro.io import DatumReader
        from pandas import DataFrame, Series

        from metadata.parsers.avro_parser import parse_avro_schema

        try:
            # Get streaming file object
            file_obj = self._get_streaming_file_object(key, bucket_name)

            # Create AVRO reader from streaming object
            elements = DataFileReader(file_obj, DatumReader())
            schema_data = elements.meta.get(AVRO_SCHEMA)

            # Parse schema if available
            columns = None
            if schema_data:
                columns = parse_avro_schema(
                    schema=schema_data.decode(UTF_8), cls=Column
                )

            # Read data in chunks
            chunks = []
            current_chunk = []
            record_count = 0

            logger.info(f"Processing AVRO file {key} in chunks of {chunk_size} records")

            for record in elements:
                current_chunk.append(record)
                record_count += 1

                # Process chunk when it reaches the desired size
                if len(current_chunk) >= chunk_size:
                    chunk_df = DataFrame.from_records(current_chunk)
                    chunks.extend(dataframe_to_chunks(chunk_df))
                    current_chunk = []
                    logger.debug(
                        f"Processed chunk, total records so far: {record_count}"
                    )

            # Process remaining records
            if current_chunk:
                chunk_df = DataFrame.from_records(current_chunk)
                chunks.extend(dataframe_to_chunks(chunk_df))

            logger.info(
                f"Successfully processed {record_count} records in {len(chunks)} chunks from AVRO file {key}"
            )

            return DatalakeColumnWrapper(columns=columns, dataframes=chunks)

        except (AssertionError, InvalidAvroBinaryEncoding) as exc:
            # Fallback to schema-only parsing
            logger.warning(
                f"Could not read AVRO data from stream: {exc}. Using schema-only parsing"
            )
            try:
                # Read just enough to get schema for schema-only parsing
                small_sample = self.reader.read(key, bucket_name=bucket_name)
                columns = parse_avro_schema(schema=small_sample, cls=Column)
                field_map = {
                    col.name.root: Series(
                        PD_AVRO_FIELD_MAP.get(col.dataType.value, "str")
                    )
                    for col in columns
                }
                return DatalakeColumnWrapper(
                    columns=columns,
                    dataframes=dataframe_to_chunks(DataFrame(field_map)),
                )
            except Exception as fallback_exc:
                logger.error(f"Failed to parse AVRO schema: {fallback_exc}")
                raise fallback_exc
        except Exception as exc:
            logger.warning(
                f"Streaming AVRO reading failed: {exc}. Falling back to regular reading"
            )
            # Fallback to regular method
            avro_text = self.reader.read(key, bucket_name=bucket_name)
            return self.read_from_avro(avro_text)

    @staticmethod
    def read_from_avro(avro_text: bytes) -> DatalakeColumnWrapper:
        """
        Method to parse the avro data from storage sources (original method for small files)
        """
        # pylint: disable=import-outside-toplevel
        from avro.datafile import DataFileReader
        from avro.errors import InvalidAvroBinaryEncoding
        from avro.io import DatumReader
        from pandas import DataFrame, Series

        from metadata.parsers.avro_parser import parse_avro_schema

        try:
            elements = DataFileReader(io.BytesIO(avro_text), DatumReader())
            if elements.meta.get(AVRO_SCHEMA):
                return DatalakeColumnWrapper(
                    columns=parse_avro_schema(
                        schema=elements.meta.get(AVRO_SCHEMA).decode(UTF_8), cls=Column
                    ),
                    dataframes=dataframe_to_chunks(DataFrame.from_records(elements)),
                )
            return DatalakeColumnWrapper(
                dataframes=dataframe_to_chunks(DataFrame.from_records(elements))
            )
        except (AssertionError, InvalidAvroBinaryEncoding):
            columns = parse_avro_schema(schema=avro_text, cls=Column)
            field_map = {
                col.name.root: Series(PD_AVRO_FIELD_MAP.get(col.dataType.value, "str"))
                for col in columns
            }
            return DatalakeColumnWrapper(
                columns=columns, dataframes=dataframe_to_chunks(DataFrame(field_map))
            )

    def _get_file_size_from_reader(self, key: str, bucket_name: str) -> int:
        """
        Get file size before reading the content.
        """
        try:
            # Try different methods based on storage type
            if hasattr(self.reader, "client"):
                client = self.reader.client

                # S3 head_object
                if hasattr(client, "head_object"):
                    response = client.head_object(Bucket=bucket_name, Key=key)
                    return response.get("ContentLength", 0)

                # GCS blob size
                elif hasattr(client, "bucket"):
                    bucket = client.bucket(bucket_name)
                    blob = bucket.blob(key)
                    blob.reload()
                    return blob.size or 0

                # ADLS file properties
                elif hasattr(client, "get_file_client"):
                    file_client = client.get_file_client(key)
                    properties = file_client.get_file_properties()
                    return properties.size or 0

            # Fallback methods
            if hasattr(self.reader, "get_file_size"):
                return self.reader.get_file_size(key, bucket_name)
            elif hasattr(self.reader, "_get_file_info"):
                file_info = self.reader._get_file_info(key, bucket_name)
                return file_info.get("size", 0) if file_info else 0
            else:
                return 0

        except Exception as exc:
            logger.warning(f"Could not determine file size for {key}: {exc}")
            return 0

    def _should_use_chunking(self, file_size: int) -> bool:
        """
        Determine if chunking should be used for a given file size.
        """
        return file_size > MAX_FILE_SIZE_FOR_MEMORY_LOADING

    def _read(self, *, key: str, bucket_name: str, **__) -> DatalakeColumnWrapper:
        # Check file size first to determine reading strategy
        file_size = self._get_file_size_from_reader(key, bucket_name)

        if self._should_use_chunking(file_size):
            logger.info(
                f"Large AVRO file ({file_size} bytes > {MAX_FILE_SIZE_FOR_MEMORY_LOADING} bytes). Using streaming approach"
            )

            # Use streaming approach that doesn't load entire file into memory
            return self._read_avro_streaming(key, bucket_name)
        else:
            # For small files, use original method
            logger.debug(f"Reading small AVRO file ({file_size} bytes) directly")
            text = self.reader.read(key, bucket_name=bucket_name)
            return self.read_from_avro(text)
