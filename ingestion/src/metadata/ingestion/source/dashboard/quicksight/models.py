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
Pydantic Model to validate Quick Sight responses
"""

from pydantic import BaseModel, Field


class DataSourceResp(BaseModel):
    datasource_arn: str = Field(alias="DataSourceArn")
    schema_name: str = Field(alias="Schema")
    table_name: str = Field(alias="Name")
    columns: list | None = Field(alias="InputColumns")


class DataSourceRespQuery(BaseModel):
    datasource_arn: str = Field(alias="DataSourceArn")
    query: str = Field(alias="SqlQuery")
    table_name: str = Field(alias="Name")
    columns: list | None = Field(alias="Columns")


class DataSourceRespS3(BaseModel):
    datasource_arn: str = Field(alias="DataSourceArn")
    columns: list | None = Field(alias="InputColumns")


class VersionSheet(BaseModel):
    ChartId: str | None = Field(None, alias="SheetId")
    Name: str | None = None


class DashboardVersion(BaseModel):
    Status: str | None = None
    Arn: str | None = None
    SourceEntityArn: str | None = None
    DataSetArns: list | None = None
    Description: str | None = None
    Charts: list[VersionSheet] | None = Field(None, alias="Sheets")


class DashboardDetail(BaseModel):
    DashboardId: str
    Arn: str | None = None
    Name: str
    Version: DashboardVersion | None = None


class DashboardResp(BaseModel):
    Dashboard: DashboardDetail
    Status: int | None = None
    RequestId: str | None = None


class DataSourceModel(BaseModel):
    Name: str
    Type: str
    DataSourceId: str
    DataSourceParameters: dict | None = None
    data_source_resp: DataSourceRespS3 | DataSourceRespQuery | DataSourceResp | None = None


class DescribeDataSourceResponse(BaseModel):
    DataSource: DataSourceModel | None = None
    RequestId: str | None = None
    Status: int | None = None
    dataset_id: str | None = None
    dataset_name: str | None = None
