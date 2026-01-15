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
Avro DataFrame reader - streams records in batches to avoid OOM
"""
from functools import singledispatchmethod
from typing import Iterator, List, Optional

from metadata.generated.schema.entity.data.table import Column
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
from metadata.generated.schema.type.schema import DataTypeTopic
from metadata.readers.dataframe.base import DataFrameReader, FileFormatException
from metadata.readers.dataframe.models import DatalakeColumnWrapper
from metadata.readers.file.adls import return_azure_storage_options
from metadata.readers.file.s3 import return_s3_storage_options
from metadata.readers.models import ConfigSource
from metadata.utils.constants import CHUNKSIZE

PD_AVRO_FIELD_MAP = {
    DataTypeTopic.BOOLEAN.value: "bool",
    DataTypeTopic.INT.value: "int",
    DataTypeTopic.LONG.value: "float",
    DataTypeTopic.FLOAT.value: "float",
    DataTypeTopic.DOUBLE.value: "float",
    DataTypeTopic.TIMESTAMP.value: "float",
    DataTypeTopic.TIMESTAMPZ.value: "float",
}


class AvroDataFrameReader(DataFrameReader):
    """
    Manage the implementation to read Avro dataframes
    from any source based on its init client.
    Streams records in batches to avoid loading entire file into memory.
    """

    @staticmethod
    def _stream_avro_records(
        file_obj, batch_size: int = CHUNKSIZE
    ) -> Iterator["DataFrame"]:
        """
        Stream Avro records in batches from a file-like object.
        Uses fastavro for streaming support.
        """
        import fastavro
        from pandas import DataFrame

        batch = []
        for record in fastavro.reader(file_obj):
            batch.append(record)
            if len(batch) >= batch_size:
                yield DataFrame.from_records(batch)
                batch = []
        if batch:
            yield DataFrame.from_records(batch)

    @staticmethod
    def _get_avro_columns(file_obj) -> Optional[List[Column]]:
        """Extract columns from Avro schema without reading all records."""
        import json

        import fastavro
        from pandas import DataFrame

        from metadata.parsers.avro_parser import parse_avro_schema

        try:
            reader = fastavro.reader(file_obj)
            if reader.writer_schema:
                writer_schema = reader.writer_schema
                if isinstance(writer_schema, dict):
                    writer_schema = json.dumps(reader.writer_schema)

                return parse_avro_schema(schema=writer_schema, cls=Column)
        except Exception:
            pass
        return None

    @singledispatchmethod
    def _read_avro_dispatch(
        self, config_source: ConfigSource, key: str, bucket_name: str
    ) -> DatalakeColumnWrapper:
        raise FileFormatException(config_source=config_source, file_name=key)

    @_read_avro_dispatch.register
    def _(self, _: S3Config, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        """Stream Avro from S3 without loading entire file into memory."""
        from s3fs import S3FileSystem

        storage_options = return_s3_storage_options(self.config_source)
        s3 = S3FileSystem(**storage_options)
        file_path = f"s3://{bucket_name}/{key}"

        with s3.open(file_path, "rb") as f:
            columns = self._get_avro_columns(f)

        def chunk_generator():
            response = self.client.get_object(Bucket=bucket_name, Key=key)
            file_stream = response["Body"]
            yield from self._stream_avro_records(file_stream)

        return DatalakeColumnWrapper(
            columns=columns,
            dataframes=chunk_generator,
        )

    @_read_avro_dispatch.register
    def _(self, _: GCSConfig, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        """Stream Avro from GCS without loading entire file into memory."""
        from gcsfs import GCSFileSystem

        gcs = GCSFileSystem()
        file_path = f"gs://{bucket_name}/{key}"

        with gcs.open(file_path, "rb") as f:
            columns = self._get_avro_columns(f)

        def chunk_generator():
            with gcs.open(file_path, "rb") as f:
                yield from self._stream_avro_records(f)

        return DatalakeColumnWrapper(columns=columns, dataframes=chunk_generator)

    @_read_avro_dispatch.register
    def _(self, _: AzureConfig, key: str, bucket_name: str) -> DatalakeColumnWrapper:
        """Stream Avro from Azure without loading entire file into memory."""
        from adlfs import AzureBlobFileSystem

        storage_options = return_azure_storage_options(self.config_source)
        adlfs_fs = AzureBlobFileSystem(
            account_name=self.config_source.securityConfig.accountName,
            **storage_options,
        )
        file_path = f"{bucket_name}/{key}"

        with adlfs_fs.open(file_path, "rb") as f:
            columns = self._get_avro_columns(f)

        def chunk_generator():
            with adlfs_fs.open(file_path, "rb") as f:
                yield from self._stream_avro_records(f)

        return DatalakeColumnWrapper(columns=columns, dataframes=chunk_generator)

    @_read_avro_dispatch.register
    def _(
        self,
        _: LocalConfig,
        key: str,
        bucket_name: str,  # pylint: disable=unused-argument
    ) -> DatalakeColumnWrapper:
        """Stream Avro from local filesystem without loading entire file into memory."""
        with open(key, "rb") as f:
            columns = self._get_avro_columns(f)

        def chunk_generator():
            with open(key, "rb") as f:
                yield from self._stream_avro_records(f)

        return DatalakeColumnWrapper(columns=columns, dataframes=chunk_generator)

    def _read(self, *, key: str, bucket_name: str, **__) -> DatalakeColumnWrapper:
        return self._read_avro_dispatch(
            self.config_source, key=key, bucket_name=bucket_name
        )
