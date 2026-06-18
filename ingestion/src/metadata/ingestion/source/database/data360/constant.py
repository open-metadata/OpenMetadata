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
Salesforce Data 360 constants
"""


class MetadataTypesConstant:
    DATASPACES = "Dataspaces"
    DATA_LAKE_OBJECT = "DataLakeObject"
    DATA_MODEL_OBJECT = "DataModelObject"
    CALCULATED_INSIGHT = "CalculatedInsight"
    DLO = "DLO"
    DMO = "DMO"
    CIO = "CIO"
    DATASTREAMS = "Datastreams"
    DATATRANSFORMS = "Datatransforms"


class ResponseConstant:
    TOTAL_SIZE = "totalSize"
    DATASPACES = "dataSpaces"
    NAME = "name"
    STATUS = "status"
    LABEL = "label"
    DESCRIPTION = "description"
    METADATA = "metadata"
    RELATIONSHIPS = "relationships"
    MEASURES = "measures"
    DISPLAY_NAME = "displayName"
    PARTITION_BY = "partitionBy"
    FIELDS = "fields"
    PRIMARY_KEYS = "primaryKeys"
    TYPE = "type"
    CATEGORY = "category"
    FROM_ENTITY = "fromEntity"
    TO_ENTITY = "toEntity"
    FROM_ENTITY_ATTRIBUTE = "fromEntityAttribute"
    TO_ENTITY_ATTRIBUTE = "toEntityAttribute"
    BUSINESS_TYPE = "businessType"
    DIMENSIONS = "dimensions"
    EXPRESSION = "expression"
    DATASTREAMS = "dataStreams"
    DEFINITION_TYPE = "definitionType"
    ITEMS = "items"
    TOTAL = "total"
    COLLECTION = "collection"
    DATATRANSFORMS = "dataTransforms"


class Constant:
    TABLE_PARTITION = "tablePartition"
    TABLE_CONSTRAINTS = "tableConstraints"
    TAGS = "tags"
    DIMENSION = "Dimension"
    MEASURE = "Measure"
    FIELD_TYPE = "fieldType"
    DATA_LAKE_OBJECTS = "Data Lake Objects"
    DATA_MODEL_OBJECTS = "Data Model Objects"
    CALCULATED_INSIGHTS = "Calculated Insights"
    CI_PROP_NAME = "ciOperationalData"
    LIMIT = "limit"
    OFFSET = "offset"
    BATCH_SIZE = "batchSize"
    TAG_CLASSIFICATION_NAME = "Data360"
    TAG_CLASSIFICATION_DESCRIPTION = "Data 360 Classification"
