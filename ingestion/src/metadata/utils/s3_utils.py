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
from io import BytesIO, StringIO
from typing import Any

import pandas as pd
from pandas import DataFrame


def read_csv_from_s3(client: Any, key: str, bucket_name: str) -> DataFrame:
    csv_obj = client.get_object(Bucket=bucket_name, Key=key)
    body = csv_obj["Body"]
    csv_string = body.read().decode("utf-8")
    df = pd.read_csv(StringIO(csv_string))
    return df


def read_tsv_from_s3(client: Any, key: str, bucket_name: str) -> DataFrame:
    tsv_obj = client.get_object(Bucket=bucket_name, Key=key)
    body = tsv_obj["Body"]
    tsv_string = body.read().decode("utf-8")
    df = pd.read_csv(StringIO(tsv_string), sep="\t")
    return df


def read_json_from_s3(client: Any, key: str, bucket_name: str) -> DataFrame:
    obj = client.get_object(Bucket=bucket_name, Key=key)
    json_text = obj["Body"].read().decode("utf-8")
    data = json.loads(json_text)
    if isinstance(data, list):
        df = pd.DataFrame.from_dict(data)
    else:
        df = pd.DataFrame.from_dict(dict([(k, pd.Series(v)) for k, v in data.items()]))
    return df


def read_parquet_from_s3(client: Any, key: str, bucket_name: str) -> DataFrame:
    obj = client.get_object(Bucket=bucket_name, Key=key)
    df = pd.read_parquet(BytesIO(obj["Body"].read()))
    return df
