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
Glue source models.
"""

from typing import List, Optional

from pydantic import BaseModel


class GlueSchema(BaseModel):
    CatalogId: Optional[str]
    Name: str


class DatabasePage(BaseModel):
    DatabaseList: Optional[List[GlueSchema]] = []


class TableParameters(BaseModel):
    table_type: Optional[str]


class Column(BaseModel):
    Type: str
    Name: str
    Comment: Optional[str]


class StorageDetails(BaseModel):
    Columns: Optional[List[Column]] = []


class GlueTable(BaseModel):
    Parameters: Optional[TableParameters]
    Name: str
    TableType: Optional[str]
    Description: Optional[str]
    StorageDescriptor: Optional[StorageDetails] = StorageDetails()
    PartitionKeys: Optional[List[Column]] = []


class TablePage(BaseModel):
    TableList: Optional[List[GlueTable]] = []
