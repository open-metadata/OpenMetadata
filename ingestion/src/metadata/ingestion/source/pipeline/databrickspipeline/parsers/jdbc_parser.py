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
JDBC database parser for Databricks notebooks
Extracts database table references from JDBC connections
"""

import re
from typing import List, Optional, Tuple
from urllib.parse import urlparse

from metadata.ingestion.source.pipeline.databrickspipeline.parsers.base_parser import (
    BaseSourceParser,
    SourceReference,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# JDBC read patterns
# Pattern 1: spark.read.jdbc(url="jdbc:...", table="schema.table", ...)
JDBC_READ_PATTERN = re.compile(
    r'\.jdbc\s*\(\s*url\s*=\s*["\']([^"\']+)["\']\s*,\s*table\s*=\s*["\']([^"\']+)["\']',
    re.IGNORECASE | re.DOTALL,
)

# Pattern 2: .format("jdbc").option("url", "jdbc:...").option("dbtable", "table")
JDBC_FORMAT_PATTERN = re.compile(
    r'\.format\s*\(\s*["\']jdbc["\']\s*\)(.*?)\.load\s*\(',
    re.IGNORECASE | re.DOTALL,
)

# Extract URL from option
JDBC_URL_OPTION = re.compile(
    r'\.option\s*\(\s*["\']url["\']\s*,\s*["\']([^"\']+)["\']\s*\)',
    re.IGNORECASE,
)

# Extract table from option
JDBC_TABLE_OPTION = re.compile(
    r'\.option\s*\(\s*["\']dbtable["\']\s*,\s*["\']([^"\']+)["\']\s*\)',
    re.IGNORECASE,
)

# Variable assignments for JDBC URLs and tables
JDBC_VARIABLE_PATTERN = re.compile(
    r'^\s*([A-Z_][A-Z0-9_]*)\s*=\s*["\']([^"\']+)["\']\s*$',
    re.MULTILINE,
)


class JDBCSourceParser(BaseSourceParser):
    """
    Parser for JDBC database connections in Databricks notebooks

    Supported databases:
    - PostgreSQL: jdbc:postgresql://host:port/database
    - MySQL: jdbc:mysql://host:port/database
    - Oracle: jdbc:oracle:thin:@host:port:database
    - SQL Server: jdbc:sqlserver://host:port;database=dbname
    - Redshift: jdbc:redshift://host:port/database

    Patterns detected:
    - spark.read.jdbc(url="jdbc:postgresql://...", table="schema.table")
    - spark.read.format("jdbc").option("url", "...").option("dbtable", "table")
    - URL_VAR = "jdbc:..."; TABLE_VAR = "users"; spark.read.jdbc(url=URL_VAR, table=TABLE_VAR)
    """

    def get_source_type(self) -> str:
        return "jdbc"

    def can_parse(self, source_code: str) -> bool:
        """Check if code contains JDBC connections"""
        if not source_code:
            return False

        # Quick check for JDBC keywords
        return (
            "jdbc:" in source_code
            or '.format("jdbc")' in source_code
            or ".format('jdbc')" in source_code
        )

    def extract_sources(self, source_code: str) -> List[SourceReference]:
        """Extract all JDBC database table references"""
        sources = []

        try:
            if not source_code:
                return sources

            # Extract variable assignments for resolution
            variables = self._extract_variables(source_code)

            # Track unique connections to avoid duplicates
            seen_sources = set()

            # Pattern 1: spark.read.jdbc(url="...", table="...")
            for match in JDBC_READ_PATTERN.finditer(source_code):
                url = match.group(1)
                table = match.group(2)

                # Resolve variables
                url = variables.get(url, url)
                table = variables.get(table, table)

                source_key = f"{url}::{table}"
                if source_key not in seen_sources:
                    seen_sources.add(source_key)
                    source_ref = self._create_jdbc_reference(url, table, "jdbc_read")
                    if source_ref:
                        sources.append(source_ref)

            # Pattern 2: .format("jdbc").option("url", ...).option("dbtable", ...)
            for match in JDBC_FORMAT_PATTERN.finditer(source_code):
                config_block = match.group(1)

                # Extract URL
                url_match = JDBC_URL_OPTION.search(config_block)
                table_match = JDBC_TABLE_OPTION.search(config_block)

                if url_match and table_match:
                    url = url_match.group(1)
                    table = table_match.group(1)

                    # Resolve variables
                    url = variables.get(url, url)
                    table = variables.get(table, table)

                    source_key = f"{url}::{table}"
                    if source_key not in seen_sources:
                        seen_sources.add(source_key)
                        source_ref = self._create_jdbc_reference(
                            url, table, "jdbc_format"
                        )
                        if source_ref:
                            sources.append(source_ref)

            logger.debug(f"Extracted {len(sources)} JDBC table references")

        except Exception as exc:
            logger.warning(f"Error extracting JDBC sources: {exc}")

        return sources

    def _extract_variables(self, source_code: str) -> dict:
        """Extract variable assignments"""
        variables = {}
        try:
            for match in JDBC_VARIABLE_PATTERN.finditer(source_code):
                var_name = match.group(1)
                var_value = match.group(2)
                variables[var_name] = var_value
                logger.debug(f"Found JDBC variable: {var_name} = {var_value[:50]}...")
        except Exception as exc:
            logger.debug(f"Error extracting JDBC variables: {exc}")
        return variables

    def _create_jdbc_reference(
        self, jdbc_url: str, table_name: str, pattern_type: str
    ) -> Optional[SourceReference]:
        """
        Create SourceReference for JDBC connection

        Args:
            jdbc_url: JDBC connection URL (e.g., jdbc:postgresql://host:5432/db)
            table_name: Table name (can be schema.table or just table)
            pattern_type: How it was detected (jdbc_read, jdbc_format)

        Returns:
            SourceReference or None if URL cannot be parsed
        """
        try:
            # Parse JDBC URL to extract connection details
            db_type, host, port, database, schema = self._parse_jdbc_url(jdbc_url)

            if not db_type:
                logger.debug(f"Could not parse JDBC URL: {jdbc_url}")
                return None

            # Parse table name (could be schema.table)
            table_schema, table = self._parse_table_name(table_name, schema)

            # Build FQN: service.database.schema.table
            fqn_parts = [database] if database else []
            if table_schema:
                fqn_parts.append(table_schema)
            fqn_parts.append(table)
            table_fqn = ".".join(fqn_parts)

            return SourceReference(
                source_type=f"jdbc_{db_type}",
                source_name=table_fqn,
                source_fqn=table_fqn,
                connection_details={
                    "database_type": db_type,
                    "host": host,
                    "port": port,
                    "database": database,
                    "jdbc_url": jdbc_url,
                },
                metadata={
                    "database": database,
                    "schema": table_schema,
                    "table": table,
                    "pattern": pattern_type,
                    "db_type": db_type,
                },
            )

        except Exception as exc:
            logger.debug(f"Error creating JDBC reference: {exc}")
            return None

    def _parse_jdbc_url(
        self, jdbc_url: str
    ) -> Tuple[
        Optional[str], Optional[str], Optional[int], Optional[str], Optional[str]
    ]:
        """
        Parse JDBC URL to extract connection details

        Returns: (db_type, host, port, database, default_schema)
        """
        try:
            # Remove jdbc: prefix
            if not jdbc_url.startswith("jdbc:"):
                return None, None, None, None, None

            url_without_jdbc = jdbc_url[5:]  # Remove "jdbc:"

            # PostgreSQL: postgresql://host:port/database
            if url_without_jdbc.startswith("postgresql://"):
                parsed = urlparse(url_without_jdbc)
                return (
                    "postgresql",
                    parsed.hostname,
                    parsed.port or 5432,
                    parsed.path.lstrip("/").split("?")[0],
                    "public",  # Default schema
                )

            # MySQL: mysql://host:port/database
            elif url_without_jdbc.startswith("mysql://"):
                parsed = urlparse(url_without_jdbc)
                return (
                    "mysql",
                    parsed.hostname,
                    parsed.port or 3306,
                    parsed.path.lstrip("/").split("?")[0],
                    None,
                )

            # SQL Server: sqlserver://host:port;database=dbname
            elif url_without_jdbc.startswith("sqlserver://"):
                parts = url_without_jdbc.replace("sqlserver://", "").split(";")
                host_port = parts[0]
                host = host_port.split(":")[0]
                port = int(host_port.split(":")[1]) if ":" in host_port else 1433

                database = None
                for part in parts[1:]:
                    if part.startswith("database=") or part.startswith("databaseName="):
                        database = part.split("=")[1]

                return "mssql", host, port, database, "dbo"

            # Oracle: oracle:thin:@host:port:database or oracle:thin:@//host:port/service
            elif "oracle" in url_without_jdbc:
                if "@//" in url_without_jdbc:
                    # Service name format
                    parts = url_without_jdbc.split("@//")[1]
                    host_port, service = parts.split("/", 1)
                    host = host_port.split(":")[0]
                    port = int(host_port.split(":")[1]) if ":" in host_port else 1521
                    return "oracle", host, port, service.split("?")[0], None
                else:
                    # SID format
                    parts = url_without_jdbc.split("@")[1]
                    host, port, sid = parts.split(":")
                    return "oracle", host, int(port), sid, None

            # Redshift: redshift://host:port/database
            elif url_without_jdbc.startswith("redshift://"):
                parsed = urlparse(url_without_jdbc)
                return (
                    "redshift",
                    parsed.hostname,
                    parsed.port or 5439,
                    parsed.path.lstrip("/").split("?")[0],
                    "public",
                )

            else:
                logger.debug(f"Unsupported JDBC URL format: {jdbc_url}")
                return None, None, None, None, None

        except Exception as exc:
            logger.debug(f"Error parsing JDBC URL {jdbc_url}: {exc}")
            return None, None, None, None, None

    def _parse_table_name(
        self, table_name: str, default_schema: Optional[str]
    ) -> Tuple[Optional[str], str]:
        """
        Parse table name to extract schema and table

        Args:
            table_name: Can be "table", "schema.table", or even "catalog.schema.table"
            default_schema: Default schema if not specified in table_name

        Returns: (schema, table)
        """
        parts = table_name.split(".")

        if len(parts) >= 2:
            # schema.table or catalog.schema.table
            return parts[-2], parts[-1]  # Second-to-last is schema, last is table
        else:
            # Just table name
            return default_schema, parts[0]

    def get_priority(self) -> int:
        """Medium-high priority - JDBC is common for data integration"""
        return 60
