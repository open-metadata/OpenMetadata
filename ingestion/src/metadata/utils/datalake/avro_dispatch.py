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
Module to define helper methods for datalake and to fetch data and metadata 
from Avro file formats
"""


import io
from functools import singledispatch
from typing import Any

from avro.datafile import DataFileReader
from avro.errors import InvalidAvroBinaryEncoding
from avro.io import DatumReader

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
from metadata.generated.schema.type.schema import DataTypeTopic
from metadata.ingestion.source.database.datalake.models import DatalakeColumnWrapper
from metadata.parsers.avro_parser import parse_avro_schema
from metadata.utils.constants import UTF_8
from metadata.utils.datalake.datalake_utils import DatalakeFileFormatException
from metadata.utils.logger import utils_logger

logger = utils_logger()

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


def read_from_avro(
    avro_text: bytes,
) -> DatalakeColumnWrapper:
    """
    Method to parse the avro data from storage sources
    """
    # pylint: disable=import-outside-toplevel
    from pandas import DataFrame, Series

    try:
        elements = DataFileReader(io.BytesIO(avro_text), DatumReader())
        if elements.meta.get(AVRO_SCHEMA):
            return DatalakeColumnWrapper(
                columns=parse_avro_schema(
                    schema=elements.meta.get(AVRO_SCHEMA).decode(UTF_8), cls=Column
                ),
                dataframes=DataFrame.from_records(elements),
            )
        return DatalakeColumnWrapper(dataframes=DataFrame.from_records(elements))
    except (AssertionError, InvalidAvroBinaryEncoding):
        columns = parse_avro_schema(schema=avro_text, cls=Column)
        field_map = {
            col.name.__root__: Series(PD_AVRO_FIELD_MAP.get(col.dataType.value, "str"))
            for col in columns
        }
        return DatalakeColumnWrapper(columns=columns, dataframes=DataFrame(field_map))


@singledispatch
def read_avro_dispatch(config_source: Any, key: str, **kwargs):
    raise DatalakeFileFormatException(config_source=config_source, file_name=key)


@read_avro_dispatch.register
def _(_: GCSConfig, key: str, bucket_name: str, client, **kwargs):
    """
    Read the avro file from the gcs bucket and return a dataframe
    """
    from metadata.utils.datalake.datalake_utils import dataframe_to_chunks

    avro_text = client.get_bucket(bucket_name).get_blob(key).download_as_string()
    return dataframe_to_chunks(read_from_avro(avro_text).dataframes)


@read_avro_dispatch.register
def _(_: S3Config, key: str, bucket_name: str, client, **kwargs):
    from metadata.utils.datalake.datalake_utils import dataframe_to_chunks

    avro_text = client.get_object(Bucket=bucket_name, Key=key)["Body"].read()
    return dataframe_to_chunks(read_from_avro(avro_text).dataframes)


@read_avro_dispatch.register
def _(_: AzureConfig, key: str, bucket_name: str, client, **kwargs):
    from metadata.utils.datalake.datalake_utils import dataframe_to_chunks

    container_client = client.get_container_client(bucket_name)
    avro_text = container_client.get_blob_client(key).download_blob().readall()
    return dataframe_to_chunks(read_from_avro(avro_text).dataframes)
