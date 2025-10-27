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

from typing import List, Optional, Union

from pydantic import BaseModel


class DatabricksTable(BaseModel):
    name: Optional[str] = None
    catalog_name: Optional[str] = None
    schema_name: Optional[str] = None
    table_type: Optional[str] = None
    lineage_timestamp: Optional[str] = None


class DatabricksColumn(BaseModel):
    name: Optional[str] = None
    catalog_name: Optional[str] = None
    schema_name: Optional[str] = None
    table_name: Optional[str] = None


class FileInfo(BaseModel):
    path: Optional[str] = None
    has_permission: Optional[bool] = None
    securable_name: Optional[str] = None
    storage_location: Optional[str] = None
    securable_type: Optional[str] = None
    lineage_timestamp: Optional[str] = None


class LineageEntity(BaseModel):
    tableInfo: Optional[DatabricksTable] = None
    fileInfo: Optional[FileInfo] = None


class LineageTableStreams(BaseModel):
    upstreams: Optional[List[LineageEntity]] = []
    downstreams: Optional[List[LineageEntity]] = []


class LineageColumnStreams(BaseModel):
    upstream_cols: Optional[List[DatabricksColumn]] = []
    downstream_cols: Optional[List[DatabricksColumn]] = []


class ForeignConstrains(BaseModel):
    child_columns: Optional[List[str]] = []
    parent_columns: Optional[List[str]] = []
    parent_table: str


class Metadata(BaseModel):
    comment: Optional[str] = None


class ColumnJson(BaseModel):
    name: Optional[str] = None
    type: Optional[Union["Type", str]] = None
    metadata: Optional[Metadata] = None


class ElementType(BaseModel):
    type: Optional[str] = None
    fields: Optional[List[ColumnJson]] = None


class Type(BaseModel):
    type: Optional[str] = None
    elementType: Optional[Union[ElementType, str]] = None
    fields: Optional[List[ColumnJson]] = None


ColumnJson.model_rebuild()
