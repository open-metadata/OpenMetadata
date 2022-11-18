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
Utils module to convert different file types from s3 buckets into a dataframe
"""

import gzip
import json
import os
import traceback
from typing import Any

import pandas as pd
from pyarrow import fs
from pyarrow.parquet import ParquetFile

from metadata.utils.logger import utils_logger

logger = utils_logger()


def _get_json_text(key: str, text: bytes) -> str:
    if key.endswith(".gz"):
        return gzip.decompress(text)
    return text.decode("utf-8")


def read_csv_from_s3(
    client: Any,
    key: str,
    bucket_name: str,
    sep: str = ",",
):
    """
    Read the csv file from the s3 bucket and return a dataframe
    """
    try:
        stream = client.get_object(Bucket=bucket_name, Key=key)["Body"]
        chunk_list = []
        with pd.read_csv(stream, sep=sep, chunksize=200000) as reader:
            for chunks in reader:
                chunk_list.append(chunks)
        return chunk_list
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Error reading CSV from s3 - {exc}")
        return None


def read_tsv_from_s3(
    client,
    key: str,
    bucket_name: str,
):
    """
    Read the tsv file from the s3 bucket and return a dataframe
    """
    try:
        return read_csv_from_s3(client, key, bucket_name, sep="\t")
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Error reading TSV from s3 - {exc}")
        return None


def read_json_from_s3(client: Any, key: str, bucket_name: str, sample_size=100):
    """
    Read the json file from the s3 bucket and return a dataframe
    """
    obj = client.get_object(Bucket=bucket_name, Key=key)
    json_text = obj["Body"].read()
    data = json.loads(_get_json_text(key, json_text))
    if isinstance(data, list):
        return [pd.DataFrame.from_dict(data[:sample_size])]
    return [
        pd.DataFrame.from_dict({key: pd.Series(value) for key, value in data.items()})
    ]


def read_parquet_from_s3(client: Any, key: str, bucket_name: str):
    """
    Read the parquet file from the s3 bucket and return a dataframe
    """

    s3_file = fs.S3FileSystem(region=client.meta.region_name)
    return [
        ParquetFile(s3_file.open_input_file(os.path.join(bucket_name, key)))
        .read()
        .to_pandas()
    ]
