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
import traceback
from typing import Any

import pandas as pd

from metadata.utils.logger import utils_logger

logger = utils_logger()


def _get_json_text(key: str, text: bytes) -> str:
    if key.endswith(".gz"):
        return gzip.decompress(text)
    return text


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


def read_json_from_azure(
    client: Any, key: str, container_name: str, storage_options, sample_size=100
):
    """
    Read the json file from the azure container and return a dataframe
    """
    try:
        account_url = (
            f"abfs://{container_name}@{client.account_name}.dfs.core.windows.net/{key}"
        )
        dataframe = pd.read_json(
            account_url, storage_options=storage_options, typ="series"
        )

        data = _get_json_text(key, dataframe.to_dict())

        if isinstance(data, list):
            return [pd.DataFrame.from_dict(data[:sample_size])]
        return [
            pd.DataFrame.from_dict(
                {key: pd.Series(value) for key, value in data.items()}
            )
        ]
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Error reading parquet file from azure - {exc}")
        return None


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
