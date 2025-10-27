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
Hex Query Fetcher - Directly queries data warehouses for Hex-originated queries
"""

import re
import traceback
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper, Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import get_table_entities_from_query
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.hex.warehouse_queries import (
    get_hex_query_template,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Pattern to extract Hex metadata from SQL comments
HEX_METADATA_PATTERN = re.compile(
    r'--\s*Hex query metadata:\s*\{.*?"project_id":\s*"([^"]+)".*?"project_url":\s*"https?://[^/]+/([^/]+)/(?:hex|app)/.*?\}',
    re.IGNORECASE,
)


@dataclass
class HexProjectLineage:
    """Lineage information for a Hex project - contains only what's needed for creating lineage"""

    project_id: str
    upstream_tables: List[Table] = field(
        default_factory=list
    )  # Table entities referenced by the project
    _table_ids_seen: set = field(
        default_factory=set, init=False
    )  # Track table IDs to prevent duplicates

    def add_table(self, table: Table) -> None:
        """Add a table if it hasn't been seen before"""
        if table and table.id and table.id.root not in self._table_ids_seen:
            self.upstream_tables.append(table)
            self._table_ids_seen.add(table.id.root)

    def add_tables(self, tables: List[Table]) -> None:
        """Add multiple tables, skipping duplicates"""
        for table in tables:
            self.add_table(table)


class HexQueryFetcher:
    """
    Fetches Hex-originated queries directly from data warehouses
    """

    def __init__(
        self,
        metadata: OpenMetadata,
        lookback_days: int = 7,
        query_limit: int = 1000,
    ):
        """
        Initialize the Hex Query Fetcher

        Args:
            metadata: OpenMetadata client instance
            lookback_days: Number of days to look back for queries
            query_limit: Maximum number of queries to fetch per warehouse
        """
        self.metadata = metadata
        self.lookback_days = lookback_days
        self.query_limit = query_limit

        # Calculate time window
        self.end_time = datetime.now()
        self.start_time = self.end_time - timedelta(days=lookback_days)

        # Cache for project lineage
        self._project_lineage_map: Dict[str, HexProjectLineage] = {}

    def fetch_hex_queries_from_service_prefix(
        self, db_service_prefix: Optional[str] = None
    ) -> Dict[str, HexProjectLineage]:
        """
        Fetch Hex queries from database services matching the prefix

        Args:
            db_service_prefix: Service prefix pattern (e.g., "service", "service.database", etc.)

        Returns:
            Dictionary mapping project IDs to their lineage information
        """
        # Clear previous results for this prefix
        self._project_lineage_map = {}

        # Parse the prefix to understand what we're looking for
        prefix_parts = db_service_prefix.split(".")
        service_name = prefix_parts[0] if prefix_parts else None

        if not service_name:
            logger.info("Invalid service prefix provided")
            return {}

        # Find the database service by exact name
        db_service = self._find_matching_service(service_name)

        if not db_service:
            logger.info(f"No database service found with name: {service_name}")
            return {}

        logger.info(f"Found database service: {service_name}")

        try:
            logger.info(f"Querying {db_service.name.root} for Hex queries...")
            self._fetch_from_single_service(db_service, db_service_prefix)
        except Exception as e:
            logger.error(f"Error fetching Hex queries from {db_service.name.root}: {e}")
            logger.debug(traceback.format_exc())

        return self._project_lineage_map

    def _find_matching_service(self, service_name: str) -> Optional[DatabaseService]:
        """
        Find database service by exact name

        Args:
            service_name: Database service name

        Returns:
            DatabaseService entity if found, None otherwise
        """
        try:
            service = self.metadata.get_by_name(
                entity=DatabaseService, fqn=service_name
            )
            return service
        except Exception as e:
            logger.debug(f"Service not found with name {service_name}: {e}")
            return None

    def _fetch_from_single_service(
        self, db_service: DatabaseService, db_service_prefix: Optional[str] = None
    ):
        """
        Fetch Hex queries from a single database service

        Args:
            db_service: DatabaseService entity
            db_service_prefix: Original prefix for context
        """
        try:
            service_name = db_service.name.root

            # Get the service connection configuration
            service_connection = db_service.connection
            if not service_connection or not service_connection.config:
                logger.warning(
                    f"No connection configuration for service: {service_name}"
                )
                return

            # Extract warehouse type
            warehouse_type = service_connection.config.type.value

            # Try to create connection - this might fail if credentials are encrypted
            try:
                engine = self._create_engine_for_service(service_connection.config)
                if engine:
                    queries = self._execute_hex_query(
                        engine, warehouse_type, service_connection.config
                    )
                    self._process_query_results(
                        queries, service_name, db_service_prefix
                    )
                else:
                    logger.info(
                        f"Could not establish direct connection to {service_name}. "
                        f"This is expected if credentials are encrypted in the metadata store."
                    )
            except Exception as conn_err:
                logger.info(
                    f"Could not create direct connection to {service_name}: {str(conn_err)[:100]}. "
                    f"This is expected behavior when credentials are secured."
                )

        except Exception as e:
            logger.error(f"Error fetching from service {db_service.name.root}: {e}")
            logger.debug(traceback.format_exc())

    def _create_engine_for_service(self, connection_config) -> Optional[Engine]:
        """
        Create SQLAlchemy engine for a database service

        Args:
            connection_config: Service connection configuration

        Returns:
            SQLAlchemy Engine or None if creation fails
        """
        try:
            from metadata.utils.ssl_manager import get_ssl_connection

            # Use get_ssl_connection which handles SSL setup and calls the appropriate get_connection
            # This is the same approach used in LineageSource and QueryParserSource
            return get_ssl_connection(connection_config)

        except Exception as e:
            connection_type = (
                connection_config.type.value if connection_config else "Unknown"
            )
            logger.error(f"Error creating engine for {connection_type}: {e}")
            logger.debug(traceback.format_exc())
            return None

    def _execute_hex_query(
        self, engine: Engine, warehouse_type: str, connection_config
    ) -> List[Dict]:
        """
        Execute Hex-specific query on the warehouse

        Args:
            engine: SQLAlchemy engine
            warehouse_type: Type of warehouse
            connection_config: Connection configuration for warehouse-specific params

        Returns:
            List of query result dictionaries with project_id and query_text
        """
        results = []

        try:
            # Get the query template
            query_template = get_hex_query_template(warehouse_type)

            # Build query parameters
            params = {
                "start_time": self.start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "end_time": self.end_time.strftime("%Y-%m-%d %H:%M:%S"),
                "limit": self.query_limit,
            }

            # Add warehouse-specific parameters
            if warehouse_type.lower() == "snowflake" and isinstance(
                connection_config, SnowflakeConnection
            ):
                params["account_usage"] = (
                    connection_config.accountUsageSchema or "SNOWFLAKE.ACCOUNT_USAGE"
                )

            elif warehouse_type.lower() == "bigquery" and isinstance(
                connection_config, BigQueryConnection
            ):
                params["region"] = connection_config.usageLocation or "US"

            # Format and execute query
            query = query_template.format(**params)
            logger.info(f"Executing Hex query on {warehouse_type}")

            with engine.connect() as conn:
                result = conn.execute(text(query))

                for row in result:
                    # Extract Hex metadata from query text
                    hex_metadata = self._extract_hex_metadata(row[0])
                    if hex_metadata:
                        # Only store what's needed for lineage
                        results.append(
                            {
                                "query_text": row[0],
                                "project_id": hex_metadata["project_id"],
                                "database_name": getattr(row, "database_name", None),
                                "schema_name": getattr(row, "schema_name", None),
                            }
                        )

            logger.info(f"Found {len(results)} Hex queries in {warehouse_type}")

        except Exception as e:
            logger.error(f"Error executing Hex query on {warehouse_type}: {e}")
            logger.debug(traceback.format_exc())

        return results

    def _extract_hex_metadata(self, query_text: str) -> Optional[Dict[str, str]]:
        """
        Extract Hex metadata from query text

        Args:
            query_text: SQL query text containing Hex metadata comment

        Returns:
            Dictionary with project_id and workspace, or None if not found
        """
        if not query_text:
            return None

        match = HEX_METADATA_PATTERN.search(query_text)
        if match:
            try:
                return {
                    "project_id": match.group(1),
                    "workspace": match.group(2),
                }
            except (IndexError, AttributeError):
                pass

        return None

    def _process_query_results(
        self,
        queries: List[Dict],
        service_name: str,
        db_service_prefix: Optional[str] = None,
    ):
        """
        Process query results and extract lineage

        Args:
            queries: List of query result dictionaries
            service_name: Database service name
            db_service_prefix: Original service prefix for context
        """
        for query_data in queries:
            # Extract only what we need: project_id and query_text for parsing
            project_id = query_data.get("project_id")
            query_text = query_data.get("query_text")

            if not project_id or not query_text:
                continue

            # Initialize project lineage if needed
            if project_id not in self._project_lineage_map:
                self._project_lineage_map[project_id] = HexProjectLineage(
                    project_id=project_id
                )

            # Extract upstream tables from query and add them
            try:
                upstream_tables = self._extract_tables_from_query(
                    query_text,
                    service_name,
                    query_data.get("database_name"),
                    query_data.get("schema_name"),
                    db_service_prefix,
                )
                # Add tables using the method that handles duplicates
                self._project_lineage_map[project_id].add_tables(upstream_tables)

            except Exception as e:
                logger.debug(f"Error extracting tables from query: {e}")

    def _extract_tables_from_query(
        self,
        query_text: str,
        service_name: str,
        database_name: Optional[str],
        schema_name: Optional[str],
        db_service_prefix: Optional[str] = None,
    ) -> List[Table]:
        """
        Extract table references from SQL query and resolve to Table entities

        Args:
            query_text: SQL query text
            service_name: Database service name
            database_name: Database name
            schema_name: Schema name
            db_service_prefix: Original service prefix for context

        Returns:
            List of Table entities
        """
        tables = []

        try:
            # Get the dialect for the service
            db_service = self.metadata.get_by_name(
                entity=DatabaseService, fqn=service_name
            )

            dialect = Dialect.ANSI
            if db_service and db_service.connection and db_service.connection.config:
                connection_type = db_service.connection.config.type.value
                dialect = ConnectionTypeDialectMapper.dialect_of(connection_type)

            # Use LineageParser to extract source tables from the query
            try:
                lineage_parser = LineageParser(
                    query=query_text,
                    dialect=dialect,
                    timeout_seconds=10,  # Use a reasonable timeout
                )

                # Get source tables from the parser
                source_tables = lineage_parser.source_tables or []

                for source_table in source_tables:
                    # Parse the table name parts
                    table_str = str(source_table)

                    # Use get_table_entities_from_query to resolve table entities
                    table_entities = get_table_entities_from_query(
                        metadata=self.metadata,
                        service_names=service_name,
                        database_name=database_name or "",
                        database_schema=schema_name or "",
                        table_name=table_str,
                        schema_fallback=True,
                    )

                    if table_entities:
                        # Filter based on prefix constraints if needed
                        for table_entity in table_entities:
                            if self._matches_prefix_constraints(
                                table_entity, db_service_prefix
                            ):
                                tables.append(table_entity)

            except Exception as parser_error:
                logger.debug(
                    f"LineageParser failed, falling back to alternative method: {parser_error}"
                )

        except Exception as e:
            logger.debug(f"Error extracting tables from query: {e}")

        return tables

    def _matches_prefix_constraints(
        self, table: Table, db_service_prefix: Optional[str]
    ) -> bool:
        """
        Check if a table matches the constraints specified in the prefix

        Working:
            Scenario 1: User wants only
            production tables
            db_service_prefix =
            "snowflake.PROD_DB"
            # Will match:
            snowflake.PROD_DB.sales.orders
            # Won't match:
            snowflake.DEV_DB.sales.orders

        Args:
            table: Table entity to check
            db_service_prefix: Service prefix with potential constraints

        Returns:
            True if table matches constraints, False otherwise
        """
        if not db_service_prefix:
            return True

        try:
            prefix_parts = db_service_prefix.split(".")
            table_fqn_parts = table.fullyQualifiedName.root.split(".")

            # Check each part of the prefix against the table FQN
            for i, prefix_part in enumerate(prefix_parts):
                if not prefix_part:  # Skip empty parts
                    continue

                if i >= len(table_fqn_parts):
                    return False

                # For service name (first part), check if it starts with prefix
                if i == 0:
                    if not table_fqn_parts[i].startswith(prefix_part):
                        return False
                # For other parts, check exact match
                else:
                    if table_fqn_parts[i] != prefix_part:
                        return False

            return True

        except Exception as e:
            logger.debug(f"Error checking prefix constraints: {e}")
            return True  # Default to allowing if we can't check
