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
Module to define pydentic models related to datalake
"""
from typing import Any, List, Optional

from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import Column


class DatalakeColumnWrapper(BaseModel):
    """
    In case of avro files we can directly get the column details and
    we do not need the dataframe to parse the metadata but profiler
    need the dataframes hence this model binds the columns details and dataframe
    which can be used by both profiler and metadata ingestion
    """

    columns: Optional[List[Column]]
    dataframes: Optional[List[Any]]  # pandas.Dataframe does not have any validators
