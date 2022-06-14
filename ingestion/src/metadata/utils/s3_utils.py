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


def read_csv_from_s3(client, key, bucket_name):
    from io import StringIO

    import pandas as pd

    csv_obj = client.get_object(Bucket=bucket_name, Key=key["Key"])
    body = csv_obj["Body"]
    csv_string = body.read().decode("utf-8")
    df = pd.read_csv(StringIO(csv_string))

    return df


def read_tsv_from_s3(client, key, bucket_name):
    from io import StringIO

    import pandas as pd

    csv_obj = client.get_object(Bucket=bucket_name, Key=key["Key"])
    body = csv_obj["Body"]
    csv_string = body.read().decode("utf-8")
    df = pd.read_csv(StringIO(csv_string), sep="\t")

    return df


def read_json_from_s3(client, key, bucket_name):
    import json

    import pandas as pd

    obj = client.get_object(Bucket=bucket_name, Key=key["Key"])
    json_text = obj["Body"].read().decode("utf-8")
    data = json.loads(json_text)
    df = pd.DataFrame.from_dict(data)

    return df


def read_parquet_from_s3(client, key, bucket_name):
    import dask.dataframe as dd

    df = dd.read_parquet(f"s3://{bucket_name}/{key['Key']}")

    return df
