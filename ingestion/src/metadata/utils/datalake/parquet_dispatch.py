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
from Parquet file formats
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
from metadata.utils.datalake.common import (
    AZURE_PATH,
    DatalakeFileFormatException,
    dataframe_to_chunks,
    return_azure_storage_options,
)
from metadata.utils.logger import utils_logger

logger = utils_logger()


@singledispatch
def read_parquet_dispatch(config_source: Any, key: str, **kwargs):
    raise DatalakeFileFormatException(config_source=config_source, file_name=key)


@read_parquet_dispatch.register
def _(_: GCSConfig, key: str, bucket_name: str, **kwargs):
    """
    Read the parquet file from the gcs bucket and return a dataframe
    """
    # pylint: disable=import-outside-toplevel
    from gcsfs import GCSFileSystem
    from pyarrow.parquet import ParquetFile

    gcs = GCSFileSystem()
    file = gcs.open(f"gs://{bucket_name}/{key}")
    dataframe_response = (
        ParquetFile(file).read().to_pandas(split_blocks=True, self_destruct=True)
    )
    return dataframe_to_chunks(dataframe_response)


@read_parquet_dispatch.register
def _(_: S3Config, key: str, bucket_name: str, connection_kwargs, **kwargs):
    """
    Read the parquet file from the s3 bucket and return a dataframe
    """
    # pylint: disable=import-outside-toplevel
    import s3fs
    from pyarrow.parquet import ParquetDataset

    client_kwargs = {}
    client = connection_kwargs
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
def _(config_source: AzureConfig, key: str, bucket_name: str, **kwargs):
    import pandas as pd  # pylint: disable=import-outside-toplevel

    storage_options = return_azure_storage_options(config_source)
    account_url = AZURE_PATH.format(
        bucket_name=bucket_name,
        account_name=storage_options.get("account_name"),
        key=key,
    )
    dataframe = pd.read_parquet(account_url, storage_options=storage_options)
    return dataframe_to_chunks(dataframe)
