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
Utils module to convert different file types from gcs buckets into a dataframe
"""

import gzip
import json
import traceback
from typing import Any

import gcsfs
import pandas as pd
from pandas import DataFrame
from pyarrow.parquet import ParquetFile

from metadata.utils.logger import utils_logger

logger = utils_logger()


def _get_json_text(key: str, text: str) -> str:
    if key.endswith(".gz"):
        return gzip.decompress(text)
    return text


def read_csv_from_gcs(  # pylint: disable=inconsistent-return-statements
    key: str, bucket_name: str
) -> DataFrame:
    """
    Read the csv file from the gcs bucket and return a dataframe
    """

    try:
        chunk_list = []
        with pd.read_csv(
            f"gs://{bucket_name}/{key}", sep=",", chunksize=200000
        ) as reader:
            for chunks in reader:
                chunk_list.append(chunks)
        return chunk_list
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Error reading CSV from GCS - {exc}")


def read_tsv_from_gcs(  # pylint: disable=inconsistent-return-statements
    key: str, bucket_name: str
) -> DataFrame:
    """
    Read the tsv file from the gcs bucket and return a dataframe
    """
    try:
        chunk_list = []
        with pd.read_csv(
            f"gs://{bucket_name}/{key}", sep="\t", chunksize=200000
        ) as reader:
            for chunks in reader:
                chunk_list.append(chunks)
        return chunk_list
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Error reading CSV from GCS - {exc}")


def read_json_from_gcs(  # pylint: disable=inconsistent-return-statements
    client: Any, key: str, bucket_name: str
) -> DataFrame:
    """
    Read the json file from the gcs bucket and return a dataframe
    """

    try:
        bucket = client.get_bucket(bucket_name)
        text = bucket.get_blob(key).download_as_string()
        data = json.loads(_get_json_text(key, text))
        if isinstance(data, list):
            return [pd.DataFrame.from_records(data)]
        return [
            pd.DataFrame.from_dict(
                dict(  # pylint: disable=consider-using-dict-comprehension
                    [(k, pd.Series(v)) for k, v in data.items()]
                )
            )
        ]

    except ValueError as verr:
        logger.debug(traceback.format_exc())
        logger.warning(f"Error reading JSON from GCS - {verr}")


def read_parquet_from_gcs(key: str, bucket_name: str) -> DataFrame:
    """
    Read the parquet file from the gcs bucket and return a dataframe
    """

    gcs = gcsfs.GCSFileSystem()
    file = gcs.open(f"gs://{bucket_name}/{key}")
    return [ParquetFile(file).read().to_pandas()]
