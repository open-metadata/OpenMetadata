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
Delta Lake table parser for Databricks notebooks
Extracts table references from Delta Lake and Unity Catalog patterns
"""

import re
from typing import List

from metadata.ingestion.source.pipeline.databrickspipeline.parsers.base_parser import (
    BaseSourceParser,
    SourceReference,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Compile patterns at module level for performance
SPARK_TABLE_PATTERN = re.compile(
    r'spark\.(?:read\.)?table\s*\(\s*["\']([^"\']+)["\']\s*\)',
    re.IGNORECASE,
)

DELTA_LOAD_PATTERN = re.compile(
    r'\.format\s*\(\s*["\']delta["\']\s*\)\.load\s*\(\s*["\']([^"\']+)["\']\s*\)',
    re.IGNORECASE | re.DOTALL,
)

DELTA_TABLE_FOR_PATH = re.compile(
    r'DeltaTable\.forPath\s*\(\s*spark\s*,\s*["\']([^"\']+)["\']\s*\)',
    re.IGNORECASE,
)

# SQL pattern: SELECT * FROM table_name or FROM catalog.schema.table
SQL_FROM_PATTERN = re.compile(
    r"\bFROM\s+([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*){0,2})\b",
    re.IGNORECASE,
)

# DLT read pattern: dlt.read("table_name") or dlt.read_stream("table_name")
DLT_READ_PATTERN = re.compile(
    r'dlt\.read(?:_stream)?\s*\(\s*["\']([^"\']+)["\']\s*\)',
    re.IGNORECASE,
)

# Variable assignments for table names
TABLE_VARIABLE_PATTERN = re.compile(
    r'^\s*([A-Z_][A-Z0-9_]*)\s*=\s*["\']([a-z_][a-z0-9_.]+)["\']\s*$',
    re.MULTILINE | re.IGNORECASE,
)


class DeltaSourceParser(BaseSourceParser):
    """
    Parser for Delta Lake and Unity Catalog table references

    Supports patterns:
    - spark.table("catalog.schema.table")
    - spark.read.table("table_name")
    - spark.read.format("delta").load("/path/to/table")
    - DeltaTable.forPath(spark, "/mnt/delta/table")
    - spark.sql("SELECT * FROM schema.table")
    - dlt.read("upstream_table")
    - TABLE_NAME = "catalog.schema.table"; spark.table(TABLE_NAME)
    """

    def get_source_type(self) -> str:
        return "delta"

    def can_parse(self, source_code: str) -> bool:
        """Check if code contains any Delta/table references"""
        if not source_code:
            return False

        # Quick check for common keywords
        keywords = ["spark.table", 'format("delta")', "DeltaTable", "FROM ", "dlt.read"]
        return any(keyword in source_code for keyword in keywords)

    def extract_sources(self, source_code: str) -> List[SourceReference]:
        """Extract all Delta/Unity Catalog table references"""
        sources = []

        try:
            if not source_code:
                return sources

            # Extract variable assignments for resolution
            variables = self._extract_variables(source_code)

            # Pattern 1: spark.table("table_name")
            for match in SPARK_TABLE_PATTERN.finditer(source_code):
                table_name = match.group(1)
                table_name = variables.get(
                    table_name, table_name
                )  # Resolve if variable
                sources.append(self._create_table_reference(table_name, "spark.table"))

            # Pattern 2: spark.read.format("delta").load("/path")
            for match in DELTA_LOAD_PATTERN.finditer(source_code):
                path = match.group(1)
                path = variables.get(path, path)
                sources.append(self._create_path_reference(path, "delta.load"))

            # Pattern 3: DeltaTable.forPath(spark, "/path")
            for match in DELTA_TABLE_FOR_PATH.finditer(source_code):
                path = match.group(1)
                path = variables.get(path, path)
                sources.append(self._create_path_reference(path, "DeltaTable.forPath"))

            # Pattern 4: SQL FROM clauses
            for match in SQL_FROM_PATTERN.finditer(source_code):
                table_name = match.group(1)
                table_name = variables.get(table_name, table_name)
                # Skip common SQL keywords that match pattern
                if table_name.lower() not in [
                    "select",
                    "where",
                    "group",
                    "order",
                    "having",
                ]:
                    sources.append(self._create_table_reference(table_name, "sql.from"))

            # Pattern 5: dlt.read("table_name")
            for match in DLT_READ_PATTERN.finditer(source_code):
                table_name = match.group(1)
                table_name = variables.get(table_name, table_name)
                sources.append(self._create_table_reference(table_name, "dlt.read"))

            logger.debug(f"Extracted {len(sources)} Delta/table references")

        except Exception as exc:
            logger.warning(f"Error extracting Delta sources: {exc}")

        return sources

    def _extract_variables(self, source_code: str) -> dict:
        """Extract variable assignments like TABLE_NAME = "catalog.schema.table" """
        variables = {}
        try:
            for match in TABLE_VARIABLE_PATTERN.finditer(source_code):
                var_name = match.group(1)
                var_value = match.group(2)
                variables[var_name] = var_value
                logger.debug(f"Found table variable: {var_name} = {var_value}")
        except Exception as exc:
            logger.debug(f"Error extracting table variables: {exc}")
        return variables

    def _create_table_reference(
        self, table_name: str, pattern_type: str
    ) -> SourceReference:
        """Create SourceReference for a table name"""
        # Parse catalog.schema.table or schema.table or table
        parts = table_name.split(".")

        if len(parts) == 3:
            # catalog.schema.table (Unity Catalog)
            source_type = "unity_catalog_table"
            fqn = table_name
            metadata = {
                "catalog": parts[0],
                "schema": parts[1],
                "table": parts[2],
                "pattern": pattern_type,
            }
        elif len(parts) == 2:
            # schema.table (Hive metastore or Unity Catalog default)
            source_type = "delta_table"
            fqn = table_name
            metadata = {
                "schema": parts[0],
                "table": parts[1],
                "pattern": pattern_type,
            }
        else:
            # Just table name
            source_type = "delta_table"
            fqn = table_name
            metadata = {
                "table": parts[0],
                "pattern": pattern_type,
            }

        return SourceReference(
            source_type=source_type,
            source_name=table_name,
            source_fqn=fqn,
            metadata=metadata,
        )

    def _create_path_reference(self, path: str, pattern_type: str) -> SourceReference:
        """Create SourceReference for a Delta path"""
        return SourceReference(
            source_type="delta_path",
            source_name=path,
            source_fqn=path,
            metadata={
                "path": path,
                "pattern": pattern_type,
            },
        )

    def get_priority(self) -> int:
        """High priority - Delta is very common in Databricks"""
        return 50
