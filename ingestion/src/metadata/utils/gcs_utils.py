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

import traceback
from typing import Any

import gcsfs
import pandas as pd
from pandas import DataFrame
from pyarrow.parquet import ParquetFile

from metadata.ingestion.source.database.datalake.utils import (
    read_from_avro,
    read_from_json,
)
from metadata.utils.constants import CHUNKSIZE
from metadata.utils.logger import utils_logger

logger = utils_logger()


def get_file_text(client: Any, key: str, bucket_name: str):
    bucket = client.get_bucket(bucket_name)
    return bucket.get_blob(key).download_as_string()


def read_csv_from_gcs(  # pylint: disable=inconsistent-return-statements
    key: str, bucket_name: str
) -> DataFrame:
    """
    Read the csv file from the gcs bucket and return a dataframe
    """

    try:
        chunk_list = []
        with pd.read_csv(
            f"gs://{bucket_name}/{key}", sep=",", chunksize=CHUNKSIZE
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
            f"gs://{bucket_name}/{key}", sep="\t", chunksize=CHUNKSIZE
        ) as reader:
            for chunks in reader:
                chunk_list.append(chunks)
        return chunk_list
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Error reading CSV from GCS - {exc}")


def read_json_from_gcs(client: Any, key: str, bucket_name: str) -> DataFrame:
    """
    Read the json file from the gcs bucket and return a dataframe
    """
    json_text = get_file_text(client=client, key=key, bucket_name=bucket_name)
    return read_from_json(key=key, json_text=json_text)


def read_parquet_from_gcs(key: str, bucket_name: str) -> DataFrame:
    """
    Read the parquet file from the gcs bucket and return a dataframe
    """

    gcs = gcsfs.GCSFileSystem()
    file = gcs.open(f"gs://{bucket_name}/{key}")
    return [ParquetFile(file).read().to_pandas()]


def read_avro_from_gcs(client: Any, key: str, bucket_name: str) -> DataFrame:
    """
    Read the avro file from the gcs bucket and return a dataframe
    """
    avro_text = get_file_text(client=client, key=key, bucket_name=bucket_name)
    return read_from_avro(avro_text)
