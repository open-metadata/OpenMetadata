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

from typing import List, Optional  # noqa: UP035

from pydantic import BaseModel, Field


class SupersetDashboard(BaseModel):
    """Superset dashboard Model"""

    description: Optional[str] = None  # noqa: UP045
    id: Optional[int] = None  # noqa: UP045


class SupersetDashboardList(BaseModel):
    dashboards: Optional[List[SupersetDashboard]] = []  # noqa: UP006, UP045


class DashOwner(BaseModel):
    first_name: Optional[str] = None  # noqa: UP045
    id: Optional[int] = None  # noqa: UP045
    last_name: Optional[str] = None  # noqa: UP045
    username: Optional[str] = None  # noqa: UP045
    email: Optional[str] = None  # noqa: UP045


class DashboardResult(BaseModel):
    dashboard_title: Optional[str] = None  # noqa: UP045
    url: Optional[str] = None  # noqa: UP045
    owners: Optional[List[DashOwner]] = []  # noqa: UP006, UP045
    position_json: Optional[str] = None  # noqa: UP045
    id: Optional[int] = None  # noqa: UP045
    email: Optional[str] = None  # noqa: UP045
    published: Optional[bool] = None  # noqa: UP045


class SupersetDashboardCount(BaseModel):
    count: Optional[int] = None  # noqa: UP045
    ids: Optional[List[int]] = []  # noqa: UP006, UP045
    dashboard_title: Optional[str] = None  # noqa: UP045
    result: Optional[List[DashboardResult]] = []  # noqa: UP006, UP045


class FetchedDashboard(BaseModel):
    """Model for individual dashboard fetch response"""

    id: Optional[int] = None  # noqa: UP045
    result: Optional[DashboardResult] = DashboardResult()  # noqa: UP045


# Chart
class ChartTable(BaseModel):
    default_endpoint: Optional[str] = None  # noqa: UP045
    table_name: Optional[str] = None  # noqa: UP045


class ChartResult(BaseModel):
    datasource_id: Optional[int] = None  # noqa: UP045
    datasource_url: Optional[str] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    id: Optional[int] = None  # noqa: UP045
    table: Optional[ChartTable] = ChartTable()  # noqa: UP045
    url: Optional[str] = None  # noqa: UP045
    slice_name: Optional[str] = None  # noqa: UP045
    viz_type: Optional[str] = None  # noqa: UP045


class SupersetChart(BaseModel):
    count: Optional[int] = None  # noqa: UP045
    ids: Optional[List[int]] = []  # noqa: UP006, UP045
    result: Optional[List[ChartResult]] = []  # noqa: UP006, UP045


# DataSource
class DSColumns(BaseModel):
    column_name: Optional[str] = None  # noqa: UP045
    id: Optional[int] = None  # noqa: UP045
    type: Optional[str] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045


class DSDatabase(BaseModel):
    database_name: Optional[str] = None  # noqa: UP045
    id: Optional[int] = None  # noqa: UP045


class DataSourceResult(BaseModel):
    database: Optional[DSDatabase] = DSDatabase()  # noqa: UP045
    datasource_type: Optional[str] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    extra: Optional[str] = None  # noqa: UP045
    id: Optional[int] = None  # noqa: UP045
    owners: Optional[list] = []  # noqa: UP045
    table_schema: Optional[str] = Field(None, alias="schema")  # noqa: UP045
    sql: Optional[str] = None  # noqa: UP045
    table_name: Optional[str] = None  # noqa: UP045
    template_params: Optional[str] = None  # noqa: UP045
    url: Optional[str] = None  # noqa: UP045
    columns: Optional[List[DSColumns]] = []  # noqa: UP006, UP045


class SupersetDatasource(BaseModel):
    id: Optional[int] = None  # noqa: UP045
    result: Optional[DataSourceResult] = DataSourceResult()  # noqa: UP045
    show_title: Optional[str] = None  # noqa: UP045


# Database


class DbParameter(BaseModel):
    database: Optional[str] = None  # noqa: UP045
    host: Optional[str] = None  # noqa: UP045
    password: Optional[str] = None  # noqa: UP045
    port: Optional[int] = None  # noqa: UP045
    username: Optional[str] = None  # noqa: UP045


class DatabaseResult(BaseModel):
    database_name: Optional[str] = None  # noqa: UP045
    id: Optional[int] = None  # noqa: UP045
    parameters: Optional[DbParameter] = DbParameter()  # noqa: UP045


class ListDatabaseResult(BaseModel):
    count: Optional[int] = None  # noqa: UP045
    id: Optional[int] = None  # noqa: UP045
    result: Optional[DatabaseResult] = DatabaseResult()  # noqa: UP045


class FetchDashboard(BaseModel):
    id: Optional[int] = None  # noqa: UP045
    dashboard_title: Optional[str] = None  # noqa: UP045
    position_json: Optional[str] = None  # noqa: UP045
    published: Optional[bool] = None  # noqa: UP045
    email: Optional[str] = None  # noqa: UP045


class FetchChart(BaseModel):
    id: Optional[int] = None  # noqa: UP045
    slice_name: Optional[str] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    table_id: Optional[int] = None  # noqa: UP045
    table_name: Optional[str] = None  # noqa: UP045
    table_schema: Optional[str] = Field(None, alias="schema")  # noqa: UP045
    database_name: Optional[str] = None  # noqa: UP045
    sqlalchemy_uri: Optional[str] = None  # noqa: UP045
    viz_type: Optional[str] = None  # noqa: UP045
    datasource_id: Optional[int] = None  # noqa: UP045
    sql: Optional[str] = None  # noqa: UP045


class FetchColumn(BaseModel):
    id: Optional[int] = None  # noqa: UP045
    type: Optional[str] = None  # noqa: UP045
    column_name: Optional[str] = None  # noqa: UP045
    table_id: Optional[int] = None  # noqa: UP045
    table_name: Optional[str] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
