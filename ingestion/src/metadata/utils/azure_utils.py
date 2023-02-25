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
Utils module to convert different file types from azure file system into a dataframe
"""

import gzip
import io
import traceback
import zipfile
from typing import Any

import pandas as pd

from metadata.ingestion.source.database.datalake.utils import (
    read_from_avro,
    read_from_json,
)
from metadata.utils.logger import utils_logger

logger = utils_logger()


def _get_json_text(key: str, text: str) -> str:
    if key.endswith(".gz"):
        return gzip.decompress(text)
    if key.endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(text)) as zip_file:
            return zip_file.read(zip_file.infolist()[0]).decode("utf-8")
    return text


def get_file_text(client: Any, key: str, container_name: str):
    container_client = client.get_container_client(container_name)
    blob_client = container_client.get_blob_client(key)
    return blob_client.download_blob().readall()


def read_csv_from_azure(
    client: Any, key: str, container_name: str, storage_options: dict, sep: str = ","
):
    """
    Read the csv file from the azure container and return a dataframe
    """
    try:
        account_url = (
            f"abfs://{container_name}@{client.account_name}.dfs.core.windows.net/{key}"
        )
        dataframe = pd.read_csv(account_url, storage_options=storage_options, sep=sep)
        return dataframe
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Error reading CSV from s3 - {exc}")
        return None


def read_json_from_azure(client: Any, key: str, container_name: str, sample_size=100):
    """
    Read the json file from the azure container and return a dataframe
    """
    json_text = get_file_text(client=client, key=key, container_name=container_name)
    return read_from_json(key=key, json_text=json_text, sample_size=sample_size)


def read_parquet_from_azure(
    client: Any, key: str, container_name: str, storage_options: dict
):
    """
    Read the parquet file from the container and return a dataframe
    """
    try:
        account_url = (
            f"abfs://{container_name}@{client.account_name}.dfs.core.windows.net/{key}"
        )
        dataframe = pd.read_parquet(account_url, storage_options=storage_options)
        return dataframe
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Error reading parquet file from azure - {exc}")
        return None


def read_avro_from_azure(client: Any, key: str, container_name: str):
    """
    Read the avro file from the gcs bucket and return a dataframe
    """
    return read_from_avro(
        get_file_text(client=client, key=key, container_name=container_name)
    )
