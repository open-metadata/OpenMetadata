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
Module to define helper methods for datalake and to fetch data and metadata from different auths and different file systems.
"""


import gzip
import io
import json
import zipfile
from functools import singledispatch
from typing import Any, Dict, List

import pandas as pd
from avro.datafile import DataFileReader
from avro.errors import InvalidAvroBinaryEncoding
from avro.io import DatumReader
from pandas import DataFrame

from metadata.generated.schema.entity.data.table import Column, Table
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
from metadata.ingestion.source.database.datalake.models import (
    DatalakeColumnWrapper,
    DatalakeTableSchemaWrapper,
)
from metadata.parsers.avro_parser import parse_avro_schema
from metadata.utils.constants import CHUNKSIZE, UTF_8
from metadata.utils.logger import utils_logger

logger = utils_logger()
TSV_SEPARATOR = "\t"
CSV_SEPARATOR = ","
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
COMPLEX_COLUMN_SEPARATOR = "_##"
JSON_SUPPORTED_TYPES = (".json", ".json.gz", ".json.zip")

logger = utils_logger()


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
        return DataFrame.from_records(elements)
    except (AssertionError, InvalidAvroBinaryEncoding):
        columns = parse_avro_schema(schema=avro_text, cls=Column)
        field_map = {
            col.name.__root__: Series(PD_AVRO_FIELD_MAP.get(col.dataType.value, "str"))
            for col in columns
        }
        return DataFrame(field_map)


def return_azure_storage_options(config_source: Any) -> Dict:
    connection_args = config_source.securityConfig
    return {
        "tenant_id": connection_args.tenantId,
        "client_id": connection_args.clientId,
        "client_secret": connection_args.clientSecret.get_secret_value(),
    }


def read_from_pandas(path: str, separator: str, storage_options=None):
    chunk_list = []
    with pd.read_csv(
        path, sep=separator, chunksize=CHUNKSIZE, storage_options=storage_options
    ) as reader:
        for chunks in reader:
            chunk_list.append(chunks)
    return chunk_list


def dataframe_to_chunks(df: DataFrame):
    """
    Reads the Dataframe and returns list of dataframes broken down in chunks
    """
    return [
        df[range_iter : range_iter + CHUNKSIZE]
        for range_iter in range(0, len(df), CHUNKSIZE)
    ]


def _get_json_text(key: str, text: bytes, decode: bool) -> str:
    if key.endswith(".gz"):
        return gzip.decompress(text)
    if key.endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(text)) as zip_file:
            return zip_file.read(zip_file.infolist()[0]).decode(UTF_8)
    if decode:
        return text.decode(UTF_8)
    return text


def read_from_json(key: str, json_text: str, decode: bool = False) -> List:
    """
    Read the json file from the azure container and return a dataframe
    """

    # pylint: disable=import-outside-toplevel
    from pandas import json_normalize

    json_text = _get_json_text(key, json_text, decode)
    try:
        data = json.loads(json_text)
    except json.decoder.JSONDecodeError:
        logger.debug("Failed to read as JSON object trying to read as JSON Lines")
        data = [json.loads(json_obj) for json_obj in json_text.strip().split("\n")]
    return dataframe_to_chunks(json_normalize(data, sep=COMPLEX_COLUMN_SEPARATOR))


@singledispatch
def read_csv_dispatch(config_source: Any, **kwargs):
    raise NotImplementedError(
        f"Didn't Implement {config_source.__class__.__name__} for CSV"
    )


@singledispatch
def read_tsv_dispatch(config_source: Any, **kwargs):
    raise NotImplementedError(
        f"Didn't Implement {config_source.__class__.__name__} for TSV"
    )


@singledispatch
def read_avro_dispatch(config_source: Any, **kwargs):
    raise NotImplementedError(
        f"Didn't Implement {config_source.__class__.__name__} for AVRO"
    )


@singledispatch
def read_parquet_dispatch(config_source: Any, **kwargs):
    raise NotImplementedError(
        f"Didn't Implement {config_source.__class__.__name__} for PARQUET"
    )


@singledispatch
def read_json_dispatch(config_source: Any, **kwargs):
    raise NotImplementedError(
        f"Didn't Implement {config_source.__class__.__name__} for JSON"
    )


@read_csv_dispatch.register
def _(_: GCSConfig, key: str, bucket_name: str, **kwargs):
    """
    Read the CSV file from the gcs bucket and return a dataframe
    """
    path = f"gs://{bucket_name}/{key}"
    return read_from_pandas(path=path, separator=CSV_SEPARATOR)


@read_csv_dispatch.register
def _(_: S3Config, key: str, bucket_name: str, client):
    path = client.get_object(Bucket=bucket_name, Key=key)["Body"]
    return read_from_pandas(path=path, separator=CSV_SEPARATOR)


@read_csv_dispatch.register
def _(config_source: AzureConfig, key: str, bucket_name: str, client):
    path = f"abfs://{bucket_name}@{client.account_name}.dfs.core.windows.net/{key}"
    storage_options = return_azure_storage_options(config_source)
    return read_from_pandas(
        path=path, separator=CSV_SEPARATOR, storage_options=storage_options
    )


@read_tsv_dispatch.register
def _(_: GCSConfig, key: str, bucket_name: str, **kwargs):
    """
    Read the TSV file from the gcs bucket and return a dataframe
    """
    path = f"gs://{bucket_name}/{key}"
    return read_from_pandas(path=path, separator=TSV_SEPARATOR)


@read_tsv_dispatch.register
def _(_: S3Config, key: str, bucket_name: str, client):
    path = client.get_object(Bucket=bucket_name, Key=key)["Body"]
    return read_from_pandas(path=path, separator=TSV_SEPARATOR)


@read_tsv_dispatch.register
def _(config_source: AzureConfig, key: str, bucket_name: str, client):
    path = f"abfs://{bucket_name}@{client.account_name}.dfs.core.windows.net/{key}"
    storage_options = return_azure_storage_options(config_source)
    return read_from_pandas(
        path=path, separator=TSV_SEPARATOR, storage_options=storage_options
    )


@read_avro_dispatch.register
def _(_: GCSConfig, key: str, bucket_name: str, client):
    """
    Read the avro file from the gcs bucket and return a dataframe
    """
    avro_text = client.get_bucket(bucket_name).get_blob(key).download_as_string()
    return dataframe_to_chunks(read_from_avro(avro_text))


@read_avro_dispatch.register
def _(_: S3Config, key: str, bucket_name: str, client):
    avro_text = client.get_object(Bucket=bucket_name, Key=key)["Body"].read()
    return dataframe_to_chunks(read_from_avro(avro_text))


@read_avro_dispatch.register
def _(_: AzureConfig, key: str, bucket_name: str, client):
    container_client = client.get_container_client(bucket_name)
    avro_text = container_client.get_blob_client(key).download_blob().readall()
    return dataframe_to_chunks(read_from_avro(avro_text))


@read_parquet_dispatch.register
def _(_: GCSConfig, key: str, bucket_name: str, **kwargs):
    """
    Read the parquet file from the gcs bucket and return a dataframe
    """
    from gcsfs import GCSFileSystem
    from pyarrow.parquet import ParquetFile

    gcs = GCSFileSystem()
    file = gcs.open(f"gs://{bucket_name}/{key}")
    dataframe_response = (
        ParquetFile(file).read().to_pandas(split_blocks=True, self_destruct=True)
    )
    return dataframe_to_chunks(dataframe_response)


@read_parquet_dispatch.register
def _(_: S3Config, key: str, bucket_name: str, client):
    """
    Read the parquet file from the s3 bucket and return a dataframe
    """
    import s3fs
    from pyarrow.parquet import ParquetDataset

    client_kwargs = {}
    if client.endPointURL:
        client_kwargs["endpoint_url"] = client.endPointURL

    if client.awsRegion:
        client_kwargs["region_name"] = client.awsRegion

    s3_fs = s3fs.S3FileSystem(client_kwargs=client_kwargs)

    if client.awsAccessKeyId and client.awsSecretAccessKey:
        s3_fs = s3fs.S3FileSystem(
            key=client.awsAccessKeyId,
            secret=client.awsSecretAccessKey.get_secret_value(),
            token=client.awsSessionToken,
            client_kwargs=client_kwargs,
        )
    bucket_uri = f"s3://{bucket_name}/{key}"
    dataset = ParquetDataset(bucket_uri, filesystem=s3_fs)
    return dataframe_to_chunks(dataset.read_pandas().to_pandas())


@read_parquet_dispatch.register
def _(config_source: AzureConfig, key: str, bucket_name: str, client):
    account_url = (
        f"abfs://{bucket_name}@{client.account_name}.dfs.core.windows.net/{key}"
    )
    storage_options = return_azure_storage_options(config_source)
    dataframe = pd.read_parquet(account_url, storage_options=storage_options)
    return dataframe_to_chunks(dataframe)


@read_json_dispatch.register
def _(_: GCSConfig, key: str, bucket_name: str, client):
    """
    Read the json file from the gcs bucket and return a dataframe
    """
    json_text = client.get_bucket(bucket_name).get_blob(key).download_as_string()
    return read_from_json(key=key, json_text=json_text, decode=True)


@read_json_dispatch.register
def _(_: S3Config, key: str, bucket_name: str, client):
    json_text = client.get_object(Bucket=bucket_name, Key=key)["Body"].read()
    return read_from_json(key=key, json_text=json_text, decode=True)


@read_json_dispatch.register
def _(_: AzureConfig, key: str, bucket_name: str, client):
    container_client = client.get_container_client(bucket_name)
    json_text = container_client.get_blob_client(key).download_blob().readall()
    return read_from_json(key=key, json_text=json_text, decode=True)


# adding multiple json types as keys as we support multiple json formats
FILE_FORMAT_DISPATCH_MAP = {
    ".csv": read_csv_dispatch,
    ".tsv": read_tsv_dispatch,
    ".avro": read_avro_dispatch,
    ".parquet": read_parquet_dispatch,
    ".json": read_json_dispatch,
    ".json.gz": read_json_dispatch,
    ".json.zip": read_json_dispatch,
}


def fetch_dataframe(
    config_source, client, file_fqn: DatalakeTableSchemaWrapper, **kwargs
):
    """
    Method to get dataframe for profiling
    """
    # dispatch to handle fetching of data from multiple file formats (csv, tsv, json, avro and parquet)
    key: str = file_fqn.key
    bucket_name: str = file_fqn.bucket_name
    try:
        for dict_key, dict_value in FILE_FORMAT_DISPATCH_MAP.items():
            if key.endswith(dict_key):
                return dict_value(
                    config_source, key=key, bucket_name=bucket_name, client=client
                )
    except Exception as err:
        logger.error(
            f"Error fetching file {bucket_name}/{key} using {config_source.__class__.__name__} due to: {err}"
        )
    return None
