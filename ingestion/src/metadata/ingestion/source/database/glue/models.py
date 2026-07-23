#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Glue source models.
"""

from typing import List, Optional  # noqa: UP035

from pydantic import BaseModel


class GlueSchema(BaseModel):
    CatalogId: Optional[str] = None  # noqa: UP045
    Name: str
    Description: Optional[str] = None  # noqa: UP045


class DatabasePage(BaseModel):
    DatabaseList: Optional[List[GlueSchema]] = []  # noqa: UP006, UP045


class TableParameters(BaseModel):
    table_type: Optional[str] = None  # noqa: UP045


class Column(BaseModel):
    Type: str
    Name: str
    Comment: Optional[str] = None  # noqa: UP045


class SerializationDetails(BaseModel):
    SerializationLibrary: Optional[str] = None  # noqa: UP045
    Parameters: Optional[dict] = {}  # noqa: UP045


class StorageDetails(BaseModel):
    Columns: Optional[List[Column]] = []  # noqa: UP006, UP045
    Location: Optional[str] = None  # noqa: UP045
    SerdeInfo: Optional[SerializationDetails] = SerializationDetails()  # noqa: UP045


class GlueTable(BaseModel):
    Parameters: Optional[TableParameters] = None  # noqa: UP045
    Name: str
    TableType: Optional[str] = None  # noqa: UP045
    Description: Optional[str] = None  # noqa: UP045
    StorageDescriptor: Optional[StorageDetails] = StorageDetails()  # noqa: UP045
    PartitionKeys: Optional[List[Column]] = []  # noqa: UP006, UP045


class TablePage(BaseModel):
    TableList: Optional[List[GlueTable]] = []  # noqa: UP006, UP045
