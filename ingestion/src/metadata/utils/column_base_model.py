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
Helper module to process the base model type for profiler and test suites
"""

from typing import Union

from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import DataType
from metadata.utils.entity_link import get_decoded_column


def fetch_column_obj(entity_link, data_frame):
    return ColumnBaseModel.col_base_model(data_frame[get_decoded_column(entity_link)])


class ColumnBaseModel(BaseModel):
    name: str
    datatype: Union[DataType, str]

    @staticmethod
    def col_base_model_list(data_frame_list):
        return [
            ColumnBaseModel(name=column, datatype=data_frame_list[0][column].dtype.name)
            for column in data_frame_list[0].columns
        ]

    @staticmethod
    def col_base_model(col_series):
        return ColumnBaseModel(name=col_series.name, datatype=col_series.dtype.name)
