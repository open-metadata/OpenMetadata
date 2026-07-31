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
Incremental Processor for Unity Catalog.

Detects, for a single catalog and since a given watermark:
  - changed tables, via `information_schema.tables.last_altered`
  - deleted tables, via the `system.access.audit` `deleteTable` events

Both queries degrade gracefully: a failure on either leaves that map empty and
logs a warning so the rest of the ingestion can proceed (e.g. when the
`system.access` schema is not enabled).
"""

import re
import traceback
from typing import Any, Callable, Dict, Optional, Set, Tuple  # noqa: UP035

from sqlalchemy.engine import Connection
from sqlalchemy.sql import text

from metadata.ingestion.source.database.unitycatalog.queries import (
    UNITY_CATALOG_GET_CHANGED_TABLES,
    UNITY_CATALOG_GET_DELETED_TABLES,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

SchemaToTables = Dict[str, Set[str]]  # noqa: UP006

VALID_CATALOG_NAME = re.compile(r"^[A-Za-z0-9_]+$")


class UnityCatalogIncrementalTableProcessor:
    """Prepares the data needed for Unity Catalog incremental metadata extraction."""

    def __init__(self, connection: Connection):
        self.connection = connection
        self._changed_map: SchemaToTables = {}
        self._deleted_map: SchemaToTables = {}

    @classmethod
    def create(cls, connection: Connection) -> "UnityCatalogIncrementalTableProcessor":
        return cls(connection)

    def set_table_map(self, catalog: str, start_timestamp: int) -> None:
        """Populate the changed and deleted table maps for a single catalog.

        The catalog name is interpolated into SQL, so it is validated against an
        allowlist first. An unexpected name skips incremental detection (the maps
        stay empty) rather than risking an injected query.
        """
        self._changed_map = {}
        self._deleted_map = {}
        if not VALID_CATALOG_NAME.match(catalog):
            logger.warning(
                "Catalog name [%s] is not a simple identifier; skipping incremental change/delete detection for it.",
                catalog,
            )
            return
        self._changed_map = self._run(
            UNITY_CATALOG_GET_CHANGED_TABLES,
            catalog,
            start_timestamp,
            row_to_schema_table=lambda row: (row[0], row[1]),
            context="changed tables (information_schema)",
        )
        self._deleted_map = self._run(
            UNITY_CATALOG_GET_DELETED_TABLES,
            catalog,
            start_timestamp,
            row_to_schema_table=lambda row: self._split_full_name(row[0]),
            context="deleted tables (system.access.audit)",
        )

    def _run(
        self,
        query: str,
        catalog: str,
        start_timestamp: int,
        row_to_schema_table: Callable[[Any], Optional[Tuple[str, str]]],  # noqa: UP006, UP045
        context: str,
    ) -> SchemaToTables:
        """Execute a query and bucket its rows into a {schema: {table, ...}} map.

        On any failure (e.g. the system schema is not enabled), warn and return
        an empty map so the ingestion can continue without delete/change data.
        """
        table_map: SchemaToTables = {}
        try:
            rows = self.connection.execute(text(query.format(catalog=catalog, start_timestamp=start_timestamp)))
            for row in rows or []:
                schema_table = row_to_schema_table(row)
                if schema_table:
                    schema, table = schema_table
                    table_map.setdefault(schema, set()).add(table)
        except Exception as exc:
            logger.warning(
                "Could not query %s for catalog [%s]; incremental detection for this source will be skipped: %s",
                context,
                catalog,
                exc,
            )
            logger.debug(traceback.format_exc())
        return table_map

    @staticmethod
    def _split_full_name(full_name: Optional[str]) -> Optional[Tuple[str, str]]:  # noqa: UP045, UP006
        """Split a `catalog.schema.table` name into its (schema, table) parts."""
        result = None
        if full_name and full_name.count(".") == 2:
            _, schema, table = full_name.split(".")
            result = (schema, table)
        return result

    def get_changed(self, schema_name: str) -> Set[str]:  # noqa: UP006
        """Return the names of tables changed since the watermark for a schema."""
        return self._changed_map.get(schema_name, set())

    def get_deleted(self, schema_name: str) -> Set[str]:  # noqa: UP006
        """Return the names of tables deleted since the watermark for a schema."""
        return self._deleted_map.get(schema_name, set())
