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
ConfluentCDC Source Model module
"""

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class ConfluentCdcTasks(BaseModel):
    id: int = Field(..., description="ID of the task")
    state: Optional[str] = Field(
        default="UNASSIGNED", description="State of the task (e.g., RUNNING, STOPPED)"
    )
    worker_id: Optional[str] = Field(
        default=None, description="ID of the worker running the task"
    )


class ConfluentCdcTopics(BaseModel):
    name: str = Field(..., description="Name of the topic")


class ConfluentCdcColumnMapping(BaseModel):
    source_column: str = Field(..., description="Source MySQL column name")
    target_column: str = Field(..., description="Target Postgres column name")
    source_type: Optional[str] = Field(default=None, description="Source column type")
    target_type: Optional[str] = Field(default=None, description="Target column type")


class ConfluentCdcTableMapping(BaseModel):
    source_database: Optional[str] = None
    source_schema: Optional[str] = None
    source_table: str = Field(..., description="Source MySQL table name")
    target_database: Optional[str] = None
    target_schema: Optional[str] = None
    target_table: str = Field(..., description="Target Postgres table name")
    column_mappings: List[ConfluentCdcColumnMapping] = Field(
        default_factory=list, description="Column-level mappings"
    )


class ConfluentCdcPipelineDetails(BaseModel):
    name: str = Field(..., description="Name of the CDC connector")
    status: Optional[str] = Field(
        default="UNASSIGNED",
        description="State of the connector (e.g., RUNNING, STOPPED)",
    )
    tasks: Optional[List[ConfluentCdcTasks]] = Field(default_factory=list)
    topics: Optional[List[ConfluentCdcTopics]] = Field(default_factory=list)
    conn_type: Optional[str] = Field(default="UNKNOWN", alias="type")
    description: Optional[str] = None
    table_mappings: List[ConfluentCdcTableMapping] = Field(
        default_factory=list, description="Table and column mappings for CDC"
    )
    config: Optional[Dict] = Field(default_factory=dict)
