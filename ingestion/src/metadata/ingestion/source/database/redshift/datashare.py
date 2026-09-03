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

from collections.abc import Callable

from sqlalchemy.engine import Connection
from sqlalchemy.sql import sqltypes, text

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.source.database.redshift.models import RedshiftDatashareTable
from metadata.ingestion.source.database.redshift.queries import (
    REDSHIFT_GET_DATASHARE_COLUMNS,
    REDSHIFT_GET_DATASHARE_SCHEMAS,
    REDSHIFT_GET_DATASHARE_TABLES,
    REDSHIFT_GET_SHARED_DATABASE_NAMES,
)
from metadata.ingestion.source.database.redshift.utils import ischema_names
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Data types whose (precision, scale) is meaningful. Every numeric type reports
# a precision in SVV_ALL_COLUMNS - `integer` comes back as precision 32, scale 0 -
# so rendering it for anything else would produce `integer(32,0)`.
SCALED_NUMERIC_TYPES = {"numeric", "decimal"}


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


def _system_data_type(
    data_type: str,
    character_maximum_length: int | None,
    numeric_precision: int | None,
    numeric_scale: int | None,
) -> str:
    """Rebuild the type as the source would spell it, e.g. ``character varying(64)``.
    The connected path takes this from ``format_type``, which is not available
    across databases."""
    if character_maximum_length is not None:
        return f"{data_type}({character_maximum_length})"
    if numeric_precision is not None and data_type.strip().lower() in SCALED_NUMERIC_TYPES:
        return f"{data_type}({numeric_precision},{numeric_scale or 0})"
    return data_type


def _column_type(
    data_type: str,
    character_maximum_length: int | None,
    numeric_precision: int | None,
    numeric_scale: int | None,
) -> object:
    """SQLAlchemy type for a catalog data type, so that length and precision reach
    the Column entity the same way reflection delivers them. ``ischema_names`` is
    the same mapping reflection resolves against, so shared and local tables end up
    with the same types. A type missing from it falls back to the raw name, which
    the column type parser still maps."""
    type_class = ischema_names.get(data_type.strip().lower())
    if not isinstance(type_class, type):
        return data_type
    try:
        if character_maximum_length is not None and issubclass(type_class, sqltypes.String):
            return type_class(length=character_maximum_length)
        if numeric_precision is not None and data_type.strip().lower() in SCALED_NUMERIC_TYPES:
            return type_class(precision=numeric_precision, scale=numeric_scale)
        return type_class()
    except TypeError:
        logger.debug("Could not instantiate %s for data type [%s]", type_class, data_type)
        return data_type


class RedshiftDatashareCatalog:
    """Cross-database reader for datashare databases.

    Every query runs on the caller's current connection - which always points at a
    local, connectable database - and is scoped to the datashare database by name.
    """

    def __init__(self, connection_provider: Callable[[], Connection]) -> None:
        self._connection_provider = connection_provider
        self._shared_database_names: set[str] | None = None

    @property
    def shared_database_names(self) -> set[str]:
        """Databases the cluster reports as coming from a datashare. Empty when
        ``SVV_REDSHIFT_DATABASES`` is not readable, which leaves the caller with
        the plain connection error it would have raised anyway."""
        if self._shared_database_names is None:
            try:
                rows = self._connection_provider().execute(text(REDSHIFT_GET_SHARED_DATABASE_NAMES)).fetchall()
                self._shared_database_names = {str(row[0]) for row in rows if row[0] is not None}
            except Exception as exc:  # pylint: disable=broad-except
                logger.warning("SVV_REDSHIFT_DATABASES unavailable (%s); datashare databases will be skipped.", exc)
                self._shared_database_names = set()
        return self._shared_database_names

    def get_schema_names(self, database_name: str) -> list[str]:
        rows = self._connection_provider().execute(text(REDSHIFT_GET_DATASHARE_SCHEMAS), {"database": database_name})
        return [str(row[0]) for row in rows if row[0] is not None]

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

    def get_columns(self, database_name: str, schema_name: str, table_name: str) -> list[dict]:
        """Column dictionaries shaped like the ones the Redshift dialect returns
        from reflection, so that the shared column handling applies unchanged."""
        rows = self._connection_provider().execute(
            text(REDSHIFT_GET_DATASHARE_COLUMNS),
            {"database": database_name, "schema": schema_name, "table": table_name},
        )
        columns = []
        for row in rows:
            data_type = str(row.data_type or "")
            columns.append(
                {
                    "name": row.column_name,
                    "type": _column_type(
                        data_type,
                        row.character_maximum_length,
                        row.numeric_precision,
                        row.numeric_scale,
                    ),
                    "system_data_type": _system_data_type(
                        data_type,
                        row.character_maximum_length,
                        row.numeric_precision,
                        row.numeric_scale,
                    ),
                    "nullable": str(row.is_nullable or "").strip().lower() == "yes",
                    "default": row.column_default,
                    "comment": row.remarks,
                    "ordinal_position": row.ordinal_position,
                }
            )
        return columns
