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
Kafka configuration parser for Databricks DLT pipelines
"""

import re
from dataclasses import dataclass, field
from typing import List, Optional

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Compile regex patterns at module level for performance
KAFKA_STREAM_PATTERN = re.compile(
    r'\.format\s*\(\s*["\']kafka["\']\s*\)(.*?)\.load\s*\(\s*\)',
    re.DOTALL | re.IGNORECASE,
)

# Pattern to extract variable assignments like: TOPIC = "tracker-events" or topic_name = "events"
VARIABLE_ASSIGNMENT_PATTERN = re.compile(
    r'^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*["\']([^"\']+)["\']\s*$',
    re.MULTILINE,
)

# Pattern to extract DLT table decorators: @dlt.table(name="table_name", ...) or @dlt.table(name=func())
DLT_TABLE_PATTERN = re.compile(
    r"@dlt\.table\s*\(",
    re.IGNORECASE,
)

# Pattern to extract table name from decorator - supports both literals and function calls
DLT_TABLE_NAME_LITERAL = re.compile(
    r'@dlt\.table\s*\(\s*(?:.*?name\s*=\s*["\']([^"\']+)["\'])?',
    re.DOTALL | re.IGNORECASE,
)

DLT_TABLE_NAME_FUNCTION = re.compile(
    r"@dlt\.table\s*\(\s*(?:.*?name\s*=\s*([a-zA-Z_][a-zA-Z0-9_\.]+)\s*\([^)]*\))?",
    re.DOTALL | re.IGNORECASE,
)


@dataclass
class KafkaSourceConfig:
    """Model for Kafka source configuration extracted from DLT code"""

    bootstrap_servers: Optional[str] = None
    topics: List[str] = field(default_factory=list)
    group_id_prefix: Optional[str] = None


def _extract_variables(source_code: str) -> dict:
    """
    Extract variable assignments from source code

    Examples:
        TOPIC = "events"
        KAFKA_BROKER = "localhost:9092"

    Returns dict like: {"TOPIC": "events", "KAFKA_BROKER": "localhost:9092"}
    """
    variables = {}
    try:
        for match in VARIABLE_ASSIGNMENT_PATTERN.finditer(source_code):
            var_name = match.group(1)
            var_value = match.group(2)
            variables[var_name] = var_value
            logger.debug(f"Found variable: {var_name} = {var_value}")
    except Exception as exc:
        logger.debug(f"Error extracting variables: {exc}")
    return variables


def extract_kafka_sources(source_code: str) -> List[KafkaSourceConfig]:
    """
    Extract Kafka topic configurations from DLT source code

    Parses patterns like:
    - spark.readStream.format("kafka").option("subscribe", "topic1,topic2")
    - .option("kafka.bootstrap.servers", "broker:9092")
    - .option("groupIdPrefix", "dlt-pipeline")

    Also supports variable references:
    - TOPIC = "events"
    - .option("subscribe", TOPIC)

    Fallback for abstracted patterns:
    - topic_name = "my-topic"  (when Kafka reading is in helper class)

    Returns empty list if parsing fails or no sources found
    """
    kafka_configs = []

    try:
        if not source_code:
            logger.debug("Empty or None source code provided")
            return kafka_configs

        # Extract variable assignments for resolution
        variables = _extract_variables(source_code)

        # Try to find explicit Kafka streaming patterns
        found_explicit_kafka = False
        for match in KAFKA_STREAM_PATTERN.finditer(source_code):
            try:
                found_explicit_kafka = True
                config_block = match.group(1)

                bootstrap_servers = _extract_option(
                    config_block, r"kafka\.bootstrap\.servers", variables
                )
                subscribe_topics = _extract_option(
                    config_block, r"subscribe", variables
                )
                topics = _extract_option(config_block, r"topics", variables)
                group_id_prefix = _extract_option(
                    config_block, r"groupIdPrefix", variables
                )

                topic_list = []
                if subscribe_topics:
                    topic_list = [
                        t.strip() for t in subscribe_topics.split(",") if t.strip()
                    ]
                elif topics:
                    topic_list = [t.strip() for t in topics.split(",") if t.strip()]

                if bootstrap_servers or topic_list:
                    kafka_config = KafkaSourceConfig(
                        bootstrap_servers=bootstrap_servers,
                        topics=topic_list,
                        group_id_prefix=group_id_prefix,
                    )
                    kafka_configs.append(kafka_config)
                    logger.debug(
                        f"Extracted Kafka config: brokers={bootstrap_servers}, "
                        f"topics={topic_list}, group_prefix={group_id_prefix}"
                    )
            except Exception as exc:
                logger.warning(f"Failed to parse individual Kafka config block: {exc}")
                continue

        # Fallback: If no explicit Kafka pattern found, look for topic_name variable
        # This handles cases where Kafka reading is abstracted in a helper class
        if not found_explicit_kafka and variables:
            topic_candidates = []
            for var_name, var_value in variables.items():
                # Look for variables that likely contain topic names
                if any(
                    keyword in var_name.lower()
                    for keyword in ["topic", "subject", "stream"]
                ):
                    topic_candidates.append(var_value)
                    logger.debug(
                        f"Found potential topic from variable {var_name}: {var_value}"
                    )

            if topic_candidates:
                kafka_config = KafkaSourceConfig(
                    bootstrap_servers=None,  # Not available in abstracted pattern
                    topics=topic_candidates,
                    group_id_prefix=None,
                )
                kafka_configs.append(kafka_config)
                logger.debug(
                    f"Extracted Kafka config from variables: topics={topic_candidates}"
                )

    except Exception as exc:
        logger.warning(f"Error parsing Kafka sources from code: {exc}")

    return kafka_configs


def _extract_option(
    config_block: str, option_name: str, variables: dict = None
) -> Optional[str]:
    """
    Extract a single option value from Kafka configuration block
    Supports both string literals and variable references
    Safely handles any parsing errors
    """
    if variables is None:
        variables = {}

    try:
        # Try matching quoted string literal: .option("subscribe", "topic")
        pattern_literal = (
            rf'\.option\s*\(\s*["\']({option_name})["\']\s*,\s*["\']([^"\']+)["\']\s*\)'
        )
        match = re.search(pattern_literal, config_block, re.IGNORECASE)
        if match:
            return match.group(2)

        # Try matching variable reference: .option("subscribe", TOPIC)
        pattern_variable = (
            rf'\.option\s*\(\s*["\']({option_name})["\']\s*,\s*([A-Z_][A-Z0-9_]*)\s*\)'
        )
        match = re.search(pattern_variable, config_block, re.IGNORECASE)
        if match:
            var_name = match.group(2)
            # Resolve variable
            if var_name in variables:
                logger.debug(
                    f"Resolved variable {var_name} = {variables[var_name]} for option {option_name}"
                )
                return variables[var_name]
            else:
                logger.debug(
                    f"Variable {var_name} referenced but not found in source code"
                )

    except Exception as exc:
        logger.debug(f"Failed to extract option {option_name}: {exc}")
    return None


def extract_dlt_table_names(source_code: str) -> List[str]:
    """
    Extract DLT table names from @dlt.table decorators

    Parses patterns like:
    - @dlt.table(name="user_events_bronze_pl", ...)
    - @dlt.table(comment="...", name="my_table")
    - @dlt.table(name=generate_table_name())  (function call - infer from pattern)

    Returns list of table names found in decorators
    """
    table_names = []

    try:
        if not source_code:
            logger.debug("Empty or None source code provided")
            return table_names

        # First try to extract literal string table names
        for match in DLT_TABLE_NAME_LITERAL.finditer(source_code):
            table_name = match.group(1)
            if table_name:
                table_names.append(table_name)
                logger.debug(f"Found DLT table (literal): {table_name}")

        # If no literal names found, try function call pattern
        if not table_names:
            for match in DLT_TABLE_NAME_FUNCTION.finditer(source_code):
                function_call = match.group(1)
                if function_call:
                    # Extract table name hint from function name
                    # e.g., generate_event_log_table_name() -> event_log
                    inferred_name = _infer_table_name_from_function(
                        function_call, source_code
                    )
                    if inferred_name:
                        table_names.append(inferred_name)
                        logger.debug(
                            f"Found DLT table (inferred from {function_call}): {inferred_name}"
                        )

    except Exception as exc:
        logger.warning(f"Error parsing DLT table names from code: {exc}")

    return table_names


def _infer_table_name_from_function(
    function_call: str, source_code: str
) -> Optional[str]:
    """
    Infer table name from function call pattern

    Strategies:
    1. Look for entity_name variable and use it to build table name
    2. Extract keywords from function name (e.g., "event_log" from "generate_event_log_table_name")
    """
    try:
        # Extract variables to find entity_name or similar
        variables = _extract_variables(source_code)

        # Strategy 1: Use entity_name variable if present
        entity_name = (
            variables.get("entity_name")
            or variables.get("entity")
            or variables.get("table_name")
        )
        if entity_name:
            logger.debug(
                f"Inferred table name from entity_name variable: {entity_name}"
            )
            return entity_name

        # Strategy 2: Extract from function name (e.g., "event_log" from "generate_event_log_table_name")
        # Common patterns: generate_X_table_name, create_X_table, build_X_dataframe
        match = re.search(
            r"(?:generate|create|build)_([a-z_]+?)(?:_table|_dataframe)",
            function_call.lower(),
        )
        if match:
            inferred = match.group(1)
            logger.debug(f"Inferred table name from function pattern: {inferred}")
            return inferred

    except Exception as exc:
        logger.debug(f"Could not infer table name from function {function_call}: {exc}")

    return None


def get_pipeline_libraries(pipeline_config: dict, client=None) -> List[str]:
    """
    Extract notebook and file paths from pipeline configuration
    Safely handles missing or malformed configuration
    """
    libraries = []

    try:
        if not pipeline_config:
            return libraries

        for lib in pipeline_config.get("libraries", []):
            try:
                if "notebook" in lib:
                    notebook_path = lib["notebook"].get("path")
                    if notebook_path:
                        libraries.append(notebook_path)
                elif "file" in lib:
                    file_path = lib["file"].get("path")
                    if file_path:
                        libraries.append(file_path)
            except Exception as exc:
                logger.debug(f"Failed to process library entry {lib}: {exc}")
                continue

    except Exception as exc:
        logger.warning(f"Error extracting pipeline libraries: {exc}")

    return libraries
