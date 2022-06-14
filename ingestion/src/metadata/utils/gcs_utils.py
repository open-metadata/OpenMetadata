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


def read_csv_from_gcs(key, bucket_name):
    import dask.dataframe as dd

    df = dd.read_csv(f"gs://{bucket_name}/{key.name}")

    return df


def read_tsv_from_gcs(key, bucket_name):

    import dask.dataframe as dd

    df = dd.read_csv(f"gs://{bucket_name}/{key.name}", sep="\t")

    return df


def read_json_from_gcs(key):

    import pandas as pd

    from metadata.utils.logger import utils_logger

    logger = utils_logger()
    import json
    import traceback

    try:

        data = key.download_as_string().decode()
        df = pd.DataFrame.from_dict(json.loads(data))
        return df

    except ValueError as verr:
        logger.debug(traceback.format_exc())
        logger.error(verr)


def read_parquet_from_gcs(key, bucket_name):
    import gcsfs
    import pyarrow.parquet as pq

    gs = gcsfs.GCSFileSystem()
    arrow_df = pq.ParquetDataset(f"gs://{bucket_name}/{key.name}", filesystem=gs)
    df = arrow_df.read_pandas().to_pandas()
    return df
