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

import traceback
from typing import Any

import pandas as pd
import pyarrow.parquet as pq
import s3fs

from metadata.ingestion.source.database.datalake.utils import (
    read_from_avro,
    read_from_json,
)
from metadata.utils.constants import CHUNKSIZE
from metadata.utils.logger import utils_logger

logger = utils_logger()


def get_file_text(client: Any, key: str, bucket_name: str):
    obj = client.get_object(Bucket=bucket_name, Key=key)
    return obj["Body"].read()


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
        with pd.read_csv(stream, sep=sep, chunksize=CHUNKSIZE) as reader:
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
    json_text = get_file_text(client=client, key=key, bucket_name=bucket_name)
    return read_from_json(
        key=key, json_text=json_text, sample_size=sample_size, decode=True
    )


def read_parquet_from_s3(client: Any, key: str, bucket_name: str):
    """
    Read the parquet file from the s3 bucket and return a dataframe
    """
    s3_fs = s3fs.S3FileSystem()
    if client.awsAccessKeyId and client.awsSecretAccessKey:
        s3_fs = s3fs.S3FileSystem(
            key=client.awsAccessKeyId,
            secret=client.awsSecretAccessKey.get_secret_value(),
            token=client.awsSessionToken,
        )
    bucket_uri = f"s3://{bucket_name}/{key}"
    dataset = pq.ParquetDataset(bucket_uri, filesystem=s3_fs)
    return [dataset.read_pandas().to_pandas()]


def read_avro_from_s3(client: Any, key: str, bucket_name: str):
    """
    Read the avro file from the s3 bucket and return a dataframe
    """
    return read_from_avro(
        get_file_text(client=client, key=key, bucket_name=bucket_name)
    )
