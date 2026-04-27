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
Utilities for glob-style path pattern matching, Hive partition detection,
and file-to-table grouping in object storage connectors.

All functions are cloud-agnostic — they operate on path strings only.
"""

import re
from typing import Dict, List, Optional, Tuple

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

HIVE_PARTITION_PATTERN = re.compile(r"^([a-zA-Z_][a-zA-Z0-9_]*)=(.+)$")
# Non-Hive partition-like segments: pure digits (20230412), dates (2024-01-15),
# timestamps (20240115T000000Z), or digit-only names that look like partition values
NON_HIVE_PARTITION_PATTERN = re.compile(r"^(\d{4}[-/]?\d{2}[-/]?\d{2}(T\d+Z?)?|\d{8,})$")

# Map file extensions to structure formats (matching SupportedTypes enum values)
EXTENSION_TO_FORMAT = {
    ".parquet": "parquet",
    ".pq": "parquet",
    ".pqt": "parquet",
    ".parq": "parquet",
    ".csv": "csv",
    ".tsv": "tsv",
    ".json": "json",
    ".jsonl": "json",
    ".avro": "avro",
}


def infer_structure_format(key: str) -> Optional[str]:
    """Infer the structure format from a file's extension.

    Returns the format string (e.g., 'parquet', 'csv') or None if unknown.
    Handles compound extensions like .csv.gz and .parquet.snappy.
    """
    lower_key = key.lower()
    # Check compound extensions first (e.g., .csv.gz, .json.zip, .parquet.snappy)
    for suffix in (".gz", ".zip", ".snappy"):
        if lower_key.endswith(suffix):
            base = lower_key[: -len(suffix)]
            for ext, fmt in EXTENSION_TO_FORMAT.items():
                if base.endswith(ext):
                    return fmt
            break

    for ext, fmt in EXTENSION_TO_FORMAT.items():
        if lower_key.endswith(ext):
            return fmt
    return None


def extract_static_prefix(pattern: str) -> str:
    """Return the longest leading portion of a glob pattern with no wildcards.

    This prefix is used as the cloud API Prefix parameter to avoid
    scanning entire buckets.

    Examples:
        "data/*/events/*.parquet" -> "data/"
        "data/events/*.parquet"  -> "data/events/"
        "*/*.csv"                -> ""
        "data/events/2024.parquet" -> "data/events/2024.parquet"
    """
    parts = pattern.split("/")
    static_parts = []
    for part in parts:
        if "*" in part or "?" in part:
            break
        static_parts.append(part)

    if not static_parts:
        return ""

    prefix = "/".join(static_parts)
    # If the pattern continues after the static prefix, add trailing /
    remaining = pattern[len(prefix) :]
    if remaining and not prefix.endswith("/"):
        prefix += "/"
    return prefix


def pattern_to_regex(pattern: str) -> re.Pattern:
    """Convert a glob-style path pattern to a compiled regex.

    Glob semantics:
        *  -> matches any single path segment (no /)
        ** -> matches zero or more path segments (including /)
        ?  -> matches any single character (not /)

    Examples:
        "data/*/events/*.parquet" matches "data/warehouse/events/file.parquet"
        "data/**/*.json"         matches "data/a/b/c/file.json"
    """
    # Replace ** with a placeholder, then handle * and ?
    # ** must be handled first since * is a substring of **
    placeholder = "\x00DOUBLESTAR\x00"
    pattern = pattern.replace("**", placeholder)

    escaped = ""
    for char in pattern:
        if char == "*":
            escaped += "[^/]*"
        elif char == "?":
            escaped += "[^/]"
        else:
            escaped += re.escape(char)

    # Replace placeholder with recursive match (zero or more path segments)
    escaped_placeholder = re.escape(placeholder)
    escaped_slash = re.escape("/")

    # /DOUBLESTAR/ in the middle: match / or /any/path/
    escaped = re.sub(
        escaped_slash + escaped_placeholder + escaped_slash,
        "(?:/|/.+/)",
        escaped,
    )
    # DOUBLESTAR/ at the start: match empty or any/path/
    escaped = re.sub(
        "^" + escaped_placeholder + escaped_slash,
        "(?:|.+/)",
        escaped,
    )
    # /DOUBLESTAR at the end: match empty or /any/path
    escaped = re.sub(
        escaped_slash + escaped_placeholder + "$",
        "(?:|/.+)",
        escaped,
    )
    # Any remaining (standalone **): match anything
    escaped = escaped.replace(re.escape(placeholder), ".*")

    return re.compile(f"^{escaped}$")


def _is_partition_segment(segment: str) -> bool:
    """Check if a path segment looks like a partition value.

    Matches:
    - Hive-style: year=2024, State=AL
    - Date prefixes: 20230412, 2024-01-15
    - Timestamps: 20240115T000000Z
    """
    return bool(HIVE_PARTITION_PATTERN.match(segment) or NON_HIVE_PARTITION_PATTERN.match(segment))


def extract_table_root(key: str) -> str:
    """Extract the logical table root from a file path.

    The table root is the deepest directory before any partition-like
    segments. Detects both Hive-style (key=value) and non-Hive
    partitions (date prefixes like 20230412, 2024-01-15).

    This MUST produce the same name as manifest dataPath to ensure
    FQN compatibility during migration.

    Examples:
        "data/events/year=2024/month=01/file.parquet"       -> "data/events"
        "data/events/20230412/State=AL/file.parquet"        -> "data/events"
        "data/events/file.parquet"                          -> "data/events"
        "file.parquet"                                      -> ""
    """
    parts = key.split("/")

    # Find the first partition-like segment (Hive or non-Hive)
    partition_start = None
    for i, part in enumerate(parts[:-1]):  # Exclude filename
        if _is_partition_segment(part):
            partition_start = i
            break

    if partition_start is not None:
        root_parts = parts[:partition_start]
    else:
        root_parts = parts[:-1]

    return "/".join(root_parts)


def _extract_partition_segments(
    relative: str,
    partition_values: Dict[str, List[str]],
) -> List[str]:
    """Walk the path segments (excluding the filename) and collect
    Hive-style ``key=value`` pairs. Updates ``partition_values`` in place
    so the caller can later infer types per column."""
    current: List[str] = []
    for part in relative.split("/")[:-1]:
        match = HIVE_PARTITION_PATTERN.match(part)
        if match:
            col_name, col_value = match.group(1), match.group(2)
            current.append(col_name)
            partition_values.setdefault(col_name, []).append(col_value)
        elif current:
            # A non-partition segment after partition segments ends the run.
            break
    return current


def _check_partition_consistency(structures: List[List[str]], table_root: str) -> Optional[List[str]]:
    """Return the shared partition structure if every entry matches;
    log and return None on mismatch."""
    reference = structures[0]
    for structure in structures[1:]:
        if structure != reference:
            logger.warning(
                f"Inconsistent partition structure under '{table_root}'. "
                f"Found {structure} vs {reference}. Skipping auto-partition detection."
            )
            return None
    return reference


def detect_hive_partitions(keys: List[str], table_root: str) -> Optional[List[Column]]:
    """Detect Hive-style partition columns from file paths.

    Scans paths under ``table_root`` for consistent ``key=value``
    directory segments. Returns ``Column`` objects with inferred types
    if every file shares the same partition structure, ``None`` otherwise.

    Type inference:
        - All values are integers -> DataType.INT
        - All values match YYYY-MM-DD -> DataType.DATE
        - Otherwise -> DataType.VARCHAR
    """
    if not keys:
        return None

    root_prefix = table_root.rstrip("/") + "/" if table_root else ""
    partition_structures: List[List[str]] = []
    partition_values: Dict[str, List[str]] = {}
    has_flat_files = False

    for key in keys:
        if not key.startswith(root_prefix):
            continue
        current = _extract_partition_segments(key[len(root_prefix) :], partition_values)
        if current:
            partition_structures.append(current)
        else:
            has_flat_files = True

    if not partition_structures:
        return None
    if has_flat_files:
        logger.warning(
            f"Table root '{table_root}' has a mix of partitioned and flat files. Skipping partition detection."
        )
        return None

    reference = _check_partition_consistency(partition_structures, table_root)
    if reference is None:
        return None

    columns: List[Column] = []
    for col_name in reference:
        col_type = _infer_partition_type(partition_values.get(col_name, []))
        columns.append(
            Column(
                name=col_name,
                dataType=col_type,
                dataTypeDisplay=col_type.value,
            )
        )
    return columns


def _infer_partition_type(values: List[str]) -> DataType:
    """Infer the data type of a partition column from its observed values."""
    if not values:
        return DataType.VARCHAR

    # Check if all values are integers
    if all(_is_integer(v) for v in values):
        return DataType.INT

    # Check if all values match date pattern YYYY-MM-DD
    date_pattern = re.compile(r"^\d{4}-\d{2}-\d{2}$")
    if all(date_pattern.match(v) for v in values):
        return DataType.DATE

    return DataType.VARCHAR


def _is_integer(value: str) -> bool:
    """Check if a string value represents an integer."""
    try:
        int(value)
        return True
    except ValueError:
        return False


def group_files_by_table(
    keys: List[Tuple[str, int]],
) -> Dict[str, List[Tuple[str, int]]]:
    """Group matched file keys by their logical table root.

    Returns a dict of {table_root: [(key, size), ...]}.
    """
    groups: Dict[str, List[Tuple[str, int]]] = {}
    for key, size in keys:
        root = extract_table_root(key)
        groups.setdefault(root, []).append((key, size))
    return groups
