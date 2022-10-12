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

import json
import traceback
from typing import Any

import gcsfs
import pandas as pd
from pandas import DataFrame
from pyarrow.parquet import ParquetFile

from metadata.utils.logger import utils_logger

logger = utils_logger()


def read_csv_from_gcs(  # pylint: disable=inconsistent-return-statements
    key: str, bucket_name: str, sample_size: int = 100
) -> DataFrame:
    """
    Read the csv file from the gcs bucket and return a dataframe
    """

    try:
        return pd.read_csv(f"gs://{bucket_name}/{key}", sep=",", nrows=sample_size + 1)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Error reading CSV from GCS - {exc}")


def read_tsv_from_gcs(  # pylint: disable=inconsistent-return-statements
    key: str, bucket_name: str, sample_size: int = 100
) -> DataFrame:
    """
    Read the tsv file from the gcs bucket and return a dataframe
    """

    try:
        return pd.read_csv(f"gs://{bucket_name}/{key}", sep="\t", nrows=sample_size + 1)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Error reading CSV from GCS - {exc}")


def read_json_from_gcs(  # pylint: disable=inconsistent-return-statements
    client: Any, key: str, bucket_name: str, sample_size=100
) -> DataFrame:
    """
    Read the json file from the gcs bucket and return a dataframe
    """

    try:
        bucket = client.get_bucket(bucket_name)
        data = json.loads(bucket.get_blob(key).download_as_string())
        if isinstance(data, list):
            return pd.DataFrame.from_records(data, nrows=sample_size)
        return pd.DataFrame.from_dict(
            dict(  # pylint: disable=consider-using-dict-comprehension
                [(k, pd.Series(v)) for k, v in data.items()]
            )
        )

    except ValueError as verr:
        logger.debug(traceback.format_exc())
        logger.warning(f"Error reading JSON from GCS - {verr}")


def read_parquet_from_gcs(key: str, bucket_name: str) -> DataFrame:
    """
    Read the parquet file from the gcs bucket and return a dataframe
    """

    gcs = gcsfs.GCSFileSystem()
    file = gcs.open(f"gs://{bucket_name}/{key}")
    return ParquetFile(file).schema.to_arrow_schema().empty_table().to_pandas()
