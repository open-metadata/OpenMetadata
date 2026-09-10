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
Superset source models.
"""

from pydantic import BaseModel, Field


class SupersetDashboard(BaseModel):
    """Superset dashboard Model"""

    description: str | None = None
    id: int | None = None


class SupersetDashboardList(BaseModel):
    dashboards: list[SupersetDashboard] | None = []


class DashOwner(BaseModel):
    first_name: str | None = None
    id: int | None = None
    last_name: str | None = None
    username: str | None = None
    email: str | None = None


class DashboardResult(BaseModel):
    dashboard_title: str | None = None
    url: str | None = None
    owners: list[DashOwner] | None = []
    position_json: str | None = None
    id: int | None = None
    email: str | None = None
    published: bool | None = None


class SupersetDashboardCount(BaseModel):
    count: int | None = None
    ids: list[int] | None = []
    dashboard_title: str | None = None
    result: list[DashboardResult] | None = []


class FetchedDashboard(BaseModel):
    """Model for individual dashboard fetch response"""

    id: int | None = None
    result: DashboardResult | None = DashboardResult()


# Chart
class ChartTable(BaseModel):
    default_endpoint: str | None = None
    table_name: str | None = None


class ChartResult(BaseModel):
    datasource_id: int | None = None
    datasource_url: str | None = None
    description: str | None = None
    id: int | None = None
    table: ChartTable | None = ChartTable()
    url: str | None = None
    slice_name: str | None = None
    viz_type: str | None = None


class SupersetChart(BaseModel):
    count: int | None = None
    ids: list[int] | None = []
    result: list[ChartResult] | None = []


# DataSource
class DSColumns(BaseModel):
    column_name: str | None = None
    id: int | None = None
    type: str | None = None
    description: str | None = None
    expression: str | None = None


class DSDatabase(BaseModel):
    database_name: str | None = None
    id: int | None = None


class DataSourceResult(BaseModel):
    database: DSDatabase | None = DSDatabase()
    datasource_type: str | None = None
    description: str | None = None
    extra: str | None = None
    id: int | None = None
    owners: list | None = []
    table_schema: str | None = Field(None, alias="schema")
    sql: str | None = None
    table_name: str | None = None
    template_params: str | None = None
    url: str | None = None
    columns: list[DSColumns] | None = []


class SupersetDatasource(BaseModel):
    id: int | None = None
    result: DataSourceResult | None = DataSourceResult()
    show_title: str | None = None


# Database


class DbParameter(BaseModel):
    database: str | None = None
    host: str | None = None
    password: str | None = None
    port: int | None = None
    username: str | None = None


class DatabaseResult(BaseModel):
    database_name: str | None = None
    id: int | None = None
    parameters: DbParameter | None = DbParameter()


class ListDatabaseResult(BaseModel):
    count: int | None = None
    id: int | None = None
    result: DatabaseResult | None = DatabaseResult()


class FetchDashboard(BaseModel):
    id: int | None = None
    dashboard_title: str | None = None
    position_json: str | None = None
    published: bool | None = None
    email: str | None = None


class FetchChart(BaseModel):
    id: int | None = None
    slice_name: str | None = None
    description: str | None = None
    table_id: int | None = None
    table_name: str | None = None
    table_schema: str | None = Field(None, alias="schema")
    database_name: str | None = None
    sqlalchemy_uri: str | None = None
    viz_type: str | None = None
    datasource_id: int | None = None
    sql: str | None = None


class FetchColumn(BaseModel):
    id: int | None = None
    type: str | None = None
    column_name: str | None = None
    table_id: int | None = None
    table_name: str | None = None
    description: str | None = None
    expression: str | None = None
