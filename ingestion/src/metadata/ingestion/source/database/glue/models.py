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

from pydantic import BaseModel, ConfigDict


class GlueSchema(BaseModel):
    CatalogId: Optional[str] = None  # noqa: UP045
    Name: str
    Description: Optional[str] = None  # noqa: UP045


class DatabasePage(BaseModel):
    DatabaseList: Optional[List[GlueSchema]] = []  # noqa: UP006, UP045


class TableParameters(BaseModel):
    # Glue table parameters are operator-authored key/values. A closed model drops every key but
    # the one we branch on, which would leave nothing to ingest as custom properties.
    model_config = ConfigDict(extra="allow")

    table_type: Optional[str] = None  # noqa: UP045


class Column(BaseModel):
    Type: str
    Name: str
    Comment: Optional[str] = None  # noqa: UP045
    # GetTables returns these, so the Iceberg flag below needs no extra API call.
    Parameters: Optional[dict[str, str]] = None  # noqa: UP045

    def is_current_iceberg_field(self) -> bool:
        """Iceberg keeps a dropped field in the schema flagged current=false.

        Only that explicit "false" retires a column: a field Iceberg never annotated,
        and every column of a non-Iceberg table, is current.
        """
        return (self.Parameters or {}).get("iceberg.field.current") != "false"


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
    ViewOriginalText: Optional[str] = None  # noqa: UP045
    ViewExpandedText: Optional[str] = None  # noqa: UP045


class TablePage(BaseModel):
    TableList: Optional[List[GlueTable]] = []  # noqa: UP006, UP045
