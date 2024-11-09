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
ConfigSource Reader Factory: Helps us choose the reader from
- Local
- ADLS
- S3
- GCS
"""
from enum import Enum
from typing import Any, Optional

from metadata.readers.dataframe.avro import AvroDataFrameReader
from metadata.readers.dataframe.base import DataFrameReader
from metadata.readers.dataframe.dsv import (
    CSVDataFrameReader,
    TSVDataFrameReader,
    get_dsv_reader_by_separator,
)
from metadata.readers.dataframe.json import JSONDataFrameReader
from metadata.readers.dataframe.parquet import ParquetDataFrameReader
from metadata.readers.models import ConfigSource
from metadata.utils.logger import utils_logger

logger = utils_logger()


class SupportedTypes(Enum):
    CSV = "csv"
    TSV = "tsv"
    AVRO = "avro"
    PARQUET = "parquet"
    JSON = "json"
    JSONGZ = "json.gz"
    JSONZIP = "json.zip"
    JSONL = "jsonl"
    JSONLGZ = "jsonl.gz"
    JSONLZIP = "jsonl.zip"


DF_READER_MAP = {
    SupportedTypes.CSV.value: CSVDataFrameReader,
    SupportedTypes.TSV.value: TSVDataFrameReader,
    SupportedTypes.AVRO.value: AvroDataFrameReader,
    SupportedTypes.PARQUET.value: ParquetDataFrameReader,
    SupportedTypes.JSON.value: JSONDataFrameReader,
    SupportedTypes.JSONGZ.value: JSONDataFrameReader,
    SupportedTypes.JSONZIP.value: JSONDataFrameReader,
    SupportedTypes.JSONL.value: JSONDataFrameReader,
    SupportedTypes.JSONLGZ.value: JSONDataFrameReader,
    SupportedTypes.JSONLZIP.value: JSONDataFrameReader,
}


def get_df_reader(
    type_: SupportedTypes,
    config_source: ConfigSource,
    client: Optional[Any],
    separator: Optional[str] = None,
) -> DataFrameReader:
    """
    Load the File Reader based on the Config Source
    """
    # If we have a DSV file, build a reader dynamically based on the received separator
    if type_ in {SupportedTypes.CSV, SupportedTypes.TSV} and separator:
        return get_dsv_reader_by_separator(separator=separator)(
            config_source=config_source, client=client
        )

    if type_.value in DF_READER_MAP:
        return DF_READER_MAP[type_.value](config_source=config_source, client=client)

    raise NotImplementedError(
        f"DataFrameReader for [{type_.value}] is not implemented."
    )
