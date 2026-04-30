#  Copyright 2024 Collate
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
Alation Sink Data Models
"""

from typing import List, Optional  # noqa: UP035

from pydantic import BaseModel


class CreateDatasourceRequest(BaseModel):
    """
    Alation CreateDatasourceRequest Model
    """

    uri: str
    connector_id: int
    db_username: str
    db_password: Optional[str] = None  # noqa: UP045
    title: str
    description: Optional[str] = None  # noqa: UP045


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
    description: Optional[str] = None  # noqa: UP045


class CreateSchemaRequestList(BaseModel):
    """
    Alation CreateSchemaRequestList Model
    """

    root: List[CreateSchemaRequest]  # noqa: UP006


class Schema(BaseModel):
    """
    Alation Schema Model
    """

    id: str
    name: str
    title: Optional[str] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045


class CreateTableRequest(BaseModel):
    """
    Alation CreateTableRequest Model
    """

    key: str
    title: str
    description: Optional[str] = None  # noqa: UP045
    table_type: Optional[str] = None  # noqa: UP045
    sql: Optional[str] = None  # noqa: UP045


class CreateTableRequestList(BaseModel):
    """
    Alation CreateTableRequestList Model
    """

    root: List[CreateTableRequest]  # noqa: UP006


class Table(BaseModel):
    """
    Alation Table Model
    """

    id: str
    name: str
    title: Optional[str] = None  # noqa: UP045


class ColumnIndex(BaseModel):
    """
    Alation Index Model
    """

    isPrimaryKey: Optional[bool] = None  # noqa: N815, UP045
    isForeignKey: Optional[bool] = None  # noqa: N815, UP045
    referencedColumnId: Optional[str] = None  # noqa: N815, UP045
    isOtherIndex: Optional[bool] = None  # noqa: N815, UP045


class CreateColumnRequest(BaseModel):
    """
    Alation CreateColumnRequest Model
    """

    key: str
    column_type: str
    title: Optional[str]  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    nullable: Optional[bool] = None  # noqa: UP045
    position: Optional[str] = None  # noqa: UP045
    index: Optional[ColumnIndex] = None  # noqa: UP045
    nullable: Optional[bool] = None  # noqa: PIE794, UP045


class CreateColumnRequestList(BaseModel):
    """
    Alation CreateColumnRequestList Model
    """

    root: List[CreateColumnRequest]  # noqa: UP006


class Column(BaseModel):
    """
    Alation Column Model
    """

    id: str
    name: str
    title: Optional[str] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    column_comment: Optional[str] = None  # noqa: UP045
    column_type: str
    position: Optional[str] = None  # noqa: UP045
    nullable: Optional[bool] = None  # noqa: UP045
    index: Optional[ColumnIndex] = None  # noqa: UP045
