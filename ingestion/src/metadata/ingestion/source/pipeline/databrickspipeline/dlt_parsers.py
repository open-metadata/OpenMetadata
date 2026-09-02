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
Dataset dependency extraction for Delta Live Tables pipelines.

A DLT pipeline is authored in exactly one language. Each language is a parser that
says whether it recognises a piece of source (`handles`) and turns it into
`DLTTableDependency` records (`extract`).

Adding a language means writing one parser and listing it in `DLT_PARSERS`.
"""

import re
from typing import Any, List, Optional, Protocol, Type  # noqa: UP035

from metadata.ingestion.source.pipeline.databrickspipeline.kafka_parser import (
    KAFKA_STREAM_PATTERN,
    extract_variables,
)
from metadata.ingestion.source.pipeline.databrickspipeline.models import (
    DLTTableDependency,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def _unique(names) -> List[str]:  # noqa: UP006
    """De-duplicate while preserving the order the parser reported."""
    return list(dict.fromkeys(names))


class DltSourceParser(Protocol):
    """Contract every DLT language parser implements."""

    @staticmethod
    def handles(source_code: str) -> bool:
        """True when this parser recognises the authoring language of the source."""
        ...

    @staticmethod
    def extract(source_code: str) -> List[DLTTableDependency]:  # noqa: UP006
        """Datasets declared by the source, with the tables each one reads."""
        ...


def extract_dlt_table_dependencies(source_code: str) -> List[DLTTableDependency]:  # noqa: UP006
    """
    Extract the datasets a DLT source file declares.

    Dispatches to the first registered parser that recognises the source, most
    specific first. Returns an empty list when nothing recognises it, which the
    caller reports as a skip.
    """
    if not source_code:
        return []

    for parser in DLT_PARSERS:
        try:
            if parser.handles(source_code):
                logger.debug(f"Parsing DLT source with {parser.__name__}")
                return parser.extract(source_code)
        except Exception as exc:
            logger.warning(f"{parser.__name__} failed, trying the next parser: {exc}")
            continue

    logger.debug("No DLT parser recognised this source")
    return []


# ---------------------------------------------------------------------------
# SQL
# ---------------------------------------------------------------------------

# Statements that declare or populate a DLT dataset. CREATE covers materialized
# views and streaming tables (plus the legacy LIVE TABLE spelling), and
# APPLY CHANGES INTO is the CDC form, which writes into an already declared table.
SQL_DLT_CREATE_PATTERN = re.compile(
    r"\bCREATE\s+(?:OR\s+REFRESH\s+)?(?:TEMPORARY\s+|PRIVATE\s+)?"
    r"(?:MATERIALIZED\s+VIEW|STREAMING\s+(?:LIVE\s+)?TABLE|LIVE\s+TABLE)\b",
    re.IGNORECASE,
)
SQL_DLT_APPLY_CHANGES_PATTERN = re.compile(r"\bAPPLY\s+CHANGES\s+INTO\b", re.IGNORECASE)

# `STREAM(table)` marks a streaming read. It is a DLT marker rather than a real
# function, and query parsers otherwise report "stream" itself as the source table.
# Only unwrapped when it holds a plain identifier, so `STREAM read_files(...)` and
# other table-valued forms are left untouched.
SQL_STREAM_WRAPPER_PATTERN = re.compile(r"\bSTREAM\s*\(\s*([A-Za-z0-9_.`\"]+)\s*\)", re.IGNORECASE)

# `LIVE.name` addresses a dataset inside the same pipeline. The prefix is a DLT
# namespace, not a schema, so it must be dropped rather than resolved as one.
SQL_LIVE_PREFIX_PATTERN = re.compile(r"^live\.", re.IGNORECASE)

# Spellings DLT accepts that the query parser does not. `PRIVATE` is a modifier on the
# modern names, and `LIVE TABLE` / `STREAMING LIVE TABLE` are the original names that
# Databricks still honours. The parser falls back to a bare command for each and then
# reports no tables at all, so the dataset would be dropped with neither an error nor a
# warning. Rewriting to the modern equivalent is what lets the statement parse. Each is
# anchored to the CREATE clause, so a dataset whose own name contains "live" is never
# rewritten.
SQL_PRIVATE_MODIFIER_PATTERN = re.compile(
    r"(\bCREATE\s+(?:OR\s+REFRESH\s+)?(?:TEMPORARY\s+)?)PRIVATE\s+", re.IGNORECASE
)
SQL_LEGACY_STREAMING_TABLE_PATTERN = re.compile(
    r"(\bCREATE\s+(?:OR\s+REFRESH\s+)?(?:TEMPORARY\s+)?)STREAMING\s+LIVE\s+TABLE\b", re.IGNORECASE
)
SQL_LEGACY_LIVE_TABLE_PATTERN = re.compile(
    r"(\bCREATE\s+(?:OR\s+REFRESH\s+)?(?:TEMPORARY\s+)?)LIVE\s+TABLE\b", re.IGNORECASE
)

# Table-valued functions a query parser surfaces as if they were tables. These are
# only dropped when the statement actually invokes them, so a dataset legitimately
# named `range` or `stream` still resolves.
SQL_TABLE_VALUED_FUNCTIONS = frozenset({"stream", "read_files", "cloud_files", "read_kafka", "read_kinesis", "range"})

# An identifier immediately followed by "(" is a call, not a table reference
SQL_FUNCTION_CALL_PATTERN = re.compile(r"\b([A-Za-z_][A-Za-z0-9_]*)\s*\(")


class SqlDltParser:
    """
    Parser for DLT pipelines whose transformations are `.sql` files.

    Each statement declares one dataset and the tables feeding it. Parsing is
    delegated to the shared `LineageParser` so dialect handling, query masking and
    timeouts behave the same as everywhere else in the ingestion framework.
    """

    @staticmethod
    def handles(source_code: str) -> bool:
        return bool(SQL_DLT_CREATE_PATTERN.search(source_code) or SQL_DLT_APPLY_CHANGES_PATTERN.search(source_code))

    @staticmethod
    def _normalise(table: Any, called_functions: frozenset = frozenset()) -> Optional[str]:  # noqa: UP045
        """Turn a parser table reference into a name, or None when it is not a table."""
        from metadata.utils.helpers import get_formatted_entity_name, has_table_name

        name = get_formatted_entity_name(str(table))
        if not name or not has_table_name(name):
            return None
        name = SQL_LIVE_PREFIX_PATTERN.sub("", name)
        if not name:
            return None
        lowered = name.lower()
        if lowered in SQL_TABLE_VALUED_FUNCTIONS and lowered in called_functions:
            return None
        return name

    @staticmethod
    def _modernise(statement: str) -> str:
        """Rewrite the spellings the query parser cannot read into ones it can.

        `PRIVATE` is stripped first so it does not block the legacy rewrites behind it,
        and `STREAMING LIVE TABLE` is matched before `LIVE TABLE` so the streaming form
        is not mistaken for the batch one.
        """
        statement = SQL_PRIVATE_MODIFIER_PATTERN.sub(r"\1", statement)
        statement = SQL_LEGACY_STREAMING_TABLE_PATTERN.sub(r"\1STREAMING TABLE", statement)
        return SQL_LEGACY_LIVE_TABLE_PATTERN.sub(r"\1MATERIALIZED VIEW", statement)

    @staticmethod
    def extract(source_code: str) -> List[DLTTableDependency]:  # noqa: UP006
        # Imported here so pipelines that never use SQL do not pay the import cost
        # of the lineage stack.
        import sqlparse

        from metadata.ingestion.lineage.models import Dialect
        from metadata.ingestion.lineage.parser import LineageParser

        dependencies: List[DLTTableDependency] = []  # noqa: UP006
        for raw_statement in sqlparse.split(source_code):
            statement = raw_statement.strip()
            if not statement or not SqlDltParser.handles(statement):
                continue
            try:
                statement = SqlDltParser._modernise(statement)
                statement = SQL_STREAM_WRAPPER_PATTERN.sub(r"\1", statement)
                parser = LineageParser(statement, Dialect.DATABRICKS)
                # LineageParser exposes these through the third-party cached_property,
                # which type checkers cannot resolve to the underlying list
                parsed_targets: Any = parser.target_tables or []
                parsed_sources: Any = parser.source_tables or []

                called = frozenset(match.group(1).lower() for match in SQL_FUNCTION_CALL_PATTERN.finditer(statement))
                targets = _unique(name for name in (SqlDltParser._normalise(t, called) for t in parsed_targets) if name)
                if not targets:
                    logger.debug(f"No dataset parsed from SQL DLT statement: {statement[:120]}")
                    continue

                sources = _unique(name for name in (SqlDltParser._normalise(s, called) for s in parsed_sources) if name)
                # A dataset never depends on itself. APPLY CHANGES INTO in particular
                # names the same table it writes to. Stripping the LIVE. prefix can also
                # collapse two references onto one dataset, hence the de-duplication.
                depends_on = [name for name in sources if name not in targets]

                for target in targets:
                    existing = next((d for d in dependencies if d.table_name == target), None)
                    if existing:
                        # CDC pipelines declare the table, then populate it in a
                        # separate APPLY CHANGES statement. Merge rather than duplicate.
                        existing.depends_on.extend(name for name in depends_on if name not in existing.depends_on)
                        continue
                    dependencies.append(DLTTableDependency(table_name=target, depends_on=list(depends_on)))
                    logger.debug(f"Extracted SQL DLT dataset {target} depends_on={depends_on}")
            except Exception as exc:
                logger.debug(f"Error parsing SQL DLT statement: {exc}")
                continue

        return dependencies


# ---------------------------------------------------------------------------
# Python
# ---------------------------------------------------------------------------

# Any decorator that declares a dataset. This must stay in step with the function
# pattern used during extraction, otherwise a source gets recognised but yields
# nothing (or, worse, is not recognised and falls through to another language).
# `@dlt.view()` in particular takes no name argument.
DLT_DATASET_DECORATOR_PATTERN = re.compile(
    r"@dlt\.(?:table|view)\s*\(",
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

# Pattern to extract dlt.read_stream("table_name") calls
DLT_READ_STREAM_PATTERN = re.compile(
    r'dlt\.read_stream\s*\(\s*["\']([^"\']+)["\']\s*\)',
    re.IGNORECASE,
)

# Pattern to extract dlt.read("table_name") calls (batch reads)
DLT_READ_PATTERN = re.compile(
    r'dlt\.read\s*\(\s*["\']([^"\']+)["\']\s*\)',
    re.IGNORECASE,
)

# Pattern to extract S3 paths from spark.read operations
# Matches: spark.read.json("s3://..."), spark.read.format("parquet").load("s3a://...")
# Uses a simpler pattern that captures any spark.read followed by method calls ending with a path
S3_PATH_PATTERN = re.compile(
    r'spark\.read.*?\.(?:load|json|parquet|csv|orc|avro)\s*\(\s*["\']([^"\']+)["\']\s*\)',
    re.DOTALL | re.IGNORECASE,
)


class PythonDltParser:
    """
    Parser for DLT pipelines written against the Python API.

    Datasets are declared with `@dlt.table` / `@dlt.view` decorators and read each
    other through `dlt.read` and `dlt.read_stream`. External reads are recognised
    for Kafka and S3 so the caller can attach topic and storage lineage.
    """

    @staticmethod
    def handles(source_code: str) -> bool:
        return bool(DLT_DATASET_DECORATOR_PATTERN.search(source_code))

    @staticmethod
    def extract_dlt_table_names(source_code: str) -> List[str]:  # noqa: UP006
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
                        inferred_name = PythonDltParser._infer_table_name_from_function(function_call, source_code)
                        if inferred_name:
                            table_names.append(inferred_name)
                            logger.debug(f"Found DLT table (inferred from {function_call}): {inferred_name}")

        except Exception as exc:
            logger.warning(f"Error parsing DLT table names from code: {exc}")

        return table_names

    @staticmethod
    def _infer_table_name_from_function(function_call: str, source_code: str) -> Optional[str]:  # noqa: UP045
        """
        Infer table name from function call pattern

        Strategies:
        1. Look for entity_name variable and use it to build table name
        2. Extract keywords from function name (e.g., "event_log" from "generate_event_log_table_name")
        3. Handle Materializer pattern: entity_name + suffix from function name
        """
        try:
            # Extract variables to find entity_name or similar
            variables = extract_variables(source_code)

            # Strategy 1: Materializer pattern - entity_name + suffix from function
            # Handles: @dlt.table(name=materializer.generate_event_log_table_name())
            # where entity_name = "customerEvent" should produce "customerevent_event_log"
            entity_name = variables.get("entity_name") or variables.get("entity") or variables.get("table_name")

            if entity_name and "generate_event_log_table_name" in function_call.lower():
                table_name = f"{entity_name.lower()}_event_log"
                logger.debug(f"Inferred event_log table from Materializer pattern: {table_name}")
                return table_name

            if entity_name and "generate_snapshot_table_name" in function_call.lower():
                table_name = f"{entity_name.lower()}_snapshot"
                logger.debug(f"Inferred snapshot table from Materializer pattern: {table_name}")
                return table_name

            # Strategy 2: Use entity_name variable if present (fallback)
            if entity_name:
                logger.debug(f"Inferred table name from entity_name variable: {entity_name}")
                return entity_name

            # Strategy 3: Extract from function name (e.g., "event_log" from "generate_event_log_table_name")
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

    @staticmethod
    def extract(source_code: str) -> List[DLTTableDependency]:  # noqa: C901, UP006
        """
        Extract DLT table dependencies by analyzing @dlt.table decorators and dlt.read_stream calls

        For each DLT table, identifies:
        - Table name from @dlt.table(name="...")
        - Dependencies from dlt.read_stream("other_table") or dlt.read("other_table") calls
        - Whether it reads from Kafka (spark.readStream.format("kafka"))
        - Whether it reads from S3 (spark.read.json("s3://..."))
        - S3 locations if applicable

        Example:
            @dlt.table(name="source_table")
            def my_source():
                return spark.read.json("s3://bucket/path/")...

            @dlt.table(name="target_table")
            def my_target():
                return dlt.read("source_table")

        Returns:
            [
                DLTTableDependency(table_name="source_table", depends_on=[], reads_from_s3=True,
                                 s3_locations=["s3://bucket/path/"]),
                DLTTableDependency(table_name="target_table", depends_on=["source_table"],
                                 reads_from_s3=False)
            ]
        """
        dependencies = []

        try:
            if not source_code:
                return dependencies

            # Split source code into function definitions
            # Pattern: @dlt.table(...) or @dlt.view(...) followed by def function_name():
            # Handle multiline decorators with potentially nested parentheses
            function_pattern = re.compile(
                r"(@dlt\.(?:table|view)\s*\(.*?\)\s*def\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*:.*?)(?=@dlt\.|$)",
                re.DOTALL | re.IGNORECASE,
            )

            for match in function_pattern.finditer(source_code):
                try:
                    function_block = match.group(1)

                    # Extract table name from @dlt.table decorator
                    table_name = None
                    name_match = DLT_TABLE_NAME_LITERAL.search(function_block)
                    if name_match and name_match.group(1):
                        table_name = name_match.group(1)
                    else:
                        # Try function name pattern
                        func_name_match = DLT_TABLE_NAME_FUNCTION.search(function_block)
                        if func_name_match and func_name_match.group(1):
                            table_name = PythonDltParser._infer_table_name_from_function(
                                func_name_match.group(1), source_code
                            )

                    if not table_name:
                        # Try to extract from function definition itself
                        def_match = re.search(r"def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(", function_block)
                        if def_match:
                            table_name = def_match.group(1)

                    if not table_name:
                        logger.debug(f"Could not extract table name from block: {function_block[:100]}...")
                        continue

                    # Check if it reads from Kafka
                    # Direct pattern: spark.readStream.format("kafka")
                    reads_from_kafka = bool(KAFKA_STREAM_PATTERN.search(function_block))

                    # Materializer pattern: materializer.build_event_log_dataframe()
                    # This method internally reads from Kafka, so if we find this pattern
                    # and the table name matches event_log pattern, mark as Kafka reader
                    if not reads_from_kafka and "materializer.build_event_log_dataframe" in function_block:  # noqa: SIM102
                        if "event_log" in table_name:
                            reads_from_kafka = True
                            logger.debug(f"Table {table_name} reads from Kafka via Materializer")

                    # Check if it reads from S3
                    s3_locations = []
                    for s3_match in S3_PATH_PATTERN.finditer(function_block):
                        s3_path = s3_match.group(1)
                        if s3_path.startswith(("s3://", "s3a://", "s3n://")):
                            s3_locations.append(s3_path)
                            logger.debug(f"Table {table_name} reads from S3: {s3_path}")

                    reads_from_s3 = len(s3_locations) > 0

                    # Extract dlt.read_stream dependencies (streaming)
                    depends_on = []
                    for stream_match in DLT_READ_STREAM_PATTERN.finditer(function_block):
                        source_table = stream_match.group(1)
                        depends_on.append(source_table)
                        logger.debug(f"Table {table_name} streams from {source_table}")

                    # Extract dlt.read dependencies (batch)
                    for read_match in DLT_READ_PATTERN.finditer(function_block):
                        source_table = read_match.group(1)
                        depends_on.append(source_table)
                        logger.debug(f"Table {table_name} reads from {source_table}")

                    dependency = DLTTableDependency(
                        table_name=table_name,
                        depends_on=depends_on,
                        reads_from_kafka=reads_from_kafka,
                        reads_from_s3=reads_from_s3,
                        s3_locations=s3_locations,
                    )
                    dependencies.append(dependency)
                    logger.debug(
                        f"Extracted dependency: {table_name} - depends_on={depends_on}, "
                        f"reads_from_kafka={reads_from_kafka}, reads_from_s3={reads_from_s3}, "
                        f"s3_locations={s3_locations}"
                    )

                except Exception as exc:
                    logger.debug(f"Error parsing function block: {exc}")
                    continue

            # Handle Materializer snapshot pattern:
            # if snapshot_required:
            #     materializer.build_snapshot_dataframe()
            # This creates a snapshot table without @dlt.table decorator
            try:
                variables = extract_variables(source_code)
                snapshot_required = variables.get("snapshot_required")
                entity_name = variables.get("entity_name") or variables.get("entity") or variables.get("table_name")

                # Check if snapshot table is built
                # snapshot_required can be "True" (string) or True (boolean)
                is_snapshot_enabled = snapshot_required and str(snapshot_required).lower() == "true"

                if is_snapshot_enabled and entity_name and "build_snapshot_dataframe" in source_code:
                    snapshot_table_name = f"{entity_name.lower()}_snapshot"
                    event_log_table_name = f"{entity_name.lower()}_event_log"

                    # Find the event_log table in existing dependencies
                    event_log_dep = next(
                        (d for d in dependencies if d.table_name == event_log_table_name),
                        None,
                    )

                    if event_log_dep:
                        # Create snapshot table that depends on event_log
                        snapshot_dependency = DLTTableDependency(
                            table_name=snapshot_table_name,
                            depends_on=[event_log_table_name],
                            reads_from_kafka=False,
                            reads_from_s3=False,
                            s3_locations=[],
                        )
                        dependencies.append(snapshot_dependency)
                        logger.debug(
                            f"Extracted Materializer snapshot table: {snapshot_table_name} depends on {event_log_table_name}"
                        )
                    else:
                        logger.debug(
                            f"Found snapshot pattern but event_log table {event_log_table_name} not found in dependencies"
                        )

            except Exception as exc:
                logger.debug(f"Error extracting Materializer snapshot pattern: {exc}")

        except Exception as exc:
            logger.warning(f"Error extracting DLT table dependencies: {exc}")

        return dependencies


# Checked in order. Python comes first because a `@dlt.` decorator is unambiguous,
# while the SQL keywords can also appear inside a string literal in a Python
# notebook that calls spark.sql(...).
DLT_PARSERS: List[Type[DltSourceParser]] = [PythonDltParser, SqlDltParser]  # noqa: UP006
