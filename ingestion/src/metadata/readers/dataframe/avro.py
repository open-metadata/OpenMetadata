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
Avro DataFrame reader
"""
import io

from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.type.schema import DataTypeTopic
from metadata.readers.dataframe.base import DataFrameReader
from metadata.readers.dataframe.common import dataframe_to_chunks
from metadata.readers.dataframe.models import DatalakeColumnWrapper
from metadata.utils.constants import UTF_8

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


class AvroDataFrameReader(DataFrameReader):
    """
    Manage the implementation to read Avro dataframes
    from any source based on its init client.
    """

    @staticmethod
    def read_from_avro(avro_text: bytes) -> DatalakeColumnWrapper:
        """
        Method to parse the avro data from storage sources
        """
        # pylint: disable=import-outside-toplevel
        from avro.datafile import DataFileReader
        from avro.errors import InvalidAvroBinaryEncoding
        from avro.io import DatumReader
        from pandas import DataFrame, Series

        from metadata.parsers.avro_parser import parse_avro_schema

        try:
            elements = DataFileReader(io.BytesIO(avro_text), DatumReader())
            if elements.meta.get(AVRO_SCHEMA):
                return DatalakeColumnWrapper(
                    columns=parse_avro_schema(
                        schema=elements.meta.get(AVRO_SCHEMA).decode(UTF_8), cls=Column
                    ),
                    dataframes=dataframe_to_chunks(DataFrame.from_records(elements)),
                )
            return DatalakeColumnWrapper(
                dataframes=dataframe_to_chunks(DataFrame.from_records(elements))
            )
        except (AssertionError, InvalidAvroBinaryEncoding):
            columns = parse_avro_schema(schema=avro_text, cls=Column)
            field_map = {
                col.name.root: Series(PD_AVRO_FIELD_MAP.get(col.dataType.value, "str"))
                for col in columns
            }
            return DatalakeColumnWrapper(
                columns=columns, dataframes=dataframe_to_chunks(DataFrame(field_map))
            )

    def _read(self, *, key: str, bucket_name: str, **__) -> DatalakeColumnWrapper:
        text = self.reader.read(key, bucket_name=bucket_name)
        return self.read_from_avro(text)
