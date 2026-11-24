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
Utility functions for the Salesforce Data 360 connector.
"""

import html
import re

from metadata.generated.schema.entity.data.table import (
    ConstraintType,
    PartitionColumnDetails,
    TableConstraint,
    TablePartition,
)
from metadata.ingestion.source.database.data360.constant import (
    Constant,
    MetadataTypesConstant,
    ResponseConstant,
)
from metadata.ingestion.source.database.data360.exceptions import Data360ResponseError
from metadata.ingestion.source.database.data360.models import EndpointPaging


def get_metadata_type(schema_name: str) -> str | None:
    """Returns the Data 360 metadata type name for a given schema name."""
    metadata_type_names = {
        Constant.DATA_LAKE_OBJECTS: MetadataTypesConstant.DATA_LAKE_OBJECT,
        Constant.DATA_MODEL_OBJECTS: MetadataTypesConstant.DATA_MODEL_OBJECT,
        Constant.CALCULATED_INSIGHTS: MetadataTypesConstant.CALCULATED_INSIGHT,
    }
    return metadata_type_names.get(schema_name)


def get_table_constraints(primary_keys: list) -> list:
    """Builds table constraint objects from a list of primary key definitions."""
    if not primary_keys:
        return []
    return [
        TableConstraint(
            constraintType=ConstraintType.PRIMARY_KEY,
            columns=[pk.get(ResponseConstant.NAME) for pk in primary_keys],
        )
    ]


def combine_ci_fields(table: dict) -> None:
    """Merges dimensions and measures of a Calculated Insight into a single 'fields' list."""
    dimensions = table.get(ResponseConstant.DIMENSIONS, [])
    measures = table.get(ResponseConstant.MEASURES, [])
    for dimension in dimensions:
        dimension[Constant.FIELD_TYPE] = Constant.DIMENSION
    for measure in measures:
        measure[Constant.FIELD_TYPE] = Constant.MEASURE
    table[ResponseConstant.FIELDS] = dimensions + measures


def get_table_partition(partition_by: str) -> TablePartition:
    """Builds a TablePartition from a partition column name."""
    return TablePartition(columns=[PartitionColumnDetails(columnName=partition_by)])


def get_schema_name(table_name: str) -> str:
    """Infers the schema name from Data 360 object naming conventions."""
    if table_name.endswith("dll"):
        return Constant.DATA_LAKE_OBJECTS
    if table_name.endswith("dlm"):
        return Constant.DATA_MODEL_OBJECTS
    if table_name.endswith("cio"):
        return Constant.CALCULATED_INSIGHTS
    raise ValueError(f"Cannot infer schema for Data 360 object '{table_name}': unknown suffix")


_ENDPOINT_PAGING: dict[str, EndpointPaging] = {
    MetadataTypesConstant.CALCULATED_INSIGHT: EndpointPaging(
        items_field=ResponseConstant.ITEMS,
        limit_param=Constant.BATCH_SIZE,
        total_size_field=ResponseConstant.TOTAL,
        envelope_field=ResponseConstant.COLLECTION,
    ),
    MetadataTypesConstant.DATASPACES: EndpointPaging(items_field=ResponseConstant.DATASPACES),
    MetadataTypesConstant.DATASTREAMS: EndpointPaging(items_field=ResponseConstant.DATASTREAMS),
    MetadataTypesConstant.DATATRANSFORMS: EndpointPaging(items_field=ResponseConstant.DATATRANSFORMS),
    MetadataTypesConstant.METADATA: EndpointPaging(items_field=ResponseConstant.METADATA),
}


def get_endpoint_paging(object_type: str) -> EndpointPaging:
    """Returns the paging contract of a Data 360 listing endpoint."""
    paging = _ENDPOINT_PAGING.get(object_type)
    if paging is None:
        raise Data360ResponseError(f"No Data 360 pagination contract defined for object type '{object_type}'")
    return paging


def add_column_suffix(column: str) -> str:
    """Appends the Salesforce custom field suffix '__c' if not already present."""
    if not re.search(r"__c$", column):
        return f"{column}__c"
    return column


def decode_html_entities(query: str) -> str:
    """Decodes HTML entities in a SQL query string returned by the Data 360 API."""
    if not query:
        return query
    return html.unescape(query)
