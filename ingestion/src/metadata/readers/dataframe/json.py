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
JSON DataFrame reader
"""
import gzip
import io
import json
import zipfile
from typing import List, Union

from metadata.readers.dataframe.base import DataFrameReader
from metadata.readers.dataframe.common import dataframe_to_chunks
from metadata.readers.dataframe.models import DatalakeColumnWrapper
from metadata.utils.constants import COMPLEX_COLUMN_SEPARATOR, UTF_8
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def _get_json_text(key: str, text: bytes, decode: bool) -> Union[str, bytes]:
    if key.endswith(".gz"):
        return gzip.decompress(text)
    if key.endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(text)) as zip_file:
            return zip_file.read(zip_file.infolist()[0]).decode(UTF_8)
    if decode:
        return text.decode(UTF_8) if isinstance(text, bytes) else text
    return text


class JSONDataFrameReader(DataFrameReader):
    """
    Read JSON DFs
    """

    @staticmethod
    def read_from_json(
        key: str, json_text: bytes, decode: bool = False, **__
    ) -> List["DataFrame"]:
        """
        Decompress a JSON file (if needed) and read its contents
        as a dataframe.

        Note that for the metadata we need to flag nested columns with a
        custom separator. For the profiler this is not needed. We require the
        correct column name to match with the metadata description.
        """
        # pylint: disable=import-outside-toplevel
        import pandas as pd

        json_text = _get_json_text(key=key, text=json_text, decode=decode)
        try:
            data = json.loads(json_text)
        except json.decoder.JSONDecodeError:
            logger.debug("Failed to read as JSON object. Trying to read as JSON Lines")
            data = [json.loads(json_obj) for json_obj in json_text.strip().split("\n")]

        # if we get a scalar value (e.g. {"a":"b"}) then we need to specify the index
        data = data if not isinstance(data,dict) else [data]
        return dataframe_to_chunks(pd.DataFrame.from_records(data))

    def _read(self, *, key: str, bucket_name: str, **kwargs) -> DatalakeColumnWrapper:
        text = self.reader.read(key, bucket_name=bucket_name)
        return DatalakeColumnWrapper(
            dataframes=self.read_from_json(
                key=key, json_text=text, decode=True, **kwargs
            )
        )
