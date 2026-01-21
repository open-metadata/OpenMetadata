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
LookML template processing engine.
Handles Liquid variables, constants, derived patterns, and environment-specific code.
"""
import pathlib
import re
import traceback
from abc import ABC, abstractmethod
from typing import Any, ClassVar, Dict, List, Optional, Set, Union

import lkml
from liquid import Undefined
from liquid.exceptions import LiquidSyntaxError

from metadata.ingestion.source.dashboard.looker.template_tags import (
    TemplateTagError,
    build_liquid_template,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Field names for transformed output
TRANSFORMED_SQL_FIELD = "om_transformed_sql"
TRANSFORMED_TABLE_FIELD = "om_transformed_sql_table_name"

# View attribute paths
DERIVED_TABLE_KEY = "derived_table"
SQL_KEY = "sql"
SQL_TABLE_NAME_KEY = "sql_table_name"
VIEW_NAME_KEY = "name"

# Environment constants
PRODUCTION_ENV = "prod"
DEVELOPMENT_ENV = "dev"

# Regex patterns
SPECIAL_VAR_PATTERN = r"\b\w+(\.\w+)*\._(is_selected|in_query|is_filtered)\b"
CONSTANT_PATTERN = r"@\{(\w+)\}"
DERIVED_PATTERN = r"\$\{(.+?)\}"


class SpecialLookerVariables:
    """
    Manages Looker's special runtime boolean variables.
    These variables indicate field selection and filter state in queries.
    """

    PATTERN: ClassVar[str] = SPECIAL_VAR_PATTERN

    def __init__(self, base_vars: dict):
        self.base_vars = base_vars

    def extract_special_vars(self, text: str) -> Set[str]:
        """Find all special variable references in text"""
        return set(
            text[match.start() : match.end()]
            for match in re.finditer(self.PATTERN, text)
        )

    def build_variable_dict(self, text: str) -> dict:
        """Create variable dictionary with special vars defaulted to True"""
        special_vars = self.extract_special_vars(text)
        if not special_vars:
            return self.base_vars

        result = {**self.base_vars}

        for var_path in special_vars:
            keys = var_path.split(".")
            current_level: dict = result

            for key in keys[:-1]:
                if key not in current_level:
                    current_level[key] = {}
                current_level = current_level[key]

            if keys[-1] not in current_level:
                current_level[keys[-1]] = True

        logger.debug(f"Added {len(special_vars)} special variables")
        return result


def process_liquid_templates(
    text: str,
    variables: Dict[Any, Any],
    view_name: str,
) -> str:
    """
    Execute Liquid template rendering with variable substitution.
    Undefined variables default to NULL.
    """
    Undefined.__str__ = lambda instance: "NULL"  # type: ignore

    try:
        var_handler = SpecialLookerVariables(variables)
        complete_vars = var_handler.build_variable_dict(text)
        return build_liquid_template(text).render(complete_vars)
    except LiquidSyntaxError as err:
        logger.warning(f"Liquid syntax error in view {view_name}: {err.message}")
    except TemplateTagError as err:
        logger.warning(f"Template tag error in view {view_name}: {err}")
        logger.debug(traceback.format_exc())

    return text


class ViewAttributeProcessor(ABC):
    """
    Base processor for transforming view attributes.
    Each processor handles specific template syntax or SQL patterns.
    """

    def __init__(
        self,
        liquid_vars: Optional[Dict[str, Any]] = None,
        constants: Optional[Dict[str, str]] = None,
        environment: str = PRODUCTION_ENV,
    ):
        self.liquid_vars = liquid_vars or {}
        self.constants = constants or {}
        self.environment = environment

    def execute(self, view_data: dict) -> dict:
        """
        Process view attributes and return transformed fields.
        Returns dict with new keys for transformed values.
        """
        result = {}

        # Process sql_table_name if present and supported
        if SQL_TABLE_NAME_KEY in view_data and self.supports_attribute(
            SQL_TABLE_NAME_KEY
        ):
            source_value = view_data.get(
                TRANSFORMED_TABLE_FIELD, view_data[SQL_TABLE_NAME_KEY]
            )
            if source_value:
                logger.debug(f"Processing sql_table_name: {source_value[:100]}...")
                processed_value = self.transform(source_value, view_data)
                logger.debug(f"Result: {processed_value[:100]}...")
                result[TRANSFORMED_TABLE_FIELD] = processed_value

        # Process derived_table.sql if present and supported
        if (
            DERIVED_TABLE_KEY in view_data
            and SQL_KEY in view_data[DERIVED_TABLE_KEY]
            and self.supports_attribute(f"{DERIVED_TABLE_KEY}.{SQL_KEY}")
        ):
            source_value = view_data[DERIVED_TABLE_KEY].get(
                TRANSFORMED_SQL_FIELD, view_data[DERIVED_TABLE_KEY][SQL_KEY]
            )
            if source_value:
                logger.debug(f"Processing derived_table.sql: {source_value[:100]}...")
                processed_value = self.transform(source_value, view_data)
                logger.debug(f"Result: {processed_value[:100]}...")
                result[DERIVED_TABLE_KEY] = {TRANSFORMED_SQL_FIELD: processed_value}

        return result

    @abstractmethod
    def transform(self, value: str, view_data: dict) -> str:
        """Apply transformation logic"""

    def supports_attribute(self, attribute: str) -> bool:
        """Check if this processor handles the given attribute"""
        return attribute in [
            f"{DERIVED_TABLE_KEY}.{SQL_KEY}",
            SQL_TABLE_NAME_KEY,
        ]


class LiquidTemplateProcessor(ViewAttributeProcessor):
    """Processes Liquid template variables and conditionals"""

    def transform(self, value: str, view_data: dict) -> str:
        return process_liquid_templates(
            text=value,
            variables=self.liquid_vars,
            view_name=view_data.get(VIEW_NAME_KEY, "unknown"),
        )


class SqlFragmentCompleter(ViewAttributeProcessor):
    """
    Completes partial SQL by adding SELECT/FROM clauses.
    Looker allows SQL fragments without full query structure.
    """

    def supports_attribute(self, attribute: str) -> bool:
        return attribute == f"{DERIVED_TABLE_KEY}.{SQL_KEY}"

    def transform(self, value: str, view_data: dict) -> str:
        if (
            DERIVED_TABLE_KEY not in view_data
            or SQL_KEY not in view_data[DERIVED_TABLE_KEY]
        ):
            return value

        query: str = value

        if not re.search(r"SELECT\s", query, flags=re.I):
            query = f"SELECT {query}"

        if not re.search(r"FROM\s", query, flags=re.I):
            view_name = view_data[VIEW_NAME_KEY]
            query = f"{query} FROM {view_name}"

        return query


class DerivedPatternCleaner(ViewAttributeProcessor):
    """Removes ${} wrapper from derived view references"""

    def transform(self, value: str, view_data: dict) -> str:
        return re.sub(DERIVED_PATTERN, r"\1", value)


class EnvironmentCodeFilter(ViewAttributeProcessor):
    """
    Processes environment-specific code comments.
    Removes code for non-matching environments.
    """

    def __init__(
        self,
        liquid_vars: Optional[Dict[str, Any]] = None,
        constants: Optional[Dict[str, str]] = None,
        environment: str = PRODUCTION_ENV,
    ):
        super().__init__(liquid_vars, constants, environment)

        self.active_env_pattern = r"--\s*if\s+{}\s*--".format(self.environment.lower())

        inactive_env = (
            DEVELOPMENT_ENV
            if self.environment.lower() == PRODUCTION_ENV
            else PRODUCTION_ENV
        )
        self.inactive_env_pattern = r"--\s*if\s+{}\s*--.*?(?=--\s*if\s|\Z)".format(
            inactive_env
        )

    def transform(self, value: str, view_data: dict) -> str:
        # Remove inactive environment blocks (including the marker and content)
        result: str = re.sub(
            self.inactive_env_pattern, "", value, flags=re.IGNORECASE | re.DOTALL
        )

        # Remove active environment markers (keep the content)
        result = re.sub(self.active_env_pattern, "", result, flags=re.IGNORECASE)

        return result


class ConstantResolver(ViewAttributeProcessor):
    """
    Resolves @{constant} references from configuration or manifest.
    Logs warnings for undefined constants.
    """

    def __init__(
        self,
        liquid_vars: Optional[Dict[str, Any]] = None,
        constants: Optional[Dict[str, str]] = None,
        environment: str = PRODUCTION_ENV,
        manifest_constants: Optional[Dict[str, str]] = None,
    ):
        super().__init__(liquid_vars, constants, environment)
        self.manifest_constants = manifest_constants or {}

    def resolve_constant_refs(self, text: str, view_name: Optional[str]) -> str:
        """Replace constant placeholders with actual values"""

        def replace_match(match):
            const_key = match.group(1)

            if const_key in self.constants:
                return str(self.constants.get(const_key))

            if const_key in self.manifest_constants:
                return self.manifest_constants[const_key]

            if const_key in self.liquid_vars:
                logger.warning(
                    f"Constant '{const_key}' found in liquid_vars for view '{view_name}'. "
                    f"Move to constants configuration."
                )
                return f"@{{{const_key}}}"

            logger.warning(
                f"Undefined constant '{const_key}' in view '{view_name}'. "
                f"Define in constants config or manifest."
            )
            return f"@{{{const_key}}}"

        return re.sub(CONSTANT_PATTERN, replace_match, text)

    def transform(self, value: str, view_data: dict) -> str:
        return self.resolve_constant_refs(
            text=value, view_name=view_data.get(VIEW_NAME_KEY)
        )


class ViewTransformationPipeline:
    """
    Orchestrates multi-stage view transformation.
    Applies processors in sequence and merges results.
    """

    def __init__(
        self,
        processors: List[ViewAttributeProcessor],
        view_data: dict,
    ):
        self.processors = processors
        self.view_data = view_data
        self.result_cache: Optional[dict] = None

    def get_transformed_view(self) -> dict:
        """Execute pipeline and return transformed view"""
        if self.result_cache:
            return self.result_cache

        self.result_cache = {**self.view_data}

        view_name = self.view_data.get(VIEW_NAME_KEY, "unknown")
        logger.debug(f"Transforming view: {view_name}")

        for processor in self.processors:
            logger.debug(f"Applying: {processor.__class__.__name__}")

            updates = processor.execute(self.result_cache)
            self._merge_updates(self.result_cache, updates)

        return self.result_cache

    @staticmethod
    def _merge_updates(target: dict, updates: dict) -> None:
        """Deep merge updates into target dictionary"""
        for key, value in updates.items():
            if (
                key in target
                and isinstance(target[key], dict)
                and isinstance(value, dict)
            ):
                ViewTransformationPipeline._merge_updates(target[key], value)
            else:
                target[key] = value


def apply_template_transformations(
    lkml_data: dict,
    liquid_vars: Optional[Dict[str, Any]] = None,
    constants: Optional[Dict[str, str]] = None,
    manifest_constants: Optional[Dict[str, str]] = None,
    environment: str = PRODUCTION_ENV,
    process_constants: bool = False,
) -> None:
    """
    Apply all template transformations to views in LookML data.

    Processing order:
    1. Environment-specific code filtering
    2. Liquid template variable substitution
    3. Derived pattern cleanup
    4. SQL fragment completion
    5. Constant resolution (optional)
    """
    if "views" not in lkml_data:
        return

    liquid_vars = liquid_vars or {}
    constants = constants or {}
    manifest_constants = manifest_constants or {}

    processors: List[ViewAttributeProcessor] = [
        EnvironmentCodeFilter(
            liquid_vars=liquid_vars,
            constants=constants,
            environment=environment,
        ),
        LiquidTemplateProcessor(
            liquid_vars=liquid_vars,
            constants=constants,
            environment=environment,
        ),
        DerivedPatternCleaner(
            liquid_vars=liquid_vars,
            constants=constants,
            environment=environment,
        ),
        SqlFragmentCompleter(
            liquid_vars=liquid_vars,
            constants=constants,
            environment=environment,
        ),
    ]

    if process_constants:
        processors.append(
            ConstantResolver(
                liquid_vars=liquid_vars,
                constants=constants,
                environment=environment,
                manifest_constants=manifest_constants,
            )
        )

    transformed_views: List[dict] = []

    for view in lkml_data["views"]:
        pipeline = ViewTransformationPipeline(
            processors=processors,
            view_data=view,
        )
        transformed_views.append(pipeline.get_transformed_view())

    lkml_data["views"] = transformed_views


def load_and_transform_lkml(
    file_path: Union[str, pathlib.Path],
    liquid_vars: Optional[Dict[str, Any]] = None,
    constants: Optional[Dict[str, str]] = None,
    manifest_constants: Optional[Dict[str, str]] = None,
    environment: str = PRODUCTION_ENV,
    process_constants: bool = False,
) -> dict:
    """
    Load LookML file and apply template transformations.
    Returns dictionary with original and transformed view attributes.
    """
    with open(file_path, "r", encoding="utf-8") as file:
        parsed_data = lkml.load(file)

    apply_template_transformations(
        lkml_data=parsed_data,
        liquid_vars=liquid_vars,
        constants=constants,
        manifest_constants=manifest_constants,
        environment=environment,
        process_constants=process_constants,
    )

    return parsed_data
