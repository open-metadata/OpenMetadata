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
Tableau Source Model module
"""

import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator

from metadata.generated.schema.entity.data.chart import ChartType
from metadata.generated.schema.entity.data.table import Table


class TableauBaseModel(BaseModel):
    """
    Tableau basic configurations
    """

    model_config = ConfigDict(extra="allow")

    # in case of personal space workbooks, the project id is returned as a UUID
    id: str | uuid.UUID
    name: str | None = None

    # pylint: disable=no-self-argument
    @field_validator("id", mode="before")
    def coerce_uuid_to_string(cls, value):  # noqa: N805
        """Ensure id is always stored as a string internally"""
        if isinstance(value, uuid.UUID):
            return str(value)
        return value

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

    model_config = ConfigDict(frozen=True)

    label: str


class TableauDataModelTag(BaseModel):
    """
    Aux class for Tag object for Tableau Data Model
    """

    name: str


class TableauOwner(TableauBaseModel):
    """
    Aux class for Owner object of the tableau_api_lib response
    """

    email: str | None = None


class TableauDatasource(BaseModel):
    """
    Model for downstream datasource information
    """

    id: str | None = None
    name: str | None = None


class CustomSQLTable(TableauBaseModel):
    """
    GraphQL API CustomSQLTable schema
    https://help.tableau.com/current/api/metadata_api/en-us/reference/customsqltable.doc.html
    """

    downstreamDatasources: list[TableauDatasource] | None = None  # noqa: N815
    query: str | None = None


class CustomSQLTablesResponse(BaseModel):
    """
    Model for the custom SQL tables response
    """

    data: dict[str, list[CustomSQLTable]]


class UpstreamColumn(BaseModel):
    id: str
    name: str | None = None
    remoteType: str | None = None  # noqa: N815


class DatasourceField(BaseModel):
    id: str
    name: str | None = None
    upstreamColumns: list[UpstreamColumn | None] | None = None  # noqa: N815
    description: str | None = None
    formula: str | None = None


class UpstreamTableColumn(BaseModel):
    id: str
    name: str | None = None


class TableauDatabase(BaseModel):
    id: str
    name: str | None = None


class UpstreamTable(BaseModel):
    id: str
    luid: str
    name: str | None = None
    fullName: str | None = None  # noqa: N815
    schema_: str | None = Field(None, alias="schema")
    columns: list[UpstreamTableColumn] | None = None
    database: TableauDatabase | None = None
    referencedByQueries: list[CustomSQLTable] | None = None  # noqa: N815

    @field_validator("referencedByQueries", mode="before")
    @classmethod
    def filter_none_queries(cls, v):
        """Filter out CustomSQLTable items where query==None."""
        if v is None:
            return None
        return [item for item in v if item.get("query") is not None]


class DataSource(BaseModel):
    id: str
    name: str | None = None
    description: str | None = None
    projectName: str | None = None  # noqa: N815
    tags: list[TableauDataModelTag] | None = []
    fields: list[DatasourceField] | None = None
    upstreamTables: list[UpstreamTable] | None = None  # noqa: N815
    upstreamDatasources: list["DataSource"] | None = None  # noqa: N815


class TableauDatasources(BaseModel):
    nodes: list[DataSource] | None = None
    totalCount: int | None = None  # noqa: N815


class TableauDatasourcesConnection(BaseModel):
    embeddedDatasourcesConnection: TableauDatasources | None = None  # noqa: N815


class TableauChart(TableauBaseModel):
    """
    Aux class for Chart object of the tableau_api_lib response
    """

    owner: TableauOwner | None = None
    tags: set | None = []
    contentUrl: str | None = ""  # noqa: N815
    sheetType: str | None = ChartType.Other.value  # noqa: N815


class TableauDashboard(TableauBaseModel):
    """
    Aux class for Dashboard object of the tableau_api_lib response
    """

    model_config = ConfigDict(extra="allow")

    project: TableauBaseModel | None = None
    description: str | None = None
    owner: TableauOwner | None = None
    tags: set | None = []
    webpageUrl: str | None = None  # noqa: N815
    charts: list[TableauChart] | None = None
    dataModels: list[DataSource] | None = []  # noqa: N815
    custom_sql_queries: list[str] | None = None
    user_views: int | None = None


class TableAndQuery(BaseModel):
    """
    Wrapper class for Table entity and associated Query for lineage
    """

    table: Table
    query: str | None = None
