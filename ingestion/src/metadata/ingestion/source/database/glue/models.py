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

from typing import List, Optional

from pydantic import BaseModel


class GlueSchema(BaseModel):
    CatalogId: Optional[str] = None
    Name: str
    Description: Optional[str] = None


class DatabasePage(BaseModel):
    DatabaseList: Optional[List[GlueSchema]] = []


class TableParameters(BaseModel):
    table_type: Optional[str] = None


class Column(BaseModel):
    Type: str
    Name: str
    Comment: Optional[str] = None


class SerializationDetails(BaseModel):
    SerializationLibrary: Optional[str] = None
    Parameters: Optional[dict] = {}


class StorageDetails(BaseModel):
    Columns: Optional[List[Column]] = []
    Location: Optional[str] = None
    SerdeInfo: Optional[SerializationDetails] = SerializationDetails()


class GlueTable(BaseModel):
    Parameters: Optional[TableParameters] = None
    Name: str
    TableType: Optional[str] = None
    Description: Optional[str] = None
    StorageDescriptor: Optional[StorageDetails] = StorageDetails()
    PartitionKeys: Optional[List[Column]] = []


class TablePage(BaseModel):
    TableList: Optional[List[GlueTable]] = []
