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

from pydantic import BaseModel, Field
from typing_extensions import Annotated

from metadata.generated.schema.entity.data.table import Column


class DatalakeColumnWrapper(BaseModel):
    """
    In case of avro files we can directly get the column details and
    we do not need the dataframe to parse the metadata but profiler
    need the dataframes hence this model binds the columns details and dataframe
    which can be used by both profiler and metadata ingestion
    """

    columns: Annotated[
        Optional[List[Column]], Field(None, description="List of columns")
    ]
    # pandas.Dataframe does not have any validators
    dataframes: Annotated[
        Optional[List[Any]], Field(None, description="List of dataframes")
    ]
    raw_data: Annotated[
        Any,
        Field(
            None,
            description="In special cases like json schema, we need to store the raw data",
        ),
    ]


class DatalakeTableSchemaWrapper(BaseModel):
    """
    Instead of sending the whole Table model from profiler, we send only key and bucket name using this model
    """

    key: Annotated[str, Field(..., description="Key of the file in the bucket")]
    bucket_name: Annotated[str, Field(..., description="Name of the bucket")]
    file_extension: Annotated[
        Optional[Any], Field(None, description="File extension of the file")
    ]
    separator: Annotated[
        Optional[str],
        Field(None, description="Used for DSV readers to identify the separator"),
    ]


class DatalakeTableMetadata(BaseModel):
    """
    Used to yield metadata from datalake buckets
    """

    table: Annotated[str, Field(..., description="Name of the table")]
    table_type: Annotated[str, Field(..., description="Type of the table")]
    file_extension: Annotated[
        Optional[Any], Field(None, description="File extension of the file")
    ]
