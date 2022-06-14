def read_csv_from_s3(client, key, bucket_name):
    from io import StringIO

    import dask.dataframe as dd
    import pandas as pd
    import pyarrow.parquet as pq

    csv_obj = client.get_object(Bucket=bucket_name, Key=key["Key"])
    body = csv_obj["Body"]
    csv_string = body.read().decode("utf-8")
    df = pd.read_csv(StringIO(csv_string))

    return df


def read_tsv_from_s3(client, key, bucket_name):
    from io import StringIO

    import pandas as pd
    import pyarrow.parquet as pq

    csv_obj = client.get_object(Bucket=bucket_name, Key=key["Key"])
    body = csv_obj["Body"]
    csv_string = body.read().decode("utf-8")
    df = pd.read_csv(StringIO(csv_string), sep="\t")

    return df


def read_json_from_s3(client, key, bucket_name):
    import json
    from io import StringIO

    import pandas as pd
    import pyarrow.parquet as pq

    obj = client.get_object(Bucket=bucket_name, Key=key["Key"])
    json_text = obj["Body"].read().decode("utf-8")
    data = json.loads(json_text)
    df = pd.DataFrame.from_dict(data)

    return df


def read_parquet_from_s3(client, key, bucket_name):

    import dask.dataframe as dd

    df = dd.read_parquet(f"s3://{bucket_name}/{key['Key']}")

    return df
