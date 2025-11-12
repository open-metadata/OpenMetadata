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
SQLGlot-based SQL Lineage Parser

Provides column-level lineage extraction using SQLGlot's native lineage module.
"""
from typing import List, Optional, Set, Tuple

try:
    import sqlglot
    from sqlglot import exp, lineage

    SQLGLOT_AVAILABLE = True
except ImportError:
    SQLGLOT_AVAILABLE = False

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class Column:
    """Column representation compatible with collate-sqllineage format."""

    def __init__(self, name: str, parent_name: Optional[str] = None):
        self.raw_name = name
        self._parent_name = parent_name

    def __str__(self):
        if self._parent_name:
            return f"{self._parent_name}.{self.raw_name}"
        return self.raw_name

    def __repr__(self):
        return f"Column({self.raw_name}, parent={self._parent_name})"

    def __eq__(self, other):
        if isinstance(other, Column):
            return (
                self.raw_name == other.raw_name
                and self._parent_name == other._parent_name
            )
        return False

    def __hash__(self):
        return hash((self.raw_name, self._parent_name))


class Table:
    """Table representation compatible with collate-sqllineage format."""

    def __init__(self, name: str):
        self.raw_name = name

    def __str__(self):
        return self.raw_name

    def __repr__(self):
        return f"Table({self.raw_name})"

    def __eq__(self, other):
        if isinstance(other, Table):
            return self.raw_name == other.raw_name
        return False

    def __hash__(self):
        return hash(self.raw_name)


class SQLGlotLineageRunner:
    """
    SQLGlot-based lineage runner that mimics collate-sqllineage's LineageRunner interface.

    This class provides a drop-in replacement for LineageRunner using SQLGlot's
    more accurate and faster parsing engine.
    """

    def __init__(
        self, query: str, dialect: Optional[str] = None, schema: Optional[dict] = None
    ):
        """
        Initialize SQLGlot lineage runner.

        Args:
            query: SQL query to parse
            dialect: SQL dialect (snowflake, bigquery, postgres, etc.)
            schema: Optional table schema dictionary for better accuracy
                   Format: {"table_name": {"col1": "INT", "col2": "STRING"}}
        """
        if not SQLGLOT_AVAILABLE:
            raise ImportError(
                "sqlglot is not installed. Install it with: pip install sqlglot"
            )

        self.query = query
        self.dialect = dialect or "ansi"
        self.schema = schema
        self._parsed = None
        self._column_lineage_cache = None
        self._source_tables_cache = None
        self._target_tables_cache = None

        try:
            self._parsed = sqlglot.parse_one(query, dialect=self.dialect)
        except Exception as e:
            logger.debug(f"Failed to parse query with SQLGlot: {e}")
            self._parsed = None

    def get_column_lineage(self) -> List[Tuple[Column, Column]]:
        """
        Extract column-level lineage from the query.

        Returns:
            List of (source_column, target_column) tuples
        """
        if self._column_lineage_cache is not None:
            return self._column_lineage_cache

        if not self._parsed:
            self._column_lineage_cache = []
            return self._column_lineage_cache

        lineage_edges = []

        try:
            # Get target columns from SELECT/INSERT
            target_columns = self._get_target_columns()
            source_tables_map = self._get_source_tables_map()

            # Extract lineage for each target column
            for target_col in target_columns:
                if target_col == "*":
                    continue

                try:
                    # Use SQLGlot's lineage module
                    node = lineage.lineage(
                        column=target_col,
                        sql=self.query,
                        schema=self.schema,
                        dialect=self.dialect,
                    )

                    if node and node.downstream:
                        for downstream in node.downstream:
                            source_col_name = str(downstream.name)
                            source_table_name = self._extract_table_from_node(
                                downstream, source_tables_map
                            )

                            lineage_edges.append(
                                (
                                    Column(source_col_name, source_table_name),
                                    Column(target_col, None),
                                )
                            )
                except Exception as e:
                    logger.debug(
                        f"Failed to extract lineage for column {target_col}: {e}"
                    )
                    continue

        except Exception as e:
            logger.debug(f"Failed to extract column lineage: {e}")

        self._column_lineage_cache = lineage_edges
        return lineage_edges

    def _get_target_columns(self) -> Set[str]:
        """Extract target columns from SELECT/INSERT statement."""
        columns = set()

        try:
            # Find all SELECT statements
            for select in self._parsed.find_all(exp.Select):
                for col_expr in select.expressions:
                    if isinstance(col_expr, exp.Alias):
                        columns.add(col_expr.alias)
                    elif isinstance(col_expr, exp.Column):
                        columns.add(col_expr.name)
                    elif isinstance(col_expr, exp.Star):
                        columns.add("*")

            # For INSERT statements, get target columns
            for insert in self._parsed.find_all(exp.Insert):
                if insert.this and isinstance(insert.this, exp.Schema):
                    for col in insert.this.expressions:
                        if isinstance(col, exp.Column):
                            columns.add(col.name)

        except Exception as e:
            logger.debug(f"Failed to extract target columns: {e}")

        return columns

    def _get_source_tables_map(self) -> dict:
        """Get mapping of table aliases to full table names."""
        tables_map = {}

        try:
            for table_expr in self._parsed.find_all(exp.Table):
                table_name = self._get_table_name(table_expr)
                alias = table_expr.alias if hasattr(table_expr, "alias") else None

                if alias:
                    tables_map[alias] = table_name
                tables_map[table_name] = table_name

        except Exception as e:
            logger.debug(f"Failed to build source tables map: {e}")

        return tables_map

    def _extract_table_from_node(self, node, source_tables_map: dict) -> Optional[str]:
        """Extract table name from lineage node."""
        try:
            if hasattr(node, "source") and node.source:
                source_str = str(node.source)
                # Try to match with known tables
                for alias, table_name in source_tables_map.items():
                    if alias in source_str:
                        return table_name
                return source_str
        except Exception:
            pass
        return None

    @property
    def source_tables(self) -> Set[Table]:
        """Get source tables from the query."""
        if self._source_tables_cache is not None:
            return self._source_tables_cache

        tables = set()

        if not self._parsed:
            self._source_tables_cache = tables
            return tables

        try:
            # Get all table references
            for table_expr in self._parsed.find_all(exp.Table):
                table_name = self._get_table_name(table_expr)
                tables.add(Table(table_name))

        except Exception as e:
            logger.debug(f"Failed to extract source tables: {e}")

        self._source_tables_cache = tables
        return tables

    @property
    def target_tables(self) -> Set[Table]:
        """Get target tables from INSERT/UPDATE/DELETE/MERGE."""
        if self._target_tables_cache is not None:
            return self._target_tables_cache

        tables = set()

        if not self._parsed:
            self._target_tables_cache = tables
            return tables

        try:
            # Check for INSERT
            for insert in self._parsed.find_all(exp.Insert):
                if insert.this and isinstance(insert.this, exp.Table):
                    table_name = self._get_table_name(insert.this)
                    tables.add(Table(table_name))

            # Check for UPDATE
            for update in self._parsed.find_all(exp.Update):
                if update.this and isinstance(update.this, exp.Table):
                    table_name = self._get_table_name(update.this)
                    tables.add(Table(table_name))

            # Check for DELETE
            for delete in self._parsed.find_all(exp.Delete):
                if delete.this and isinstance(delete.this, exp.Table):
                    table_name = self._get_table_name(delete.this)
                    tables.add(Table(table_name))

            # Check for MERGE
            for merge in self._parsed.find_all(exp.Merge):
                if merge.this and isinstance(merge.this, exp.Table):
                    table_name = self._get_table_name(merge.this)
                    tables.add(Table(table_name))

        except Exception as e:
            logger.debug(f"Failed to extract target tables: {e}")

        self._target_tables_cache = tables
        return tables

    @property
    def intermediate_tables(self) -> Set[Table]:
        """Get intermediate tables (CTEs, subqueries)."""
        # SQLGlot handles CTEs internally, return empty set for compatibility
        return set()

    def _get_table_name(self, table_expr: exp.Table) -> str:
        """Extract full table name from table expression."""
        parts = []

        if table_expr.catalog:
            parts.append(str(table_expr.catalog))
        if table_expr.db:
            parts.append(str(table_expr.db))
        parts.append(str(table_expr.this))

        return ".".join(parts)
