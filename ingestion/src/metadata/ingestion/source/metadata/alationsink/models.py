#  Copyright 2024 Collate
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
Alation Sink Data Models
"""
from typing import List, Optional

from pydantic import BaseModel


class CreateDatasourceRequest(BaseModel):
    """
    Alation CreateDatasourceRequest Model
    """

    uri: str
    connector_id: int
    db_username: str
    db_password: Optional[str] = None
    title: str
    description: Optional[str] = None


class DataSource(BaseModel):
    """
    Alation DataSource Model
    """

    id: str
    dbtype: str
    title: str


class CreateSchemaRequest(BaseModel):
    """
    Alation CreateSchemaRequest Model
    """

    key: str
    title: str
    description: Optional[str] = None


class CreateSchemaRequestList(BaseModel):
    """
    Alation CreateSchemaRequestList Model
    """

    root: List[CreateSchemaRequest]


class Schema(BaseModel):
    """
    Alation Schema Model
    """

    id: str
    name: str
    title: Optional[str] = None
    description: Optional[str] = None


class CreateTableRequest(BaseModel):
    """
    Alation CreateTableRequest Model
    """

    key: str
    title: str
    description: Optional[str] = None
    table_type: Optional[str] = None
    sql: Optional[str] = None


class CreateTableRequestList(BaseModel):
    """
    Alation CreateTableRequestList Model
    """

    root: List[CreateTableRequest]


class Table(BaseModel):
    """
    Alation Table Model
    """

    id: str
    name: str
    title: Optional[str] = None


class ColumnIndex(BaseModel):
    """
    Alation Index Model
    """

    isPrimaryKey: Optional[bool] = None
    isForeignKey: Optional[bool] = None
    referencedColumnId: Optional[str] = None
    isOtherIndex: Optional[bool] = None


class CreateColumnRequest(BaseModel):
    """
    Alation CreateColumnRequest Model
    """

    key: str
    column_type: str
    title: Optional[str]
    description: Optional[str] = None
    nullable: Optional[bool] = None
    position: Optional[str] = None
    index: Optional[ColumnIndex] = None
    nullable: Optional[bool] = None


class CreateColumnRequestList(BaseModel):
    """
    Alation CreateColumnRequestList Model
    """

    root: List[CreateColumnRequest]


class Column(BaseModel):
    """
    Alation Column Model
    """

    id: str
    name: str
    title: Optional[str] = None
    description: Optional[str] = None
    column_comment: Optional[str] = None
    column_type: str
    position: Optional[str] = None
    nullable: Optional[bool] = None
    index: Optional[ColumnIndex] = None
