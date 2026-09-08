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
Read metadata of Redshift databases created from a datashare.

A consumer cluster lists datashare databases in ``pg_database``, but the server
refuses a direct connection to them::

    FATAL: Cannot connect to shared database "<db>" created from Data Catalog ARN.

Their metadata is only reachable through the cross-database ``SVV_ALL_*``
catalog views, which are queried from the connection to a local database.
"""

from collections import defaultdict
from collections.abc import Callable
from contextlib import suppress
from typing import Any

from sqlalchemy.engine import Connection
from sqlalchemy.sql import text

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.source.database.redshift.models import RedshiftDatashareTable
from metadata.ingestion.source.database.redshift.queries import (
    REDSHIFT_GET_DATABASE_TYPES,
    REDSHIFT_GET_DATASHARE_SCHEMA_COLUMN_INFO,
    REDSHIFT_GET_DATASHARE_TABLES,
    REDSHIFT_GET_SCHEMAS_FOR_DATABASE,
    REDSHIFT_SHOW_DATABASES,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Every other `database_type` - `shared`, `auto mounted catalog` - is a database
# the cluster does not hold locally and therefore may refuse a connection to.
LOCAL_DATABASE_TYPE = "local"


def _table_type(raw_table_type: str | None) -> TableType:
    """``SVV_ALL_TABLES.table_type`` is free-form text whose casing and wording
    differ between local, shared and external tables (``TABLE``, ``base table``,
    ``SHARED TABLE``, ``EXTERNAL TABLE``, ``view``, ...)."""
    value = (raw_table_type or "").strip().lower()
    if "view" in value:
        return TableType.View
    if "external" in value:
        return TableType.External
    return TableType.Regular


def build_columns(dialect: Any, rows: list[Any]) -> list[dict]:
    """Turn catalog rows into the column dictionaries the source consumes.

    The rows already carry the reflected shape, so this is the same construction
    the dialect performs for a connected database - which is the point: the type
    handling lives in one place instead of being reimplemented per source.

    Domains are deliberately empty. They would have to come from the connection,
    which points at a different database than the one being read.
    """
    columns = []
    for row in rows:
        column_info = dialect._get_column_info(  # pylint: disable=protected-access
            name=row.name,
            format_type=row.format_type,
            default=row.default,
            notnull=row.notnull,
            domains={},
            enums=[],
            schema=row.schema,
            encode=row.encode,
            comment=row.comment,
        )
        # A type the dialect cannot resolve comes back as the class itself rather
        # than an instance. The raw spelling is more use to the column type parser
        # than an unusable class - that is how `array<struct<...>>` stays an ARRAY
        # instead of degrading to UNKNOWN.
        if isinstance(column_info["type"], type):
            column_info["type"] = row.format_type
        column_info["distkey"] = row.distkey
        column_info["sortkey"] = row.sortkey
        column_info["ordinal_position"] = row.attnum
        column_info["system_data_type"] = row.format_type
        columns.append(column_info)
    return columns


class RedshiftDatashareCatalog:
    """Cross-database reader for datashare databases.

    Every query runs on the caller's current connection - which always points at a
    local, connectable database - and is scoped to the datashare database by name.
    """

    def __init__(self, connection_provider: Callable[[], Connection]) -> None:
        self._connection_provider = connection_provider
        self._database_types: dict[str, str] | None = None
        self._fetched_database_types = False
        self._schema_columns: tuple[tuple[str, str], dict[str, list]] | None = None

    @property
    def database_types(self) -> dict[str, str] | None:
        """``{database_name: database_type}`` for every database the cluster
        reports, or None when neither source can be read.

        ``SHOW DATABASES`` answers both "which databases are there" and "which of
        them are local" in one call, so the walk does not need a separate
        enumeration. It is also the only source that reports a catalog database
        mounted from Glue, and unlike ``pg_database`` it omits the system
        databases. ``SVV_REDSHIFT_DATABASES`` is the fallback for clusters that
        predate it; it sees only datashares from remote clusters.
        """
        if not self._fetched_database_types:
            self._fetched_database_types = True
            self._database_types = self._fetch_database_types()
        return self._database_types

    def _fetch_database_types(self) -> dict[str, str] | None:
        for query, source in (
            (REDSHIFT_SHOW_DATABASES, "SHOW DATABASES"),
            (REDSHIFT_GET_DATABASE_TYPES, "SVV_REDSHIFT_DATABASES"),
        ):
            connection = self._connection_provider()
            try:
                rows = connection.execute(text(query)).fetchall()
            except Exception as exc:  # pylint: disable=broad-except
                logger.warning("%s unavailable (%s); trying the next source.", source, exc)
                # A failed statement leaves the transaction aborted, so without
                # this the fallback - and every later query on this connection -
                # fails with "current transaction is aborted" rather than with
                # anything that explains itself.
                with suppress(Exception):
                    connection.rollback()
                continue
            return {
                str(row.database_name): str(row.database_type or "").strip().lower()
                for row in rows
                if row.database_name is not None
            }
        logger.warning("Could not classify databases; those that refuse a connection will be skipped.")
        return None

    @property
    def shared_database_names(self) -> set[str]:
        """Databases the cluster does not hold locally, and so may refuse a
        connection to. Empty when nothing could be classified, which leaves the
        caller with the plain connection error it would have raised anyway."""
        # A missing type reads as local: only a type the cluster positively
        # reports as something else is worth attempting the catalog views for.
        return {
            name
            for name, database_type in (self.database_types or {}).items()
            if database_type and database_type != LOCAL_DATABASE_TYPE
        }

    def get_schema_names(self, database_name: str) -> list[str]:
        rows = self._connection_provider().execute(text(REDSHIFT_GET_SCHEMAS_FOR_DATABASE), {"database": database_name})
        return [str(row.schema_name) for row in rows if row.schema_name is not None]

    def get_tables(self, database_name: str, schema_name: str) -> list[RedshiftDatashareTable]:
        rows = self._connection_provider().execute(
            text(REDSHIFT_GET_DATASHARE_TABLES),
            {"database": database_name, "schema": schema_name},
        )
        return [
            RedshiftDatashareTable(
                name=str(row.table_name),
                table_type=_table_type(row.table_type),
                remarks=row.remarks,
            )
            for row in rows
            if row.table_name is not None
        ]

    def get_schema_column_info(self, database_name: str, schema_name: str) -> dict[str, list]:
        """``{table_name: [column rows]}`` for one schema, in the shape reflection
        returns.

        One query per schema rather than per table, matching the connected path -
        which matters more here, since every row crosses a database boundary.
        Only the most recent schema is held, the same single-schema cache the
        dialect keeps, so walking many schemas does not accumulate.
        """
        key = (database_name, schema_name)
        if self._schema_columns is not None and self._schema_columns[0] == key:
            return self._schema_columns[1]
        rows = self._connection_provider().execute(
            text(REDSHIFT_GET_DATASHARE_SCHEMA_COLUMN_INFO),
            {"database": database_name, "schema": schema_name},
        )
        by_table: dict[str, list] = defaultdict(list)
        for row in rows:
            by_table[str(row.table_name)].append(row)
        self._schema_columns = (key, dict(by_table))
        return self._schema_columns[1]
