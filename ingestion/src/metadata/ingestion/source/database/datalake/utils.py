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
Module to define helper methods for datalake
"""

import gzip
import io
import json
import zipfile
from typing import List, Union

import pandas as pd
from avro.datafile import DataFileReader
from avro.io import DatumReader

from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.type.schema import DataTypeTopic
from metadata.ingestion.source.database.datalake.models import DatalakeColumnWrapper
from metadata.parsers.avro_parser import parse_avro_schema
from metadata.utils.constants import UTF_8
from metadata.utils.logger import utils_logger

logger = utils_logger()

PD_AVRO_FIELD_MAP = {
    DataTypeTopic.BOOLEAN.value: "bool",
    DataTypeTopic.INT.value: "int",
    DataTypeTopic.LONG.value: "float",
    DataTypeTopic.FLOAT.value: "float",
    DataTypeTopic.DOUBLE.value: "float",
    DataTypeTopic.TIMESTAMP.value: "float",
    DataTypeTopic.TIMESTAMPZ.value: "float",
}

AVRO_SCHEMA = "avro.schema"


def read_from_avro(
    avro_text: bytes,
) -> Union[DatalakeColumnWrapper, List[pd.DataFrame]]:
    """
    Method to parse the avro data from storage sources
    """
    try:
        elements = DataFileReader(io.BytesIO(avro_text), DatumReader())
        if elements.meta.get(AVRO_SCHEMA):
            return DatalakeColumnWrapper(
                columns=parse_avro_schema(
                    schema=elements.meta.get(AVRO_SCHEMA).decode(UTF_8), cls=Column
                ),
                dataframes=[pd.DataFrame.from_records(elements)],
            )
        return [pd.DataFrame.from_records(elements)]
    except AssertionError:
        columns = parse_avro_schema(schema=avro_text, cls=Column)
        field_map = {
            col.name.__root__: pd.Series(
                PD_AVRO_FIELD_MAP.get(col.dataType.value, "str")
            )
            for col in columns
        }
        return DatalakeColumnWrapper(
            columns=columns, dataframes=[pd.DataFrame(field_map)]
        )


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
    key: str, json_text: str, sample_size: int = 100, decode: bool = False
) -> List[pd.DataFrame]:
    """
    Read the json file from the azure container and return a dataframe
    """
    json_text = _get_json_text(key, json_text, decode)
    try:
        data = json.loads(json_text)
    except json.decoder.JSONDecodeError:
        logger.debug("Failed to read as JSON object trying to read as JSON Lines")
        data = [
            json.loads(json_obj)
            for json_obj in json_text.strip().split("\n")[:sample_size]
        ]

    if isinstance(data, list):
        return [pd.DataFrame.from_dict(data[:sample_size])]
    return [
        pd.DataFrame.from_dict({key: pd.Series(value) for key, value in data.items()})
    ]
