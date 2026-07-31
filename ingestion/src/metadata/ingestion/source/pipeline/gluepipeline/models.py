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

from typing import List, Optional  # noqa: UP035

from pydantic import BaseModel, Field


class EntityDetails(BaseModel):
    Value: str


class SourceDetails(BaseModel):
    schema_details: EntityDetails = Field(alias="Schema")
    table_details: EntityDetails = Field(alias="Table")


class AmazonRedshift(BaseModel):
    Name: str
    Data: SourceDetails
    database_name: Optional[str] = None  # noqa: UP045

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
    schema_name: Optional[str] = None  # noqa: UP045
    table_name: str = Field(alias="Table")


class JDBCSource(BaseModel):
    Name: str
    schema_name: Optional[str] = Field(default=None, alias="SchemaName")  # noqa: UP045
    database_name: Optional[str] = None  # noqa: UP045
    table_name: str = Field(alias="ConnectionTable")


class S3Source(BaseModel):
    Name: str
    Paths: List[str]  # noqa: UP006


class S3Target(BaseModel):
    Name: str
    Path: str
    Paths: Optional[str] = None  # noqa: UP045


class JobCommand(BaseModel):
    Name: Optional[str] = None  # noqa: UP045
    ScriptLocation: Optional[str] = None  # noqa: UP045
    PythonVersion: Optional[str] = None  # noqa: UP045


class JobConnections(BaseModel):
    Connections: Optional[List[str]] = None  # noqa: UP006, UP045


class JobNodes(BaseModel):
    config_nodes: Optional[dict] = Field(default=None, alias="CodeGenConfigurationNodes")  # noqa: UP045
    command: Optional[JobCommand] = Field(default=None, alias="Command")  # noqa: UP045
    connections: Optional[JobConnections] = Field(default=None, alias="Connections")  # noqa: UP045
    default_arguments: Optional[dict] = Field(default=None, alias="DefaultArguments")  # noqa: UP045


class JobNodeResponse(BaseModel):
    Job: Optional[JobNodes] = None  # noqa: UP045
