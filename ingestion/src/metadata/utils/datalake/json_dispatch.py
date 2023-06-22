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
Module to define helper methods for datalake and to fetch data and metadata 
from Json file formats
"""
import gzip
import io
import json
import zipfile
from functools import singledispatch
from typing import Any, List

from metadata.generated.schema.entity.services.connections.database.datalake.azureConfig import (
    AzureConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalake.gcsConfig import (
    GCSConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
    S3Config,
)
from metadata.utils.constants import COMPLEX_COLUMN_SEPARATOR, UTF_8
from metadata.utils.datalake.common import DatalakeFileFormatException
from metadata.utils.logger import utils_logger

logger = utils_logger()


def _get_json_text(key: str, text: bytes, decode: bool) -> str:
    if key.endswith(".gz"):
        return gzip.decompress(text)
    if key.endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(text)) as zip_file:
            return zip_file.read(zip_file.infolist()[0]).decode(UTF_8)
    if decode:
        return text.decode(UTF_8)
    return text


def read_from_json(
    key: str, json_text: str, decode: bool = False, is_profiler: bool = False, **_
) -> List:
    """
    Read the json file from the azure container and return a dataframe
    """

    # pylint: disable=import-outside-toplevel
    from pandas import json_normalize

    from metadata.utils.datalake.common import dataframe_to_chunks

    json_text = _get_json_text(key, json_text, decode)
    try:
        data = json.loads(json_text)
    except json.decoder.JSONDecodeError:
        logger.debug("Failed to read as JSON object trying to read as JSON Lines")
        data = [json.loads(json_obj) for json_obj in json_text.strip().split("\n")]
    if is_profiler:
        return dataframe_to_chunks(json_normalize(data))
    return dataframe_to_chunks(json_normalize(data, sep=COMPLEX_COLUMN_SEPARATOR))


@singledispatch
def read_json_dispatch(config_source: Any, key: str, **kwargs):
    raise DatalakeFileFormatException(config_source=config_source, file_name=key)


@read_json_dispatch.register
def _(_: GCSConfig, key: str, bucket_name: str, client, **kwargs):
    """
    Read the json file from the gcs bucket and return a dataframe
    """
    json_text = client.get_bucket(bucket_name).get_blob(key).download_as_string()
    return read_from_json(key=key, json_text=json_text, decode=True, **kwargs)


@read_json_dispatch.register
def _(_: S3Config, key: str, bucket_name: str, client, **kwargs):
    json_text = client.get_object(Bucket=bucket_name, Key=key)["Body"].read()
    return read_from_json(key=key, json_text=json_text, decode=True, **kwargs)


@read_json_dispatch.register
def _(_: AzureConfig, key: str, bucket_name: str, client, **kwargs):
    container_client = client.get_container_client(bucket_name)
    json_text = container_client.get_blob_client(key).download_blob().readall()
    return read_from_json(key=key, json_text=json_text, decode=True, **kwargs)
