#  Copyright 2026 OpenMetadata
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
Informix source module.

Why there is no lineage.py or usage.py here
-------------------------------------------
Both capabilities are deliberately left undeclared in informixConnection.json,
which is what stops the UI offering those pipeline types (getSupportedPipelineTypes
keys straight off the supports* fields, so an undeclared one is simply absent).

The raw material does exist: sysmaster:syssqltrace records sql_statement, and at
"medium" tracing also sql_database and sql_tablelist, which is more than most
engines hand you. Measured against 14.10.FC9W1DE, three things make it a project
rather than a file:

  - Tracing is off by default and is enabled per server by a DBA, from the
    sysadmin database -- not something an ingestion user can turn on.
  - It is a fixed-size ring buffer, so an OLTP server overwrites the window a
    usage workflow wants to read.
  - Statement text is truncated to the configured trace size, and truncated SQL
    does not parse.

So a lineage source would work only on servers explicitly configured for it.
Declaring the capability would offer pipelines that fail everywhere else, which
is worse than not offering them. Re-declare the two fields in the schema when a
source lands.
"""

import traceback
from collections import OrderedDict
from collections.abc import Iterable
from typing import NamedTuple

from sqlalchemy import BLOB, CLOB, TEXT, Interval, LargeBinary, text

from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import (
    Language,
    StoredProcedureCode,
)
from metadata.generated.schema.entity.services.connections.database.informixConnection import (
    InformixConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import EntityName
from metadata.ingestion.api.models import Either, StackTraceError
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.informix.queries import (
    INFORMIX_GET_COLUMN_TYPES,
    INFORMIX_GET_DATABASE_NAMES,
    INFORMIX_GET_STORED_PROCEDURE_DEFINITION,
    INFORMIX_GET_STORED_PROCEDURES,
)
from metadata.ingestion.source.database.multi_db_source import MultiDBSource
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

COLTYPE_CHAR = 0
COLTYPE_BYTE = 11
COLTYPE_TEXT = 12
COLTYPE_VARCHAR = 13
COLTYPE_INTERVAL = 14
COLTYPE_NCHAR = 15
COLTYPE_NVARCHAR = 16
COLTYPE_LVARCHAR = 40
COLTYPE_OPAQUE = 41

# VARCHAR and NVARCHAR pack an optional reserved minimum into collength's high
# byte; the other three are the plain width and are the only ones that may
# exceed 255, so masking them would silently truncate a CHAR(300) to 44.
MASKED_LENGTH_COLTYPES = frozenset({COLTYPE_VARCHAR, COLTYPE_NVARCHAR})
PLAIN_LENGTH_COLTYPES = frozenset({COLTYPE_CHAR, COLTYPE_NCHAR, COLTYPE_LVARCHAR})

# The SQLAlchemy type here is what ColumnTypeParser converts into an OM DataType:
# LargeBinary -> BYTES, TEXT -> TEXT, CLOB -> CLOB, BLOB -> BLOB. Those are exactly
# the types is_blob() recognises, which is how the profiler learns to skip them.
# The second element becomes dataTypeDisplay, so the UI shows the native name.
LOB_TYPES_BY_COLTYPE = {
    COLTYPE_BYTE: (LargeBinary, "BYTE"),
    COLTYPE_TEXT: (TEXT, "TEXT"),
}
LOB_TYPES_BY_SUBTYPE = {
    "clob": (CLOB, "CLOB"),
    "blob": (BLOB, "BLOB"),
}

# collength packs an INTERVAL's qualifier into its low byte, one nibble per end.
INTERVAL_UNITS = {0: "YEAR", 2: "MONTH", 4: "DAY", 6: "HOUR", 8: "MINUTE", 10: "SECOND"}


def interval_display(collength: int) -> str:
    """Name an INTERVAL column's type the way its DDL did, e.g. INTERVAL HOUR TO MINUTE."""

    def unit(code: int) -> str:
        return INTERVAL_UNITS.get(code) or f"FRACTION({code - 10})"

    return f"INTERVAL {unit(collength // 16 % 16)} TO {unit(collength % 16)}"


class InformixStoredProcedure(NamedTuple):
    """A routine a user wrote, as sysprocedures reports it."""

    name: str
    proc_id: int
    is_function: bool


class ColumnOverride(NamedTuple):
    """What the catalogue knows that the JDBC driver did not report.

    Either a replacement type (large objects) or a declared width (strings);
    never both, since the large-object types carry no meaningful width.
    """

    sqa_type: type | None
    display_name: str | None
    length: int | None


# One entry per (database, schema), bounded so a server with many databases
# cannot grow it without limit.
MAX_CACHED_SCHEMAS = 64


class InformixSource(CommonDbSourceService, MultiDBSource):
    """
    Implements the necessary methods to extract Database metadata from Informix.

    Table, view, column and stored-procedure reflection all come from the JDBC
    DatabaseMetaData API via the dialect, so this class only has to supply what
    is genuinely Informix-shaped: enumerating the databases on the server.
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata) -> None:
        super().__init__(config, metadata)
        self._column_overrides_cache: OrderedDict[tuple[str, str], dict[tuple[str, str], ColumnOverride]] = (
            OrderedDict()
        )

    @classmethod
    def create(cls, config_dict: dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        service_conn = config.serviceConnection
        connection = service_conn.root.config if service_conn is not None else None
        if not isinstance(connection, InformixConnection):
            raise InvalidSourceException(f"Expected InformixConnection, but got {connection}")
        return cls(config, metadata)

    def get_configured_database(self) -> str | None:
        return self.service_connection.database

    def get_database_names_raw(self) -> Iterable[str]:
        yield from self._execute_database_query(INFORMIX_GET_DATABASE_NAMES)

    def get_database_names(self) -> Iterable[str]:
        """
        Yield the databases to ingest, re-pointing the inspector at each one.

        An Informix JDBC connection is bound to a single database, so crossing to
        another means rebuilding the engine -- which is what set_inspector does.
        """
        if not self.service_connection.ingestAllDatabases:
            configured_db = self.service_connection.database
            self.set_inspector(database_name=configured_db)
            yield configured_db
            return

        for new_database in self.get_database_names_raw():
            database_fqn = fqn.build(
                self.metadata,
                entity_type=Database,
                service_name=self.context.get().database_service,
                database_name=new_database,
            )

            if filter_by_database(
                self.source_config.databaseFilterPattern,
                (database_fqn if self.source_config.useFqnForFiltering else new_database),
            ):
                self.status.filter(database_fqn, "Database Filtered Out")
                continue

            try:
                self.set_inspector(database_name=new_database)
                yield new_database
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(f"Error trying to connect to database {new_database}: {exc}")

    @staticmethod
    def _declared_length(basetype: int, collength: int | None) -> int | None:
        """The width the DDL declared, or None if this type does not carry one."""
        if collength is None:
            return None
        if basetype in MASKED_LENGTH_COLTYPES:
            return collength % 256
        if basetype in PLAIN_LENGTH_COLTYPES:
            return collength
        return None

    def _column_overrides(self, db_name: str, schema_name: str) -> dict[tuple[str, str], ColumnOverride]:
        """Map (table, column) to what the JDBC driver got wrong, for one schema.

        Queried per schema rather than per table: a wide catalogue costs one
        round trip per schema instead of one per table.

        Keyed by database as well, because the schema name alone does not
        identify one: nearly every Informix database owns its tables as
        "informix", so ingesting a server-full of them would otherwise answer
        every database with the first one's columns.
        """
        cache_key = (db_name, schema_name)
        cached = self._column_overrides_cache.get(cache_key)
        if cached is not None:
            self._column_overrides_cache.move_to_end(cache_key)
            return cached

        found: dict[tuple[str, str], ColumnOverride] = {}
        try:
            rows = self.connection.execute(text(INFORMIX_GET_COLUMN_TYPES), {"owner": schema_name}).fetchall()
        except Exception as exc:
            # Reflection still works without this; the columns just keep the
            # VARCHAR the driver reported, so degrade rather than fail the run.
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not read column types for schema {schema_name}: {exc}")
            rows = []

        for tabname, colname, basetype, collength, xtype in rows:
            mapped = LOB_TYPES_BY_COLTYPE.get(basetype)
            if mapped is None and basetype == COLTYPE_OPAQUE:
                # 41 is also BOOLEAN and every other opaque type; only the named
                # smart large objects belong here.
                mapped = LOB_TYPES_BY_SUBTYPE.get((xtype or "").lower())
            if mapped is None and basetype == COLTYPE_INTERVAL:
                # The driver reports INTERVAL as CHAR, and LENGTH() -- which the
                # profiler then sends -- is ambiguous on an INTERVAL.
                mapped = (Interval, interval_display(collength))
            sqa_type, display = mapped if mapped else (None, None)
            length = None if mapped else self._declared_length(basetype, collength)
            if sqa_type is not None or length is not None:
                found[(tabname, colname)] = ColumnOverride(sqa_type, display, length)

        self._column_overrides_cache[cache_key] = found
        while len(self._column_overrides_cache) > MAX_CACHED_SCHEMAS:
            self._column_overrides_cache.popitem(last=False)
        return found

    def get_stored_procedures(self) -> Iterable[InformixStoredProcedure]:
        """The routines someone actually wrote.

        A stock Informix database carries roughly 560 built-in routines in
        sysprocedures, so an unfiltered listing buries the handful that belong to
        the user. Case in the mode column separates them -- user routines are
        upper case, Informix's own are lower.
        """
        if not self.source_config.includeStoredProcedures:
            return
        schema_name = self.context.get().database_schema
        with self.engine.connect() as conn:
            rows = conn.execute(text(INFORMIX_GET_STORED_PROCEDURES), {"owner": schema_name}).fetchall()
        for name, is_proc, proc_id in rows:
            yield InformixStoredProcedure(name=name, proc_id=proc_id, is_function=is_proc != "t")

    def _stored_procedure_code(self, proc_id: int) -> str | None:
        """Reassemble a routine's text, which sysprocbody stores in fragments."""
        try:
            with self.engine.connect() as conn:
                rows = conn.execute(text(INFORMIX_GET_STORED_PROCEDURE_DEFINITION), {"proc_id": proc_id}).fetchall()
            return "".join(row[0] for row in rows if row[0]) or None
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not read the body of stored procedure {proc_id}: {exc}")
            return None

    def yield_stored_procedure(
        self, stored_procedure: InformixStoredProcedure
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Prepare the stored procedure payload."""
        try:
            yield Either(
                right=CreateStoredProcedureRequest(
                    name=EntityName(stored_procedure.name),
                    storedProcedureCode=StoredProcedureCode(
                        language=Language.SQL,
                        code=self._stored_procedure_code(stored_procedure.proc_id),
                    ),
                    databaseSchema=fqn.build(
                        metadata=self.metadata,
                        entity_type=DatabaseSchema,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                        schema_name=self.context.get().database_schema,
                    ),
                )
            )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=stored_procedure.name,
                    error=f"Error yielding Stored Procedure [{stored_procedure.name}] due to [{exc}]",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _get_columns_internal(
        self,
        schema_name: str,
        table_name: str,
        db_name: str,
        inspector,
        table_type=None,
    ):
        """Restore what the JDBC driver drops: large-object and INTERVAL types, and string widths.

        Informix reports BYTE, TEXT, CLOB and BLOB all as VARCHAR(2147483647), so
        a column of scanned documents is otherwise catalogued as ordinary text and
        the profiler then tries to aggregate over it and is rejected. The driver
        also reports no length for CHAR/VARCHAR/LVARCHAR, which OpenMetadata reads
        as 1 -- every string column in the catalogue claiming to hold one byte.
        """
        columns = super()._get_columns_internal(schema_name, table_name, db_name, inspector, table_type)
        overrides = self._column_overrides(db_name, schema_name)
        if not overrides:
            return columns

        for column in columns:
            override = overrides.get((table_name, column["name"]))
            if override is None:
                continue
            if override.sqa_type is not None:
                column["type"] = override.sqa_type()
                column["system_data_type"] = override.display_name
                logger.debug(f"{table_name}.{column['name']} corrected to {override.display_name}")
            elif override.length is not None:
                # Mutated rather than rebuilt so the reflected type keeps whatever
                # else it carries (collation, charset).
                column["type"].length = override.length

        return columns
