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
Glue Pipeline Source Model module
"""

from pydantic import BaseModel, Field


class EntityDetails(BaseModel):
    Value: str


class SourceDetails(BaseModel):
    schema_details: EntityDetails = Field(alias="Schema")
    table_details: EntityDetails = Field(alias="Table")


class AmazonRedshift(BaseModel):
    Name: str
    Data: SourceDetails
    database_name: str | None = None

    @property
    def table_name(self):
        if self.Data:
            return self.Data.table_details.Value
        return None

    @property
    def schema_name(self):
        if self.Data:
            return self.Data.schema_details.Value
        return None


class CatalogSource(BaseModel):
    Name: str
    database_name: str = Field(alias="Database")
    schema_name: str | None = None
    table_name: str = Field(alias="Table")


class JDBCSource(BaseModel):
    Name: str
    schema_name: str | None = Field(default=None, alias="SchemaName")
    database_name: str | None = None
    table_name: str = Field(alias="ConnectionTable")


class S3Source(BaseModel):
    Name: str
    Paths: list[str]


class S3Target(BaseModel):
    Name: str
    Path: str
    Paths: str | None = None


class SnowflakeNodeData(BaseModel):
    database_name: str | None = Field(default=None, alias="Database")
    schema_name: str | None = Field(default=None, alias="Schema")
    table_name: str | None = Field(default=None, alias="Table")


class SnowflakeNode(BaseModel):
    """Glue Studio visual node `SnowflakeSource` / `SnowflakeTarget` (Data is a `SnowflakeNodeData`)."""

    Name: str
    Data: SnowflakeNodeData | None = None

    @property
    def table_name(self):
        return self.Data.table_name if self.Data else None

    @property
    def schema_name(self):
        return self.Data.schema_name if self.Data else None

    @property
    def database_name(self):
        return self.Data.database_name if self.Data else None


class JobCommand(BaseModel):
    Name: str | None = None
    ScriptLocation: str | None = None
    PythonVersion: str | None = None


class JobConnections(BaseModel):
    Connections: list[str] | None = None


class JobNodes(BaseModel):
    config_nodes: dict | None = Field(default=None, alias="CodeGenConfigurationNodes")
    command: JobCommand | None = Field(default=None, alias="Command")
    connections: JobConnections | None = Field(default=None, alias="Connections")
    default_arguments: dict | None = Field(default=None, alias="DefaultArguments")


class JobNodeResponse(BaseModel):
    Job: JobNodes | None = None
