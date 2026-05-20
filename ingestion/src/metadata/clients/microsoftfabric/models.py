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
Microsoft Fabric API Response Models

Pydantic models for Microsoft Fabric REST API responses.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional  # noqa: UP035

from pydantic import BaseModel, ConfigDict, Field

from metadata.generated.schema.entity.data.storedProcedure import Language


class FabricItemType(str, Enum):
    """Types of items in a Fabric workspace"""

    WAREHOUSE = "Warehouse"
    LAKEHOUSE = "Lakehouse"
    DATA_PIPELINE = "DataPipeline"
    NOTEBOOK = "Notebook"
    REPORT = "Report"
    SEMANTIC_MODEL = "SemanticModel"
    DATAFLOW_GEN2 = "DataflowGen2"
    SPARK_JOB_DEFINITION = "SparkJobDefinition"
    EVENTSTREAM = "Eventstream"
    KQL_DATABASE = "KQLDatabase"
    KQL_QUERYSET = "KQLQueryset"
    ML_MODEL = "MLModel"
    ML_EXPERIMENT = "MLExperiment"


class FabricWorkspace(BaseModel):
    """Fabric workspace model"""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    display_name: str = Field(alias="displayName")
    description: Optional[str] = None  # noqa: UP045
    type: Optional[str] = None  # noqa: UP045
    capacity_id: Optional[str] = Field(default=None, alias="capacityId")  # noqa: UP045


class FabricItem(BaseModel):
    """Generic Fabric item model (Warehouse, Lakehouse, etc.)"""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    display_name: str = Field(alias="displayName")
    description: Optional[str] = None  # noqa: UP045
    type: str
    workspace_id: Optional[str] = Field(default=None, alias="workspaceId")  # noqa: UP045


class FabricWarehouse(BaseModel):
    """Fabric Warehouse details"""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    display_name: str = Field(alias="displayName")
    description: Optional[str] = None  # noqa: UP045
    workspace_id: Optional[str] = Field(default=None, alias="workspaceId")  # noqa: UP045
    connection_string: Optional[str] = Field(default=None, alias="connectionString")  # noqa: UP045
    # SQL endpoint for connecting via T-SQL
    sql_endpoint_properties: Optional[Dict[str, Any]] = Field(default=None, alias="properties")  # noqa: UP006, UP045


class FabricLakehouse(BaseModel):
    """Fabric Lakehouse details"""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    display_name: str = Field(alias="displayName")
    description: Optional[str] = None  # noqa: UP045
    workspace_id: Optional[str] = Field(default=None, alias="workspaceId")  # noqa: UP045
    # OneLake path for the lakehouse
    onelake_tables_path: Optional[str] = Field(default=None, alias="oneLakeTablesPath")  # noqa: UP045
    onelake_files_path: Optional[str] = Field(default=None, alias="oneLakeFilesPath")  # noqa: UP045
    # SQL endpoint for connecting via T-SQL
    sql_endpoint_properties: Optional[Dict[str, Any]] = Field(default=None, alias="properties")  # noqa: UP006, UP045


class FabricPipeline(BaseModel):
    """Fabric Data Pipeline model"""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    display_name: str = Field(alias="displayName")
    description: Optional[str] = None  # noqa: UP045
    workspace_id: Optional[str] = Field(default=None, alias="workspaceId")  # noqa: UP045


class FabricPipelineRunStatus(str, Enum):
    """Pipeline run status"""

    IN_PROGRESS = "InProgress"
    COMPLETED = "Completed"
    FAILED = "Failed"
    CANCELLED = "Cancelled"
    NOT_STARTED = "NotStarted"
    DEDUPED = "Deduped"


class FabricPipelineRun(BaseModel):
    """Fabric Pipeline Run model"""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    pipeline_id: Optional[str] = Field(default=None, alias="itemId")  # noqa: UP045
    status: Optional[str] = None  # noqa: UP045
    start_time: Optional[datetime] = Field(default=None, alias="startTimeUtc")  # noqa: UP045
    end_time: Optional[datetime] = Field(default=None, alias="endTimeUtc")  # noqa: UP045
    invoker_type: Optional[str] = Field(default=None, alias="invokeType")  # noqa: UP045
    job_type: Optional[str] = Field(default=None, alias="jobType")  # noqa: UP045
    failure_reason: Optional[Dict[str, Any]] = Field(default=None, alias="failureReason")  # noqa: UP006, UP045


class FabricActivity(BaseModel):
    """Fabric Pipeline Activity model"""

    model_config = ConfigDict(populate_by_name=True)

    name: str
    type: str
    description: Optional[str] = None  # noqa: UP045
    depends_on: Optional[List[Dict[str, Any]]] = Field(default=None, alias="dependsOn")  # noqa: UP006, UP045
    # Activity-specific properties (Copy, Notebook, etc.)
    type_properties: Optional[Dict[str, Any]] = Field(default=None, alias="typeProperties")  # noqa: UP006, UP045


class FabricActivityRun(BaseModel):
    """Fabric Activity Run model - represents execution of a single activity/task"""

    model_config = ConfigDict(populate_by_name=True)

    pipeline_id: str = Field(alias="pipelineId")
    pipeline_run_id: str = Field(alias="pipelineRunId")
    activity_name: str = Field(alias="activityName")
    activity_type: str = Field(alias="activityType")
    activity_run_id: str = Field(alias="activityRunId")
    status: str
    activity_run_start: datetime = Field(alias="activityRunStart")
    activity_run_end: Optional[datetime] = Field(default=None, alias="activityRunEnd")  # noqa: UP045
    duration_in_ms: Optional[int] = Field(default=None, alias="durationInMs")  # noqa: UP045
    input: Optional[Dict[str, Any]] = None  # noqa: UP006, UP045
    output: Optional[Dict[str, Any]] = None  # noqa: UP006, UP045
    error: Optional[Dict[str, Any]] = None  # noqa: UP006, UP045
    retry_attempt: Optional[int] = Field(default=None, alias="retryAttempt")  # noqa: UP045
    recovery_status: Optional[str] = Field(default=None, alias="recoveryStatus")  # noqa: UP045


class FabricSqlEndpoint(BaseModel):
    """SQL Endpoint information for Warehouse/Lakehouse"""

    model_config = ConfigDict(populate_by_name=True)

    connection_string: Optional[str] = Field(default=None, alias="connectionString")  # noqa: UP045
    id: Optional[str] = None  # noqa: UP045
    provisioning_status: Optional[str] = Field(default=None, alias="provisioningStatus")  # noqa: UP045


class FabricStoredProcedure(BaseModel):
    """Stored procedures"""

    name: str = Field(...)
    definition: str = Field(None)
    language: str = Field(Language.SQL)
