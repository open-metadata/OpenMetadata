#  Copyright 2022 Collate
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
Validation logic for Custom Pydantic BaseModel
"""

import logging
from enum import Enum
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger("metadata")

RESTRICTED_KEYWORDS = ["::", ">"]
RESERVED_COLON_KEYWORD = "__reserved__colon__"
RESERVED_ARROW_KEYWORD = "__reserved__arrow__"
RESERVED_QUOTE_KEYWORD = "__reserved__quote__"


class TransformDirection(Enum):
    """Direction of name transformation"""

    ENCODE = "encode"  # For storage (Create operations) - replace separators
    DECODE = "decode"  # For display (Fetch operations) - revert separators


def is_service_level_create_model(model_name: str) -> bool:
    """
    Check if a model is a Service-level Create model that should NOT be transformed.
    Service-level models follow the pattern: Create*ServiceRequest where * is the service name
    This is scalable and requires no maintenance for new services.
    """
    if not model_name.startswith("Create") or not model_name.endswith("ServiceRequest"):
        return False

    # Extract the middle part (service name) - must not be empty
    # "CreateServiceRequest" -> middle = "" (invalid)
    # "CreateDatabaseServiceRequest" -> middle = "Database" (valid)
    middle = model_name[
        6:-14
    ]  # Remove "Create" (6 chars) and "ServiceRequest" (14 chars)
    return len(middle) > 0


# Explicit configuration for entity name transformations
# This dictionary will be populated lazily to avoid circular imports
TRANSFORMABLE_ENTITIES: Dict[Any, Dict[str, Any]] = {}


def _initialize_transformable_entities():
    """Initialize the transformable entities dictionary lazily to avoid circular imports"""
    # Import all model classes here to avoid circular dependency at module load time
    from metadata.generated.schema.api.data.createDashboardDataModel import (
        CreateDashboardDataModelRequest,
    )
    from metadata.generated.schema.api.data.createTable import CreateTableRequest
    from metadata.generated.schema.entity.data.dashboardDataModel import (
        DashboardDataModel,
    )
    from metadata.generated.schema.entity.data.table import (
        ColumnName,
        ColumnProfile,
        Table,
        TableData,
    )
    from metadata.profiler.api.models import ProfilerResponse
    from metadata.utils.entity_link import CustomColumnName

    # Now populate the dictionary with the imported classes
    TRANSFORMABLE_ENTITIES.update(
        {
            # Fetch models - decode reserved keywords back to original characters
            Table: {
                "fields": {"name", "columns", "children", "tableConstraints"},
                "direction": TransformDirection.DECODE,
            },
            DashboardDataModel: {
                "fields": {"name", "columns", "children"},
                "direction": TransformDirection.DECODE,
            },
            CustomColumnName: {
                "fields": {"root"},
                "direction": TransformDirection.DECODE,
            },
            # Create/Store models - encode special characters to reserved keywords
            ProfilerResponse: {
                "fields": {"name", "profile"},
                "direction": TransformDirection.ENCODE,
            },
            TableData: {"fields": {"columns"}, "direction": TransformDirection.ENCODE},
            ColumnName: {"fields": {"root"}, "direction": TransformDirection.ENCODE},
            CreateTableRequest: {
                "fields": {"name", "columns", "children", "tableConstraints"},
                "direction": TransformDirection.ENCODE,
            },
            CreateDashboardDataModelRequest: {
                "fields": {"name", "columns", "children"},
                "direction": TransformDirection.ENCODE,
            },
            ColumnProfile: {
                "fields": {"name"},
                "direction": TransformDirection.ENCODE,
            },
        }
    )


def revert_separators(value):
    return (
        value.replace(RESERVED_COLON_KEYWORD, "::")
        .replace(RESERVED_ARROW_KEYWORD, ">")
        .replace(RESERVED_QUOTE_KEYWORD, '"')
    )


def replace_separators(value):
    return (
        value.replace("::", RESERVED_COLON_KEYWORD)
        .replace(">", RESERVED_ARROW_KEYWORD)
        .replace('"', RESERVED_QUOTE_KEYWORD)
    )


def get_entity_config(model: Optional[Any]) -> Optional[Dict[str, Any]]:
    """Get transformation configuration for entity"""
    _initialize_transformable_entities()  # Ensure entities are loaded
    return TRANSFORMABLE_ENTITIES.get(model)


def get_transformer(model: Optional[Any]) -> Optional[Callable]:
    """Get the appropriate transformer function for model"""
    config = get_entity_config(model)
    if not config:
        return None

    direction = config.get("direction")
    if direction == TransformDirection.ENCODE:
        return replace_separators
    elif direction == TransformDirection.DECODE:
        return revert_separators
    return None


def transform_all_names(obj, transformer):
    """Transform all name fields recursively"""
    if not obj:
        return

    # Transform name field if it exists (supports both obj.name.root and obj.root)
    name = getattr(obj, "name", None)
    if name and hasattr(name, "root") and name.root is not None:
        name.root = transformer(name.root)
    elif hasattr(obj, "root") and obj.root is not None:
        obj.root = transformer(obj.root)

    # Transform nested collections in a single loop each
    for attr_name in ["columns", "children"]:
        if hasattr(obj, attr_name):
            attr_value = getattr(obj, attr_name)
            if attr_value is not None:
                for item in attr_value:
                    transform_all_names(item, transformer)

    # Transform table constraints
    if hasattr(obj, "tableConstraints"):
        table_constraints = getattr(obj, "tableConstraints")
        if table_constraints is not None:
            for constraint in table_constraints:
                if hasattr(constraint, "columns"):
                    constraint.columns = [
                        transformer(col) for col in constraint.columns
                    ]

    if transformer == replace_separators and type(name) == str:
        obj.name = transformer(name)


def transform_entity_names(entity: Any, model: Optional[Any]) -> Any:
    """Transform entity names"""
    model_name = model.__name__
    if not entity or (
        model_name.startswith("Create") and is_service_level_create_model(model_name)
    ):
        return entity

    # Root attribute handling
    if hasattr(entity, "root") and entity.root is not None:
        entity.root = (
            replace_separators(entity.root)
            if model_name.startswith("Create")
            else revert_separators(entity.root)
        )
        return entity

    # Get model-specific transformer
    transformer = get_transformer(model)
    if not transformer:
        # Fallback to original logic for backward compatibility
        transformer = (
            replace_separators if model_name.startswith("Create") else revert_separators
        )

    transform_all_names(entity, transformer)
    return entity
