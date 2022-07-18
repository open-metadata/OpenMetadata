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

import json
import traceback

import dask.dataframe as dd
import gcsfs
import pandas as pd
import pyarrow.parquet as pq
from google.cloud.storage.blob import Blob
from pandas import DataFrame

from metadata.utils.logger import utils_logger

logger = utils_logger()


def read_csv_from_gcs(key: Blob, bucket_name: str) -> DataFrame:
    df = dd.read_csv(f"gs://{bucket_name}/{key.name}")
    return df


def read_tsv_from_gcs(key: Blob, bucket_name: str) -> DataFrame:
    df = dd.read_csv(f"gs://{bucket_name}/{key.name}", sep="\t")
    return df


def read_json_from_gcs(key: Blob) -> DataFrame:
    try:
        data = key.download_as_string().decode()
        data = json.loads(data)
        if isinstance(data, list):
            df = pd.DataFrame.from_dict(data)
        else:
            df = pd.DataFrame.from_dict(
                dict([(k, pd.Series(v)) for k, v in data.items()])
            )
        return df

    except ValueError as verr:
        logger.debug(traceback.format_exc())
        logger.error(verr)


def read_parquet_from_gcs(key: Blob, bucket_name: str) -> DataFrame:
    gs = gcsfs.GCSFileSystem()
    arrow_df = pq.ParquetDataset(f"gs://{bucket_name}/{key.name}", filesystem=gs)
    df = arrow_df.read_pandas().to_pandas()
    return df
