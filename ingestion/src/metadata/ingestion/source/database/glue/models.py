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

from pydantic import BaseModel


class GlueSchema(BaseModel):
    CatalogId: str | None = None
    Name: str
    Description: str | None = None


class DatabasePage(BaseModel):
    DatabaseList: list[GlueSchema] | None = []


class TableParameters(BaseModel):
    table_type: str | None = None


class Column(BaseModel):
    Type: str
    Name: str
    Comment: str | None = None


class SerializationDetails(BaseModel):
    SerializationLibrary: str | None = None
    Parameters: dict | None = {}


class StorageDetails(BaseModel):
    Columns: list[Column] | None = []
    Location: str | None = None
    SerdeInfo: SerializationDetails | None = SerializationDetails()


class GlueTable(BaseModel):
    Parameters: TableParameters | None = None
    Name: str
    TableType: str | None = None
    Description: str | None = None
    StorageDescriptor: StorageDetails | None = StorageDetails()
    PartitionKeys: list[Column] | None = []


class TablePage(BaseModel):
    TableList: list[GlueTable] | None = []
