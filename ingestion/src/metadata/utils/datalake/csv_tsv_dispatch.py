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
from Csv and Tsv file formats
"""
from functools import singledispatch
from typing import Any

from metadata.generated.schema.entity.services.connections.database.datalake.azureConfig import (
    AzureConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalake.gcsConfig import (
    GCSConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
    S3Config,
)
from metadata.utils.constants import CHUNKSIZE
from metadata.utils.datalake.common import (
    AZURE_PATH,
    DatalakeFileFormatException,
    return_azure_storage_options,
)
from metadata.utils.logger import utils_logger

logger = utils_logger()

TSV_SEPARATOR = "\t"
CSV_SEPARATOR = ","


def read_from_pandas(path: str, separator: str, storage_options=None):
    import pandas as pd  # pylint: disable=import-outside-toplevel

    chunk_list = []
    with pd.read_csv(
        path, sep=separator, chunksize=CHUNKSIZE, storage_options=storage_options
    ) as reader:
        for chunks in reader:
            chunk_list.append(chunks)
    return chunk_list


@singledispatch
def read_csv_dispatch(config_source: Any, key: str, **kwargs):
    raise DatalakeFileFormatException(config_source=config_source, file_name=key)


@singledispatch
def read_tsv_dispatch(config_source: Any, key: str, **kwargs):
    raise DatalakeFileFormatException(config_source=config_source, file_name=key)


@read_csv_dispatch.register
def _(_: GCSConfig, key: str, bucket_name: str, **kwargs):
    """
    Read the CSV file from the gcs bucket and return a dataframe
    """
    path = f"gs://{bucket_name}/{key}"
    return read_from_pandas(path=path, separator=CSV_SEPARATOR)


@read_csv_dispatch.register
def _(_: S3Config, key: str, bucket_name: str, client, **kwargs):
    path = client.get_object(Bucket=bucket_name, Key=key)["Body"]
    return read_from_pandas(path=path, separator=CSV_SEPARATOR)


@read_csv_dispatch.register
def _(config_source: AzureConfig, key: str, bucket_name: str, **kwargs):
    storage_options = return_azure_storage_options(config_source)
    path = AZURE_PATH.format(
        bucket_name=bucket_name,
        account_name=storage_options.get("account_name"),
        key=key,
    )
    return read_from_pandas(
        path=path,
        separator=CSV_SEPARATOR,
        storage_options=storage_options,
    )


@read_tsv_dispatch.register
def _(_: GCSConfig, key: str, bucket_name: str, **kwargs):
    """
    Read the TSV file from the gcs bucket and return a dataframe
    """
    path = f"gs://{bucket_name}/{key}"
    return read_from_pandas(path=path, separator=TSV_SEPARATOR)


@read_tsv_dispatch.register
def _(_: S3Config, key: str, bucket_name: str, client, **kwargs):
    path = client.get_object(Bucket=bucket_name, Key=key)["Body"]
    return read_from_pandas(path=path, separator=TSV_SEPARATOR)


@read_tsv_dispatch.register
def _(config_source: AzureConfig, key: str, bucket_name: str, **kwargs):

    storage_options = return_azure_storage_options(config_source)

    path = AZURE_PATH.format(
        bucket_name=bucket_name,
        account_name=storage_options.get("account_name"),
        key=key,
    )
    return read_from_pandas(
        path=path,
        separator=TSV_SEPARATOR,
        storage_options=storage_options,
    )
