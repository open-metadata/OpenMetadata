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

from pydantic import BaseModel


class CreateDatasourceRequest(BaseModel):
    """
    Alation CreateDatasourceRequest Model
    """

    uri: str
    connector_id: int
    db_username: str
    db_password: str | None = None
    title: str
    description: str | None = None


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
    description: str | None = None


class CreateSchemaRequestList(BaseModel):
    """
    Alation CreateSchemaRequestList Model
    """

    root: list[CreateSchemaRequest]


class Schema(BaseModel):
    """
    Alation Schema Model
    """

    id: str
    name: str
    title: str | None = None
    description: str | None = None


class CreateTableRequest(BaseModel):
    """
    Alation CreateTableRequest Model
    """

    key: str
    title: str
    description: str | None = None
    table_type: str | None = None
    sql: str | None = None


class CreateTableRequestList(BaseModel):
    """
    Alation CreateTableRequestList Model
    """

    root: list[CreateTableRequest]


class Table(BaseModel):
    """
    Alation Table Model
    """

    id: str
    name: str
    title: str | None = None


class ColumnIndex(BaseModel):
    """
    Alation Index Model
    """

    isPrimaryKey: bool | None = None  # noqa: N815
    isForeignKey: bool | None = None  # noqa: N815
    referencedColumnId: str | None = None  # noqa: N815
    isOtherIndex: bool | None = None  # noqa: N815


class CreateColumnRequest(BaseModel):
    """
    Alation CreateColumnRequest Model
    """

    key: str
    column_type: str
    title: str | None
    description: str | None = None
    nullable: bool | None = None
    position: str | None = None
    index: ColumnIndex | None = None
    nullable: bool | None = None  # noqa: PIE794


class CreateColumnRequestList(BaseModel):
    """
    Alation CreateColumnRequestList Model
    """

    root: list[CreateColumnRequest]


class Column(BaseModel):
    """
    Alation Column Model
    """

    id: str
    name: str
    title: str | None = None
    description: str | None = None
    column_comment: str | None = None
    column_type: str
    position: str | None = None
    nullable: bool | None = None
    index: ColumnIndex | None = None
