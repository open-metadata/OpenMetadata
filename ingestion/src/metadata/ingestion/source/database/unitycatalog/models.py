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
Databricks Source Model module
"""

from typing import List, Optional, Union  # noqa: UP035

from pydantic import BaseModel


class DatabricksTable(BaseModel):
    name: Optional[str] = None  # noqa: UP045
    catalog_name: Optional[str] = None  # noqa: UP045
    schema_name: Optional[str] = None  # noqa: UP045
    table_type: Optional[str] = None  # noqa: UP045
    lineage_timestamp: Optional[str] = None  # noqa: UP045


class DatabricksColumn(BaseModel):
    name: Optional[str] = None  # noqa: UP045
    catalog_name: Optional[str] = None  # noqa: UP045
    schema_name: Optional[str] = None  # noqa: UP045
    table_name: Optional[str] = None  # noqa: UP045


class FileInfo(BaseModel):
    path: Optional[str] = None  # noqa: UP045
    has_permission: Optional[bool] = None  # noqa: UP045
    securable_name: Optional[str] = None  # noqa: UP045
    storage_location: Optional[str] = None  # noqa: UP045
    securable_type: Optional[str] = None  # noqa: UP045
    lineage_timestamp: Optional[str] = None  # noqa: UP045


class LineageEntity(BaseModel):
    tableInfo: Optional[DatabricksTable] = None  # noqa: N815, UP045
    fileInfo: Optional[FileInfo] = None  # noqa: N815, UP045


class LineageTableStreams(BaseModel):
    upstreams: Optional[List[LineageEntity]] = []  # noqa: UP006, UP045
    downstreams: Optional[List[LineageEntity]] = []  # noqa: UP006, UP045


class LineageColumnStreams(BaseModel):
    upstream_cols: Optional[List[DatabricksColumn]] = []  # noqa: UP006, UP045
    downstream_cols: Optional[List[DatabricksColumn]] = []  # noqa: UP006, UP045


class ForeignConstrains(BaseModel):
    child_columns: Optional[List[str]] = []  # noqa: UP006, UP045
    parent_columns: Optional[List[str]] = []  # noqa: UP006, UP045
    parent_table: str


class Metadata(BaseModel):
    comment: Optional[str] = None  # noqa: UP045


class ColumnJson(BaseModel):
    name: Optional[str] = None  # noqa: UP045
    type: Optional[Union["Type", str]] = None  # noqa: UP045
    metadata: Optional[Metadata] = None  # noqa: UP045


class ElementType(BaseModel):
    type: Optional[str] = None  # noqa: UP045
    fields: Optional[List[ColumnJson]] = None  # noqa: UP006, UP045


class Type(BaseModel):
    type: Optional[str] = None  # noqa: UP045
    elementType: Optional[Union[ElementType, str]] = None  # noqa: N815, UP007, UP045
    fields: Optional[List[ColumnJson]] = None  # noqa: UP006, UP045


ColumnJson.model_rebuild()
