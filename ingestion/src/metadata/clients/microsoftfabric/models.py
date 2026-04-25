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
from typing import Any, Dict, List, Optional

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
    description: Optional[str] = None
    type: Optional[str] = None
    capacity_id: Optional[str] = Field(default=None, alias="capacityId")


class FabricItem(BaseModel):
    """Generic Fabric item model (Warehouse, Lakehouse, etc.)"""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    display_name: str = Field(alias="displayName")
    description: Optional[str] = None
    type: str
    workspace_id: Optional[str] = Field(default=None, alias="workspaceId")


class FabricWarehouse(BaseModel):
    """Fabric Warehouse details"""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    display_name: str = Field(alias="displayName")
    description: Optional[str] = None
    workspace_id: Optional[str] = Field(default=None, alias="workspaceId")
    connection_string: Optional[str] = Field(default=None, alias="connectionString")
    # SQL endpoint for connecting via T-SQL
    sql_endpoint_properties: Optional[Dict[str, Any]] = Field(
        default=None, alias="properties"
    )


class FabricLakehouse(BaseModel):
    """Fabric Lakehouse details"""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    display_name: str = Field(alias="displayName")
    description: Optional[str] = None
    workspace_id: Optional[str] = Field(default=None, alias="workspaceId")
    # OneLake path for the lakehouse
    onelake_tables_path: Optional[str] = Field(default=None, alias="oneLakeTablesPath")
    onelake_files_path: Optional[str] = Field(default=None, alias="oneLakeFilesPath")
    # SQL endpoint for connecting via T-SQL
    sql_endpoint_properties: Optional[Dict[str, Any]] = Field(
        default=None, alias="properties"
    )


class FabricPipeline(BaseModel):
    """Fabric Data Pipeline model"""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    display_name: str = Field(alias="displayName")
    description: Optional[str] = None
    workspace_id: Optional[str] = Field(default=None, alias="workspaceId")


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
    pipeline_id: Optional[str] = Field(default=None, alias="itemId")
    status: Optional[str] = None
    start_time: Optional[datetime] = Field(default=None, alias="startTimeUtc")
    end_time: Optional[datetime] = Field(default=None, alias="endTimeUtc")
    invoker_type: Optional[str] = Field(default=None, alias="invokeType")
    job_type: Optional[str] = Field(default=None, alias="jobType")
    failure_reason: Optional[Dict[str, Any]] = Field(
        default=None, alias="failureReason"
    )


class FabricActivity(BaseModel):
    """Fabric Pipeline Activity model"""

    model_config = ConfigDict(populate_by_name=True)

    name: str
    type: str
    description: Optional[str] = None
    depends_on: Optional[List[Dict[str, Any]]] = Field(default=None, alias="dependsOn")
    # Activity-specific properties (Copy, Notebook, etc.)
    type_properties: Optional[Dict[str, Any]] = Field(
        default=None, alias="typeProperties"
    )


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
    activity_run_end: Optional[datetime] = Field(default=None, alias="activityRunEnd")
    duration_in_ms: Optional[int] = Field(default=None, alias="durationInMs")
    input: Optional[Dict[str, Any]] = None
    output: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None
    retry_attempt: Optional[int] = Field(default=None, alias="retryAttempt")
    recovery_status: Optional[str] = Field(default=None, alias="recoveryStatus")


class FabricSqlEndpoint(BaseModel):
    """SQL Endpoint information for Warehouse/Lakehouse"""

    model_config = ConfigDict(populate_by_name=True)

    connection_string: Optional[str] = Field(default=None, alias="connectionString")
    id: Optional[str] = None
    provisioning_status: Optional[str] = Field(default=None, alias="provisioningStatus")


class FabricStoredProcedure(BaseModel):
    """Stored procedures"""

    name: str = Field(...)
    definition: str = Field(None)
    language: str = Field(Language.SQL)
