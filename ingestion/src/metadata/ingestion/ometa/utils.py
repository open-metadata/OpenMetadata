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
Helper functions to handle OpenMetadata Entities' properties
"""

import re
import string
from functools import singledispatch
from typing import Any, List, Type, TypeVar, Union

from pydantic import BaseModel
from requests.utils import quote as url_quote

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.apiEndpoint import APIEndpoint
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.metric import Metric
from metadata.generated.schema.entity.data.mlmodel import MlModel
from metadata.generated.schema.entity.data.searchIndex import SearchIndex
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.type.basic import FullyQualifiedEntityName
from metadata.generated.schema.type.entityReference import EntityReference

T = TypeVar("T", bound=BaseModel)

LINEAGE_ENTITY_CLASS_MAP = {
    "table": (Table, ("columns",)),
    "searchIndex": (SearchIndex, ("fields",)),
    "topic": (Topic, ("messageSchema",)),
    "container": (Container, ("dataModel",)),
    "dashboardDataModel": (DashboardDataModel, ("columns",)),
    "dashboard": (Dashboard, ("charts",)),
    "mlmodel": (MlModel, ("",)),
    "apiEndpoint": (APIEndpoint, ("responseSchema", "requestSchema")),
    "metric": (Metric, ("",)),
}


def format_name(name: str) -> str:
    """
    Given a name, replace all special characters by `_`
    :param name: name to format
    :return: formatted string
    """
    subs = re.escape(string.punctuation + " ")
    return re.sub(r"[" + subs + "]", "_", name)


# pylint: disable=too-many-return-statements
def get_entity_type(
    entity: Union[Type[T], str],
) -> str:
    """
    Given an Entity T, return its type.
    E.g., Table returns table, Dashboard returns dashboard...

    Also allow to be the identity if we just receive a string
    """
    if isinstance(entity, str):
        return entity

    class_name: str = entity.__name__.lower()

    if "service" in class_name:
        # Capitalize service, e.g., pipelineService
        return class_name.replace("service", "Service")
    if "testdefinition" in class_name:
        return class_name.replace("testdefinition", "testDefinition")
    if "testsuite" in class_name:
        return class_name.replace("testsuite", "testSuite")
    if "databaseschema" in class_name:
        return class_name.replace("databaseschema", "databaseSchema")
    if "searchindex" in class_name:
        return class_name.replace("searchindex", "searchIndex")
    if "dashboarddatamodel" in class_name:
        return class_name.replace("dashboarddatamodel", "dashboardDataModel")

    return class_name


def model_str(arg: Any) -> str:
    """
    Default model stringifying method.

    Some elements such as FQN, EntityName, UUID
    have the actual value under the pydantic base root
    """
    if hasattr(arg, "root"):
        return str(arg.root)

    return str(arg)


def quote(fqn: Union[FullyQualifiedEntityName, str]) -> str:
    """
    Quote the FQN so that it's safe to pass to the API.
    E.g., `"foo.bar/baz"` -> `%22foo.bar%2Fbaz%22`
    """
    return url_quote(model_str(fqn), safe="")


def build_entity_reference(entity: T) -> EntityReference:
    """Get the EntityReference from the Entity itself"""
    return EntityReference(
        id=entity.id,
        type=get_entity_type(type(entity)),
        name=model_str(entity.name),
        fullyQualifiedName=model_str(entity.fullyQualifiedName),
        description=entity.description,
        href=entity.href,
    )


# pylint: disable=unused-argument,import-outside-toplevel,too-many-locals
@singledispatch
def column_name_list(entity: T) -> List[str]:
    """
    helper function to get the column names of the entity
    """
    return set()


def _get_column_names(column, parent_path: str = "") -> set:
    """
    Helper function to recursively get column names with their full path
    """
    result = set()
    current_path = (
        f"{parent_path}.{column.name.root}" if parent_path else column.name.root
    )
    result.add(current_path)

    if column.children:
        for child in column.children:
            result.update(_get_column_names(child, current_path))
    return result


@column_name_list.register(DashboardDataModel)
@column_name_list.register(Table)
def _(entity: Union[DashboardDataModel, Table]) -> List[str]:
    """Get the column names of the table"""
    result = set()
    for column in entity.columns or []:
        result.update(_get_column_names(column))
    return result


@column_name_list.register(Container)
def _(entity: Container) -> List[str]:
    """Get the column names of the table"""
    result = set()
    if entity.dataModel and entity.dataModel.columns:
        for column in entity.dataModel.columns:
            result.update(_get_column_names(column))
    return result


@column_name_list.register(Dashboard)
def _(entity: Dashboard) -> List[str]:
    """Get the column names of the table"""
    from metadata.utils.fqn import split

    result = set()
    if entity.charts and entity.charts.root:
        for chart in entity.charts.root:
            if chart.fullyQualifiedName:
                split_fqn = split(chart.fullyQualifiedName)
                if split_fqn:
                    result.add(split_fqn[-1])
    return result


@column_name_list.register(MlModel)
def _(entity: MlModel) -> List[str]:
    """Get the column names of the table"""
    result = set()
    for feature in entity.mlFeatures or []:
        result.add(feature.name.root)
        if feature.featureSources:
            result.update(column_name_list(feature.featureSources))
    return result


@column_name_list.register(Topic)
def _(entity: Topic) -> List[str]:
    """Get the column names of the table"""
    result = set()
    if entity.messageSchema and entity.messageSchema.schemaFields:
        for field in entity.messageSchema.schemaFields:
            result.update(_get_column_names(field))
    return result


@column_name_list.register(APIEndpoint)
def _(entity: APIEndpoint) -> List[str]:
    """Get the column names of the table"""
    result = set()
    if entity.requestSchema and entity.requestSchema.fields:
        for field in entity.requestSchema.schemaFields:
            result.add(field.name.root)
            if field.children:
                result.update(column_name_list(field.children))
        return result
    if entity.responseSchema and entity.responseSchema.fields:
        for field in entity.responseSchema.schemaFields:
            result.add(field.name.root)
            if field.children:
                result.update(column_name_list(field.children))
        return result
    return result


def clean_lineage_columns(metadata, lineage_request: AddLineageRequest) -> None:
    """
    Replicate the behavior of validateChildren in the Backend and remove the invalid columns
    """
    from metadata.utils.fqn import FQN_SEPARATOR
    from metadata.utils.logger import utils_logger

    logger = utils_logger()

    if (
        lineage_request.edge
        and lineage_request.edge.lineageDetails
        and lineage_request.edge.lineageDetails.columnsLineage
        and lineage_request.edge.fromEntity
        and lineage_request.edge.toEntity
    ):
        from_class, from_fields = LINEAGE_ENTITY_CLASS_MAP.get(
            lineage_request.edge.fromEntity.type, (None, None)
        )
        to_class, to_fields = LINEAGE_ENTITY_CLASS_MAP.get(
            lineage_request.edge.toEntity.type, (None, None)
        )
        if not from_class or not to_class:
            return

        from_entity = metadata.get_by_id(
            entity=from_class,
            entity_id=lineage_request.edge.fromEntity.id.root,
            fields=from_fields,
        )
        to_entity = metadata.get_by_id(
            entity=to_class,
            entity_id=lineage_request.edge.toEntity.id.root,
            fields=to_fields,
        )

        if not from_entity or not to_entity:
            return

        from_entity_columns = column_name_list(from_entity)
        to_entity_columns = column_name_list(to_entity)

        cleaned_columns_lineage = []

        for column_lineage in lineage_request.edge.lineageDetails.columnsLineage:
            invalid_column = False
            for from_column in column_lineage.fromColumns or []:
                if hasattr(from_column, "root"):
                    from_column = from_column.root
                from_column_name = from_column.replace(
                    from_entity.fullyQualifiedName.root + FQN_SEPARATOR, ""
                )
                if from_column_name not in from_entity_columns:
                    invalid_column = True
                    logger.warning(
                        f"Ignoring invalid column {from_column} for lineage from {from_entity.fullyQualifiedName.root} "
                        f"to {to_entity.fullyQualifiedName.root}"
                    )

            if column_lineage.toColumn:
                to_column = column_lineage.toColumn
                if hasattr(to_column, "root"):
                    to_column = to_column.root
                to_column_name = to_column.replace(
                    to_entity.fullyQualifiedName.root + FQN_SEPARATOR, ""
                )
                if to_column_name not in to_entity_columns:
                    logger.warning(
                        f"Ignoring invalid column {column_lineage.toColumn} for lineage "
                        f"from {from_entity.fullyQualifiedName.root} to {to_entity.fullyQualifiedName.root}"
                    )
                    invalid_column = True

            if not invalid_column:
                cleaned_columns_lineage.append(column_lineage)

        lineage_request.edge.lineageDetails.columnsLineage = cleaned_columns_lineage
