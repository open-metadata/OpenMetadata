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
from typing import List, Optional  # noqa: UP035

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
            logger.debug(f"Found variable: {var_name} = {var_value}")

        # Extract boolean variables
        for match in BOOL_ASSIGNMENT_PATTERN.finditer(source_code):
            var_name = match.group(1)
            var_value = match.group(2)
            variables[var_name] = var_value
            logger.debug(f"Found boolean variable: {var_name} = {var_value}")
    except Exception as exc:
        logger.debug(f"Error extracting variables: {exc}")
    return variables


def extract_kafka_sources(source_code: str) -> List[KafkaSourceConfig]:  # noqa: UP006
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
                if any(keyword in var_name.lower() for keyword in ["topic", "subject", "stream"]):
                    topic_candidates.append(var_value)
                    logger.debug(f"Found potential topic from variable {var_name}: {var_value}")

            if topic_candidates:
                kafka_config = KafkaSourceConfig(
                    bootstrap_servers=None,  # Not available in abstracted pattern
                    topics=topic_candidates,
                    group_id_prefix=None,
                )
                kafka_configs.append(kafka_config)
                logger.debug(f"Extracted Kafka config from variables: topics={topic_candidates}")

    except Exception as exc:
        logger.warning(f"Error parsing Kafka sources from code: {exc}")

    return kafka_configs


def _extract_option(config_block: str, option_name: str, variables: dict = None) -> Optional[str]:  # noqa: RUF013, UP045
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
                logger.debug(f"Resolved variable {var_name} = {variables[var_name]} for option {option_name}")
                return variables[var_name]
            else:  # noqa: RET505
                logger.debug(f"Variable {var_name} referenced but not found in source code")

    except Exception as exc:
        logger.debug(f"Failed to extract option {option_name}: {exc}")
    return None


# The wildcards a Databricks glob include may use. Shared so that the directory
# reduction and the matcher always agree on what makes a pattern a pattern.
GLOB_WILDCARDS = ("*", "?")


def is_glob_pattern(include: str) -> bool:
    """True when the include selects a set of files rather than naming one."""
    return any(wildcard in include for wildcard in GLOB_WILDCARDS)


def glob_base_directory(include: str) -> str:
    """
    Reduce a glob include pattern to the directory the caller should list.

    Everything from the first wildcard onward is dropped, and the result always
    ends with `/`. `/tx/**`, `/tx/*.sql` and `/tx/**/*.sql` all reduce to `/tx/`.
    The pattern itself is kept on the returned `DLTLibrarySource` so the listing
    can be filtered back down to what the pattern actually selects.

    A pattern with no wildcard is already a concrete path and is returned as is.
    """
    if not is_glob_pattern(include):
        return include
    first_wildcard = min(include.index(w) for w in GLOB_WILDCARDS if w in include)
    base = include[:first_wildcard]
    if not base.endswith("/"):
        # a partial segment such as "/tx/staging*" leaves "/tx/staging", whose
        # directory is the widest thing that is certain to contain the matches
        base = base.rsplit("/", 1)[0] + "/"
    return base


def glob_matches(path: str, pattern: Optional[str]) -> bool:  # noqa: UP045
    """
    Check a workspace path against a Databricks glob include.

    `**` spans directories, `*` and `?` stay inside one segment. `fnmatch` is not
    used because there `*` also crosses `/`, which would make `/tx/*.sql` match
    files nested in subdirectories.

    An entry with no pattern matches, so notebook and file libraries pass through.
    """
    if not pattern:
        return True

    regex = []
    index = 0
    while index < len(pattern):
        char = pattern[index]
        if pattern.startswith("**/", index):
            regex.append("(?:.*/)?")
            index += 3
        elif pattern.startswith("**", index):
            regex.append(".*")
            index += 2
        elif char == "*":
            regex.append("[^/]*")
            index += 1
        elif char == "?":
            regex.append("[^/]")
            index += 1
        else:
            regex.append(re.escape(char))
            index += 1
    return re.fullmatch("".join(regex), path) is not None


def get_pipeline_libraries(pipeline_config: dict) -> List[DLTLibrarySource]:  # noqa: UP006
    """
    Collect the source paths a DLT pipeline declares in `spec.libraries`.

    A library entry is one of three shapes, and a pipeline may mix them:
      - `{"notebook": {"path": ...}}`  a workspace notebook
      - `{"file": {"path": ...}}`      a file, used by Git folders and Asset Bundles
      - `{"glob": {"include": ...}}`   the directory to expand, plus the pattern
        its contents must match

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
                    logger.info(f"   ✓ Found {key}: {path}")
                break
            else:
                glob_entry = lib.get("glob")
                include = glob_entry.get("include") if isinstance(glob_entry, dict) else glob_entry
                if include:
                    # an include without a wildcard names a path rather than selecting
                    # a set, so it carries no pattern to filter the listing against
                    pattern = include if is_glob_pattern(include) else None
                    base_path = glob_base_directory(include)
                    libraries.append(DLTLibrarySource(path=base_path, pattern=pattern))
                    logger.info(f"   ✓ Found glob {include}, listing: {base_path}")
        except Exception as exc:
            logger.debug(f"Failed to process library entry {lib}: {exc}")
            continue

    return libraries
