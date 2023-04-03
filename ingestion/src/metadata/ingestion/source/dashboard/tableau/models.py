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
from typing import List, Optional

from pydantic import BaseModel, Extra


class TableauBaseModel(BaseModel):
    """
    Tableau basic configurations
    """

    class Config:
        extra = Extra.allow

    id: str
    name: str


class TableauOwner(TableauBaseModel):
    """
    Tableau Owner Details
    """

    email: str


class TableauChart(TableauBaseModel):
    """
    Chart (View) representation from API
    """

    workbook_id: str
    sheet_type: str
    view_url_name: str
    content_url: str
    tags: List[str]


class ChartUrl:
    workbook_name: str
    sheets: str
    chart_url_name: str

    def __init__(self, context_url: str) -> None:
        self.workbook_name, self.sheets, self.chart_url_name = (
            context_url.split("/") if "/" in context_url else ["", "", ""]
        )


class TableauDashboard(TableauBaseModel):
    """
    Response from Tableau API
    """

    description: Optional[str]
    tags: List[str]
    owner: Optional[TableauOwner]
    charts: Optional[List[TableauChart]]
    webpage_url: Optional[str]


class TableauDataModelColumnDataType(Enum):
    """
    Column Data Type for Tablea Data Model
    ref ->
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


class WorksheetField(TableauBaseModel):
    dataType: TableauDataModelColumnDataType


class RemoteField(BaseModel):
    dataType: TableauDataModelColumnDataType


class DatasourceField(TableauBaseModel):
    remoteField: RemoteField


class TableauDataModel(TableauBaseModel):
    """
    Tableau Data Model
    """

    description: Optional[str]
    tags: Optional[List[str]]
    owners: Optional[List[TableauOwner]]
    worksheetFields: List[WorksheetField]
    datasourceFields: List[DatasourceField]


class TableauSheets(BaseModel):
    """
    Tableau Sheets
    """

    sheets: List[TableauDataModel] = []
