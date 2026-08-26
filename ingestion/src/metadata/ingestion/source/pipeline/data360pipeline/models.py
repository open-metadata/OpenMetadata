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
    profilePhotoUrl: str | None = None  # noqa: N815


class DataSpaceInfo(BaseModel):
    label: str | None = None
    name: str | None = None


class DataSource(BaseModel):
    sourceApiName: str | None = None  # noqa: N815
    type: str | None = None


class Frequency(BaseModel):
    refreshDayOfMonth: list[str | None] | list[int | None] | None = None  # noqa: N815
    hours: list[str | None] | list[int | None] | None = None
    frequencyType: str | None = None  # noqa: N815


class RefreshConfig(BaseModel):
    refreshMode: str | None = None  # noqa: N815
    frequency: Frequency | None = None
    hasHeaders: bool | None = None  # noqa: N815
    isAccelerationEnabled: bool | None = None  # noqa: N815
    shouldFetchImmediately: bool | None = None  # noqa: N815
    shouldTreatMissingFilesAsFailures: bool | None = None  # noqa: N815


class Mapping(BaseModel):
    sourceFieldName: str | None = None  # noqa: N815
    targetFieldName: str | None = None  # noqa: N815
    formula: str | None = None


class ConnectorDetails(BaseModel):
    name: str | None = None
    sourceObject: str | None = None  # noqa: N815
    type: str | None = None


class ConnectorInfo(BaseModel):
    connectorType: str | None = None  # noqa: N815
    connectorDetails: ConnectorDetails | None = None  # noqa: N815
    capabilities: dict[str, Any] | None = None


class DataLakeFieldInfo(BaseModel):
    dataType: str | None = None  # noqa: N815
    isPrimaryKey: bool | None = None  # noqa: N815
    label: str | None = None
    name: str | None = None
    format: str | None = None


class DataLakeObjectInfo(BaseModel):
    name: str | None = None
    dataSpaceInfo: list[DataSpaceInfo] | None = None  # noqa: N815
    capabilities: dict[str, Any] | None = None
    category: str | None = None
    dataLakeFieldInfoRepresentation: list[DataLakeFieldInfo] | None = None  # noqa: N815
    eventDateTimeFieldName: str | None = None  # noqa: N815
    fields: list[DataLakeFieldInfo] | None = None
    id: str | None = None
    label: str | None = None
    status: str | None = None


class AdvancedAttributes(BaseModel):
    importDirectory: str | None = ""  # noqa: N815
    fileName: str | None = ""  # noqa: N815
    parentDirectory: str | None = ""  # noqa: N815
    delimiter: str | None = ""
    driveLibraryId: str | None = ""  # noqa: N815
    fileType: str | None = ""  # noqa: N815
    schema: str | None = ""
    database: str | None = ""
    object: str | None = ""


class SourceField(BaseModel):
    datatype: str | None = None
    name: str | None = None
    format: str | None = None


class DataStreamDetails(BaseModel, DataCloudPipelineDetails):
    advancedAttributes: AdvancedAttributes | None = None  # noqa: N815
    capabilities: dict[str, Any] | None = None
    connectorInfo: ConnectorInfo | None = None  # noqa: N815
    dataAccessMode: str | None = None  # noqa: N815
    dataLakeObjectInfo: DataLakeObjectInfo | None = None  # noqa: N815
    dataSource: str | None = None  # noqa: N815
    dataStreamType: str | None = None  # noqa: N815
    isEnabled: bool | None = None  # noqa: N815
    label: str | None = None
    lastRunStatus: str | None = None  # noqa: N815
    lastRefreshDate: str | None = None  # noqa: N815
    mappings: list[Mapping] | None = None
    name: str | None = None
    recordId: str | None = None  # noqa: N815
    refreshConfig: RefreshConfig | None = None  # noqa: N815
    sourceFields: list[SourceField] | None = None  # noqa: N815
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
    apiName: str | None = None  # noqa: N815
    creationType: str | None = None  # noqa: N815
    dataSource: DataSource | None = None  # noqa: N815
    dataType: str | None = None  # noqa: N815
    dateGranularity: str | None = None  # noqa: N815
    displayName: str | None = None  # noqa: N815
    fieldRole: str | None = None  # noqa: N815
    formula: str | None = None


class Measure(BaseModel):
    apiName: str | None = None  # noqa: N815
    creationType: str | None = None  # noqa: N815
    dataSource: DataSource | None = None  # noqa: N815
    dataType: str | None = None  # noqa: N815
    displayName: str | None = None  # noqa: N815
    fieldAggregationType: str | None = None  # noqa: N815
    fieldRole: str | None = None  # noqa: N815
    formula: str | None = None


class CalculatedInsightDetails(BaseModel, DataCloudPipelineDetails):
    apiName: str | None = None  # noqa: N815
    calculatedInsightStatus: str | None = None  # noqa: N815
    creationType: str | None = None  # noqa: N815
    dataSpace: str | None = None  # noqa: N815
    definitionStatus: str | None = None  # noqa: N815
    definitionType: str | None = None  # noqa: N815
    description: str | None = None
    dimensions: list[Dimension] | None = None
    displayName: str | None = None  # noqa: N815
    expression: str | None = None
    isEnabled: bool | None = None  # noqa: N815
    lastCalcInsightStatusDateTime: str | None = None  # noqa: N815
    lastCalcInsightStatusErrorCode: str | None = None  # noqa: N815
    lastRunDateTime: str | None = None  # noqa: N815
    lastRunStatus: str | None = None  # noqa: N815
    lastRunStatusDateTime: str | None = None  # noqa: N815
    lastRunStatusErrorCode: str | None = None  # noqa: N815
    measures: list[Measure] | None = None
    publishScheduleEndDate: str | None = None  # noqa: N815
    publishScheduleInterval: str | None = None  # noqa: N815
    publishScheduleStartDateTime: str | None = None  # noqa: N815

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
    refreshStatusAction: str | None = None  # noqa: N815
    retryAction: str | None = None  # noqa: N815


class Field(BaseModel):
    isPrimaryKey: bool | None = None  # noqa: N815
    keyQualifierField: str | None = None  # noqa: N815
    label: str | None = None
    name: str | None = None
    type: str | None = None


class OutputDataObject(BaseModel):
    category: str | None = None
    createdDate: str | None = None  # noqa: N815
    fields: list[Field] | None = None
    id: str | None = None
    label: str | None = None
    lastModifiedDate: str | None = None  # noqa: N815
    name: str | None = None
    status: str | None = None
    type: str | None = None


class Definition(BaseModel):
    expression: str | None = None
    outputDataObjects: list[OutputDataObject] | None = None  # noqa: N815
    targetDlo: str | None = None  # noqa: N815
    type: str | None = None
    version: str | None = None
    nodes: dict | None = None
    ui: dict | None = None


class DataTransformRun(BaseModel):
    duration: int | None = 0
    endTime: str | None = None  # noqa: N815
    startTime: str | None = None  # noqa: N815
    status: str | None = None

    model_config = ConfigDict(extra="ignore")


class DataTransformDetails(BaseModel, DataCloudPipelineDetails):
    actionUrls: ActionUrls | None = None  # noqa: N815
    createdBy: UserInfo | None = None  # noqa: N815
    createdDate: str | None = None  # noqa: N815
    creationType: str | None = None  # noqa: N815
    definition: Definition | None = None
    id: str | None = None
    label: str | None = None
    lastModifiedBy: UserInfo | None = None  # noqa: N815
    lastModifiedDate: str | None = None  # noqa: N815
    lastRunDate: str | None = None  # noqa: N815
    lastRunStatus: str | None = None  # noqa: N815
    name: str | None = None
    status: str | None = None
    type: str | None = None
    url: str | None = None
    dataSpaceName: str | None = None  # noqa: N815
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
