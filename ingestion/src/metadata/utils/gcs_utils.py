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
