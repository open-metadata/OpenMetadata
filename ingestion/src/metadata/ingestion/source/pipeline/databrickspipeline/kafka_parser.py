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
Kafka source configuration parsing for Databricks DLT pipelines.

Dataset dependency extraction lives in `dlt_parsers.py`.
"""

import re

from metadata.ingestion.source.pipeline.databrickspipeline.models import (
    DLTLibrarySource,
    KafkaSourceConfig,
)
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

# Pattern to extract boolean variable assignments like: snapshot_required = True
BOOL_ASSIGNMENT_PATTERN = re.compile(
    r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(True|False)\s*$",
    re.MULTILINE,
)


def extract_variables(source_code: str) -> dict:
    """
    Extract variable assignments from source code

    Examples:
        TOPIC = "events"
        KAFKA_BROKER = "localhost:9092"
        snapshot_required = True

    Returns dict like: {"TOPIC": "events", "KAFKA_BROKER": "localhost:9092", "snapshot_required": "True"}
    """
    variables = {}
    try:
        # Extract string variables
        for match in VARIABLE_ASSIGNMENT_PATTERN.finditer(source_code):
            var_name = match.group(1)
            var_value = match.group(2)
            variables[var_name] = var_value
            logger.debug("Found variable: %s = %s", var_name, var_value)

        # Extract boolean variables
        for match in BOOL_ASSIGNMENT_PATTERN.finditer(source_code):
            var_name = match.group(1)
            var_value = match.group(2)
            variables[var_name] = var_value
            logger.debug("Found boolean variable: %s = %s", var_name, var_value)
    except Exception as exc:
        logger.debug("Error extracting variables: %s", exc)
    return variables


def extract_kafka_sources(source_code: str) -> list[KafkaSourceConfig]:
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
        variables = extract_variables(source_code)

        # Try to find explicit Kafka streaming patterns
        found_explicit_kafka = False
        for match in KAFKA_STREAM_PATTERN.finditer(source_code):
            try:
                found_explicit_kafka = True
                config_block = match.group(1)

                bootstrap_servers = _extract_option(config_block, r"kafka\.bootstrap\.servers", variables)
                subscribe_topics = _extract_option(config_block, r"subscribe", variables)
                topics = _extract_option(config_block, r"topics", variables)
                group_id_prefix = _extract_option(config_block, r"groupIdPrefix", variables)

                topic_list = []
                if subscribe_topics:
                    topic_list = [t.strip() for t in subscribe_topics.split(",") if t.strip()]
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
                        f"Extracted Kafka config: brokers={bootstrap_servers}, "  # noqa: G004
                        f"topics={topic_list}, group_prefix={group_id_prefix}"
                    )
            except Exception as exc:
                logger.warning(f"Failed to parse individual Kafka config block: {exc}")  # noqa: G004
                continue

        # Fallback: If no explicit Kafka pattern found, look for topic_name variable
        # This handles cases where Kafka reading is abstracted in a helper class
        if not found_explicit_kafka and variables:
            topic_candidates = []
            for var_name, var_value in variables.items():
                # Look for variables that likely contain topic names
                if any(keyword in var_name.lower() for keyword in ["topic", "subject", "stream"]):
                    topic_candidates.append(var_value)
                    logger.debug(f"Found potential topic from variable {var_name}: {var_value}")  # noqa: G004

            if topic_candidates:
                kafka_config = KafkaSourceConfig(
                    bootstrap_servers=None,  # Not available in abstracted pattern
                    topics=topic_candidates,
                    group_id_prefix=None,
                )
                kafka_configs.append(kafka_config)
                logger.debug(f"Extracted Kafka config from variables: topics={topic_candidates}")  # noqa: G004

    except Exception as exc:
        logger.warning(f"Error parsing Kafka sources from code: {exc}")  # noqa: G004

    return kafka_configs


def _extract_option(config_block: str, option_name: str, variables: dict = None) -> str | None:  # noqa: RUF013
    """
    Extract a single option value from Kafka configuration block
    Supports both string literals and variable references
    Safely handles any parsing errors
    """
    if variables is None:
        variables = {}

    try:
        # Try matching quoted string literal: .option("subscribe", "topic")
        pattern_literal = rf'\.option\s*\(\s*["\']({option_name})["\']\s*,\s*["\']([^"\']+)["\']\s*\)'
        match = re.search(pattern_literal, config_block, re.IGNORECASE)
        if match:
            return match.group(2)

        # Try matching variable reference: .option("subscribe", TOPIC)
        pattern_variable = rf'\.option\s*\(\s*["\']({option_name})["\']\s*,\s*([A-Z_][A-Z0-9_]*)\s*\)'
        match = re.search(pattern_variable, config_block, re.IGNORECASE)
        if match:
            var_name = match.group(2)
            # Resolve variable
            if var_name in variables:
                logger.debug(f"Resolved variable {var_name} = {variables[var_name]} for option {option_name}")  # noqa: G004
                return variables[var_name]
            else:  # noqa: RET505
                logger.debug(f"Variable {var_name} referenced but not found in source code")  # noqa: G004

    except Exception as exc:
        logger.debug(f"Failed to extract option {option_name}: {exc}")  # noqa: G004
    return None


def glob_base_directory(include: str) -> str:
    """
    Reduce a glob include to the path the caller should read.

    The pipelines API only accepts an exact file, a directory, or a directory
    with a trailing `**`, and rejects every other wildcard form outright, so the
    reduction is just dropping the `**`. Truncating at any other stray wildcard
    keeps an unexpected include pointed at a real directory rather than at a path
    that cannot be read at all.
    """
    wildcard = include.find("*")
    if wildcard == -1:
        return include
    base = include[:wildcard]
    return base if base.endswith("/") else base.rsplit("/", 1)[0] + "/"


def get_pipeline_libraries(pipeline_config: dict) -> list[DLTLibrarySource]:
    """
    Collect the source paths a DLT pipeline declares in `spec.libraries`.

    A library entry is one of three shapes, and a pipeline may mix them:
      - `{"notebook": {"path": ...}}`  a workspace notebook
      - `{"file": {"path": ...}}`      a file, used by Git folders and Asset Bundles
      - `{"glob": {"include": ...}}`   an exact file, or a directory to expand in
        full. The pipelines API accepts nothing narrower, so there is no pattern
        to filter the directory's contents against.

    Malformed entries are skipped rather than failing the whole pipeline.
    """
    libraries = []

    if not pipeline_config:
        return libraries

    for lib in pipeline_config.get("libraries") or []:
        if not isinstance(lib, dict):
            continue
        try:
            for key in ("notebook", "file"):
                entry = lib.get(key)
                if not entry:
                    continue
                path = entry.get("path") if isinstance(entry, dict) else entry
                if path:
                    libraries.append(DLTLibrarySource(path=path))
                    logger.info("   ✓ Found %s: %s", key, path)
                break
            else:
                glob_entry = lib.get("glob")
                include = glob_entry.get("include") if isinstance(glob_entry, dict) else glob_entry
                if include:
                    base_path = glob_base_directory(include)
                    libraries.append(
                        DLTLibrarySource(
                            path=base_path,
                            # a `**` or a trailing slash names a directory outright.
                            # Anything else is unknowable from the string, so it is
                            # left to the caller to settle by listing it.
                            is_directory=True if base_path.endswith("/") else None,
                        )
                    )
                    logger.info("   ✓ Found glob %s, listing: %s", include, base_path)
        except Exception as exc:
            logger.debug(f"Failed to process library entry {lib}: {exc}")  # noqa: G004
            continue

    return libraries
