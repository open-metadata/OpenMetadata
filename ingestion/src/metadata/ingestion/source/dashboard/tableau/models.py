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
Tableau Source Model module
"""

from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Extra, Field, validator


class TableauBaseModel(BaseModel):
    """
    Tableau basic configurations
    """

    class Config:
        extra = Extra.allow

    id: str
    name: Optional[str]

    def __hash__(self):
        return hash(self.id)

    def __eq__(self, other):
        return isinstance(other, type(self)) and self.id == other.id


class ChartUrl:
    workbook_name: str
    sheets: str
    chart_url_name: str

    def __init__(self, context_url: str) -> None:
        self.workbook_name, self.sheets, self.chart_url_name = (
            context_url.split("/") if "/" in context_url else ["", "", ""]
        )


class TableauTag(BaseModel):
    """
    Aux class for Tag object of the tableau_api_lib response
    """

    class Config:
        frozen = True

    label: str


class TableauOwner(TableauBaseModel):
    """
    Aux class for Owner object of the tableau_api_lib response
    """

    email: Optional[str]


def transform_tags(raw: Union[Dict[str, Any], List[TableauTag]]) -> List[TableauTag]:
    if isinstance(raw, List):
        return raw
    tags = []
    for tag in raw.get("tag", []):
        tags.append(TableauTag(**tag))
    return tags


class TableauChart(TableauBaseModel):
    """
    Aux class for Chart object of the tableau_api_lib response
    """

    workbook: TableauBaseModel
    owner: Optional[TableauOwner]
    tags: List[TableauTag]
    _extract_tags = validator("tags", pre=True, allow_reuse=True)(transform_tags)
    contentUrl: str
    sheetType: str
    viewUrlName: str


class TableauDashboard(TableauBaseModel):
    """
    Aux class for Dashboard object of the tableau_api_lib response
    """

    class Config:
        extra = Extra.allow

    description: Optional[str]
    owner: TableauOwner
    tags: List[TableauTag]
    _extract_tags = validator("tags", pre=True, allow_reuse=True)(transform_tags)
    webpageUrl: str
    charts: Optional[List[TableauChart]]


class CustomSQLTable(TableauBaseModel):
    """
    GraphQL API CustomSQLTable schema
    https://help.tableau.com/current/api/metadata_api/en-us/reference/customsqltable.doc.html
    """

    query: Optional[str]


class DatabaseTable(TableauBaseModel):
    """
    GraphQL API FieldDataType schema
    https://help.tableau.com/current/api/metadata_api/en-us/reference/databasetable.doc.html
    """

    schema_: str = Field(..., alias="schema")
    upstreamDatabases: Optional[List[TableauBaseModel]]
    referencedByQueries: Optional[List[CustomSQLTable]]


class Workbook(TableauBaseModel):
    """
    GraphQL API FieldDataType schema
    https://help.tableau.com/current/api/metadata_api/en-us/reference/workbook.doc.html
    """

    luid: str
    upstreamTables: List[DatabaseTable]


class FieldDataType(Enum):
    """
    GraphQL API FieldDataType schema
    https://help.tableau.com/current/api/metadata_api/en-us/reference/fielddatatype.doc.html
    """

    INTEGER = "INTEGER"
    REAL = "REAL"
    STRING = "STRING"
    DATETIME = "DATETIME"
    DATE = "DATE"
    TUPLE = "TUPLE"
    SPATIAL = "SPATIAL"
    BOOLEAN = "BOOLEAN"
    TABLE = "TABLE"
    UNKNOWN = "UNKNOWN"


class CalculatedField(TableauBaseModel):
    """
    GraphQL API CalculatedField schema
    https://help.tableau.com/current/api/metadata_api/en-us/reference/calculatedfield.doc.html
    """

    dataType: FieldDataType


class ColumnField(TableauBaseModel):
    """
    GraphQL API ColumnField schema
    https://help.tableau.com/current/api/metadata_api/en-us/reference/columnfield.doc.html
    """

    dataType: FieldDataType


class DatasourceField(TableauBaseModel):
    """
    GraphQL API DatasourceField schema
    https://help.tableau.com/current/api/metadata_api/en-us/reference/datasourcefield.doc.html
    """

    remoteField: Optional[ColumnField]
    upstreamTables: List[DatabaseTable] = []


class Sheet(TableauBaseModel):
    """
    GraphQL API Sheet schema
    https://help.tableau.com/current/api/metadata_api/en-us/reference/sheet.doc.html
    """

    description: Optional[str]
    worksheetFields: List[CalculatedField]
    datasourceFields: List[DatasourceField]


class TableauSheets(BaseModel):
    """
    Aux class to handle response from GraphQL API
    """

    sheets: List[Sheet] = []
