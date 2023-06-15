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
from different auths and different file systems.
"""


from enum import Enum
from typing import Any, Dict

from metadata.ingestion.source.database.datalake.models import (
    DatalakeTableSchemaWrapper,
)
from metadata.utils.constants import CHUNKSIZE
from metadata.utils.logger import utils_logger

logger = utils_logger()
COMPLEX_COLUMN_SEPARATOR = "_##"
AZURE_PATH = "abfs://{bucket_name}@{account_name}.dfs.core.windows.net/{key}"
logger = utils_logger()


class DatalakeFileFormatException(Exception):
    def __init__(self, config_source: Any, file_name: str) -> None:
        message = f"Missing implementation for {config_source.__class__.__name__} for {file_name}"
        super().__init__(message)


class FILE_FORMAT_DISPATCH_MAP:
    @classmethod
    def fetch_dispatch(cls):
        from metadata.utils.datalake.avro_dispatch import read_avro_dispatch
        from metadata.utils.datalake.csv_tsv_dispatch import (
            read_csv_dispatch,
            read_tsv_dispatch,
        )
        from metadata.utils.datalake.json_dispatch import read_json_dispatch
        from metadata.utils.datalake.parquet_dispatch import read_parquet_dispatch

        return {
            SUPPORTED_TYPES.CSV: read_csv_dispatch,
            SUPPORTED_TYPES.TSV: read_tsv_dispatch,
            SUPPORTED_TYPES.AVRO: read_avro_dispatch,
            SUPPORTED_TYPES.PARQUET: read_parquet_dispatch,
            SUPPORTED_TYPES.JSON: read_json_dispatch,
            SUPPORTED_TYPES.JSONGZ: read_json_dispatch,
            SUPPORTED_TYPES.JSONZIP: read_json_dispatch,
        }


class SUPPORTED_TYPES(Enum):
    CSV = "csv"
    TSV = "tsv"
    AVRO = "avro"
    PARQUET = "parquet"
    JSON = "json"
    JSONGZ = "json.gz"
    JSONZIP = "json.zip"

    @property
    def return_dispatch(self):
        return FILE_FORMAT_DISPATCH_MAP.fetch_dispatch().get(self)


def return_azure_storage_options(config_source: Any) -> Dict:
    connection_args = config_source.securityConfig
    return {
        "tenant_id": connection_args.tenantId,
        "client_id": connection_args.clientId,
        "account_name": connection_args.accountName,
        "client_secret": connection_args.clientSecret.get_secret_value(),
    }


def dataframe_to_chunks(df):
    """
    Reads the Dataframe and returns list of dataframes broken down in chunks
    """
    return [
        df[range_iter : range_iter + CHUNKSIZE]
        for range_iter in range(0, len(df), CHUNKSIZE)
    ]


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
        for supported_types_enum in SUPPORTED_TYPES:
            if key.endswith(supported_types_enum.value):
                return supported_types_enum.return_dispatch(
                    config_source,
                    key=key,
                    bucket_name=bucket_name,
                    client=client,
                    **kwargs,
                )
    except Exception as err:
        logger.error(
            f"Error fetching file {bucket_name}/{key} using {config_source.__class__.__name__} due to: {err}"
        )
    return None


def _get_root_col(col_name: str) -> str:
    return col_name.split(COMPLEX_COLUMN_SEPARATOR)[1]


def clean_dataframe(df):
    all_complex_root_columns = set(
        _get_root_col(col) for col in df if COMPLEX_COLUMN_SEPARATOR in col
    )
    for complex_col in all_complex_root_columns:
        if complex_col in df.columns:
            df = df.drop(complex_col, axis=1)
    return df
