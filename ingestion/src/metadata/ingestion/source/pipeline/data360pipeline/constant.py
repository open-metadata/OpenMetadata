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
Salesforce Data 360 pipeline constants
"""


class MetadataTypesConstant:
    DATASTREAMS = "dataStreams"
    DATASTREAM = "Data Stream"
    UPLOADED_FILES = "UploadedFiles"
    CALCULATED_INSIGHT = "Calculated Insight"
    DATATRANSFORM = "Data Transform"


class ConnectionTypesConstant:
    UPLOADED_FILES = "UploadedFiles"
    SALESFORCE_DOT_COM = "SalesforceDotCom"
    SNOWFLAKE = "SNOWFLAKE"
    ICEBERG = "ICEBERG"
    INGEST_API = "IngestApi"
    STREAMING_APP = "StreamingApp"
    AWS_S3 = "AwsS3"
    SFTP = "SFTP"


class ResponseConstant:
    REFRESH_CONFIG = "refreshConfig"
    FREQUENCY = "frequency"
    REFRESH_DAY_OF_MONTH = "refreshDayOfMonth"
    HOURS = "hours"
    REFRESH_MODE = "refreshMode"
    FREQUENCY_TYPE = "frequencyType"
    MAPPINGS = "mappings"
    SOURCE_FIELD_NAME = "sourceFieldName"
    TARGET_FIELD_NAME = "targetFieldName"
    CONNECTOR_INFO = "connectorInfo"
    CONNECTOR_TYPE = "connectorType"
    CONNECTOR_DETAILS = "connectorDetails"
    SOURCE_OBJECT = "sourceObject"
    NAME = "name"
    TYPE = "type"
    DATA_LAKE_OBJECT_INFO = "dataLakeObjectInfo"
    DATA_SPACE_INFO = "dataSpaceInfo"
    ADVANCED_ATTRIBUTES = "advancedAttributes"
    IMPORT_DIRECTORY = "importDirectory"
    FILE_NAME = "fileName"
    PARENT_DIRECTORY = "parentDirectory"
    DELIMITER = "delimiter"
    DRIVE_LIBRARY_ID = "driveLibraryId"
    FILE_TYPE = "fileType"
    LABEL = "label"
    STATUS = "status"
    LAST_REFRESH_DATE = "lastRefreshDate"
    DATA_STREAM_TYPE = "dataStreamType"
    RECORD_ID = "recordId"
    FORMULA = "formula"
    API_NAME = "apiName"
    DISPLAY_NAME = "displayName"
    DESCRIPTION = "description"
    DEFINITION_TYPE = "definitionType"
    DATASPACE = "dataSpace"
    CALCULATED_INSIGHT_STATUS = "calculatedInsightStatus"
    EXPRESSION = "expression"
    LAST_RUN_DATE = "lastRunDate"
    LAST_RUN_STATUS = "lastRunStatus"
    CREATION_TYPE = "creationType"
    HISTORIES = "histories"
    LAST_RUN_DATE_TIME = "lastRunDateTime"
    LAST_RUN_STATUS_DATE_TIME = "lastRunStatusDateTime"
