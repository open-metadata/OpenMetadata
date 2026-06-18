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
Pydantic models for Salesforce Data 360 pipeline entities
"""

from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, ConfigDict

from metadata.ingestion.source.pipeline.data360pipeline.constant import (
    MetadataTypesConstant,
)


class DataCloudPipelineDetails(ABC):
    @abstractmethod
    def get_name(self) -> str:
        pass

    @abstractmethod
    def get_display_name(self) -> str:
        pass

    @abstractmethod
    def get_status(self) -> str:
        pass

    @abstractmethod
    def get_tags(self) -> list[str]:
        pass

    @abstractmethod
    def get_metadata_type(self) -> str:
        pass

    @abstractmethod
    def get_description(self) -> str | None:
        pass


class UserInfo(BaseModel):
    id: str | None = None
    name: str | None = None
    profilePhotoUrl: str | None = None


class DataSpaceInfo(BaseModel):
    label: str | None = None
    name: str | None = None


class DataSource(BaseModel):
    sourceApiName: str | None = None
    type: str | None = None


class Frequency(BaseModel):
    refreshDayOfMonth: list[str | None] | list[int | None] | None = None
    hours: list[str | None] | list[int | None] | None = None
    frequencyType: str | None = None


class RefreshConfig(BaseModel):
    refreshMode: str | None = None
    frequency: Frequency | None = None
    hasHeaders: bool | None = None
    isAccelerationEnabled: bool | None = None
    shouldFetchImmediately: bool | None = None
    shouldTreatMissingFilesAsFailures: bool | None = None


class Mapping(BaseModel):
    sourceFieldName: str | None = None
    targetFieldName: str | None = None
    formula: str | None = None


class ConnectorDetails(BaseModel):
    name: str | None = None
    sourceObject: str | None = None
    type: str | None = None


class ConnectorInfo(BaseModel):
    connectorType: str | None = None
    connectorDetails: ConnectorDetails | None = None
    capabilities: dict[str, Any] | None = None


class DataLakeFieldInfo(BaseModel):
    dataType: str | None = None
    isPrimaryKey: bool | None = None
    label: str | None = None
    name: str | None = None
    format: str | None = None


class DataLakeObjectInfo(BaseModel):
    name: str | None = None
    dataSpaceInfo: list[DataSpaceInfo] | None = None
    capabilities: dict[str, Any] | None = None
    category: str | None = None
    dataLakeFieldInfoRepresentation: list[DataLakeFieldInfo] | None = None
    eventDateTimeFieldName: str | None = None
    fields: list[DataLakeFieldInfo] | None = None
    id: str | None = None
    label: str | None = None
    status: str | None = None


class AdvancedAttributes(BaseModel):
    importDirectory: str | None = ""
    fileName: str | None = ""
    parentDirectory: str | None = ""
    delimiter: str | None = ""
    driveLibraryId: str | None = ""
    fileType: str | None = ""
    schema: str | None = ""
    database: str | None = ""
    object: str | None = ""


class SourceField(BaseModel):
    datatype: str | None = None
    name: str | None = None
    format: str | None = None


class DataStreamDetails(BaseModel, DataCloudPipelineDetails):
    advancedAttributes: AdvancedAttributes | None = None
    capabilities: dict[str, Any] | None = None
    connectorInfo: ConnectorInfo | None = None
    dataAccessMode: str | None = None
    dataLakeObjectInfo: DataLakeObjectInfo | None = None
    dataSource: str | None = None
    dataStreamType: str | None = None
    isEnabled: bool | None = None
    label: str | None = None
    lastRunStatus: str | None = None
    lastRefreshDate: str | None = None
    mappings: list[Mapping] | None = None
    name: str | None = None
    recordId: str | None = None
    refreshConfig: RefreshConfig | None = None
    sourceFields: list[SourceField] | None = None
    status: str | None = None

    model_config = ConfigDict(extra="ignore")

    def get_name(self) -> str:
        return self.name

    def get_display_name(self) -> str:
        return self.label

    def get_status(self) -> str:
        return self.status

    def get_tags(self) -> list[str]:
        return [self.status, self.dataStreamType]

    def get_metadata_type(self) -> str:
        return MetadataTypesConstant.DATASTREAM

    def get_description(self) -> str | None:
        return None


class Dimension(BaseModel):
    apiName: str | None = None
    creationType: str | None = None
    dataSource: DataSource | None = None
    dataType: str | None = None
    dateGranularity: str | None = None
    displayName: str | None = None
    fieldRole: str | None = None
    formula: str | None = None


class Measure(BaseModel):
    apiName: str | None = None
    creationType: str | None = None
    dataSource: DataSource | None = None
    dataType: str | None = None
    displayName: str | None = None
    fieldAggregationType: str | None = None
    fieldRole: str | None = None
    formula: str | None = None


class CalculatedInsightDetails(BaseModel, DataCloudPipelineDetails):
    apiName: str | None = None
    calculatedInsightStatus: str | None = None
    creationType: str | None = None
    dataSpace: str | None = None
    definitionStatus: str | None = None
    definitionType: str | None = None
    description: str | None = None
    dimensions: list[Dimension] | None = None
    displayName: str | None = None
    expression: str | None = None
    isEnabled: bool | None = None
    lastCalcInsightStatusDateTime: str | None = None
    lastCalcInsightStatusErrorCode: str | None = None
    lastRunDateTime: str | None = None
    lastRunStatus: str | None = None
    lastRunStatusDateTime: str | None = None
    lastRunStatusErrorCode: str | None = None
    measures: list[Measure] | None = None
    publishScheduleEndDate: str | None = None
    publishScheduleInterval: str | None = None
    publishScheduleStartDateTime: str | None = None

    model_config = ConfigDict(extra="ignore")

    def get_name(self) -> str:
        return self.apiName

    def get_display_name(self) -> str:
        return self.displayName

    def get_status(self) -> str:
        return self.calculatedInsightStatus

    def get_tags(self) -> list[str]:
        return [self.calculatedInsightStatus, self.definitionType, self.creationType]

    def get_metadata_type(self) -> str:
        return MetadataTypesConstant.CALCULATED_INSIGHT

    def get_description(self) -> str | None:
        return self.description


class ActionUrls(BaseModel):
    action: str | None = None
    refreshStatusAction: str | None = None
    retryAction: str | None = None


class Field(BaseModel):
    isPrimaryKey: bool | None = None
    keyQualifierField: str | None = None
    label: str | None = None
    name: str | None = None
    type: str | None = None


class OutputDataObject(BaseModel):
    category: str | None = None
    createdDate: str | None = None
    fields: list[Field] | None = None
    id: str | None = None
    label: str | None = None
    lastModifiedDate: str | None = None
    name: str | None = None
    status: str | None = None
    type: str | None = None


class Definition(BaseModel):
    expression: str | None = None
    outputDataObjects: list[OutputDataObject] | None = None
    targetDlo: str | None = None
    type: str | None = None
    version: str | None = None
    nodes: dict | None = None
    ui: dict | None = None


class DataTransformRun(BaseModel):
    duration: int | None = 0
    endTime: str | None = None
    startTime: str | None = None
    status: str | None = None

    model_config = ConfigDict(extra="ignore")


class DataTransformDetails(BaseModel, DataCloudPipelineDetails):
    actionUrls: ActionUrls | None = None
    createdBy: UserInfo | None = None
    createdDate: str | None = None
    creationType: str | None = None
    definition: Definition | None = None
    id: str | None = None
    label: str | None = None
    lastModifiedBy: UserInfo | None = None
    lastModifiedDate: str | None = None
    lastRunDate: str | None = None
    lastRunStatus: str | None = None
    name: str | None = None
    status: str | None = None
    type: str | None = None
    url: str | None = None
    dataSpaceName: str | None = None
    description: str | None = None

    model_config = ConfigDict(extra="ignore")

    def get_name(self) -> str:
        return self.name

    def get_display_name(self) -> str:
        return self.label

    def get_status(self) -> str:
        return self.status

    def get_tags(self) -> list[str]:
        return [self.status, self.creationType, self.type]

    def get_metadata_type(self) -> str:
        return MetadataTypesConstant.DATATRANSFORM

    def get_description(self) -> str | None:
        return self.description
