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
Clickhouse lineage module

Implements two lineage features on top of the standard query-log lineage:

1. **Cross-Database Lineage** – mirrors tables that exist in a configured
   external service (e.g. Postgres) with the same name/column set into a
   ``CrossDatabaseLineage`` edge.  Pattern copied from the Trino connector.

2. **Dictionary Lineage** – reads ``system.dictionaries`` for all ``LOADED``
   dictionaries whose ``SOURCE()`` clause points at another ClickHouse table
   and emits a ``ViewLineage`` edge from that source table to the dictionary
   entity (which is already ingested as ``TableType.External`` by metadata.py).
"""

import re
import traceback
from typing import Dict, Iterable, List, Optional, Union

from sqlalchemy import text

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.type.basic import Uuid
from metadata.generated.schema.type.entityLineage import (
    EntitiesEdge,
    LineageDetails,
    Source,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.database.clickhouse.queries import (
    CLICKHOUSE_DICTIONARY_LINEAGE,
    CLICKHOUSE_SQL_STATEMENT,
)
from metadata.ingestion.source.database.clickhouse.query_parser import (
    ClickhouseQueryParserSource,
)
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


# ---------------------------------------------------------------------------
# Module-level helper: Dictionary source parser
# ---------------------------------------------------------------------------


def _parse_clickhouse_dict_source(source_str: str) -> Optional[tuple]:
    """Parse the ``source`` column from ``system.dictionaries`` and extract
    the backing ClickHouse database and table names.

    Clickhouse serialises the SOURCE() clause of a dictionary into a
    human-readable string stored in ``system.dictionaries.source``.
    For a ClickHouse-native source the format is::

        ClickHouse: host: localhost, port: 9000, user: default, db: mydb, table: orders

    Key properties of the format:
    - The string always starts with ``"ClickHouse:"`` (case-insensitive match
      added for safety).
    - Fields are separated by commas; each field is ``key: value``.
    - We only care about ``db`` and ``table``.

    Returns:
        ``(db_name, table_name)`` tuple if this is a ClickHouse-native source
        and both fields are present, otherwise ``None``.
    """
    if not source_str:
        return None

    # Only process ClickHouse-native sources; skip MySQL, PostgreSQL, Kafka, …
    if not source_str.strip().lower().startswith("clickhouse:"):
        return None

    db_match = re.search(r"\bdb:\s*([^\s,]+)", source_str)
    table_match = re.search(r"\btable:\s*([^\s,]+)", source_str)

    if db_match and table_match:
        return db_match.group(1).strip(" '\""), table_match.group(1).strip(" '\"")

    return None


# ---------------------------------------------------------------------------
# Lineage source class
# ---------------------------------------------------------------------------


class ClickhouseLineageSource(ClickhouseQueryParserSource, LineageSource):
    """
    Implements the necessary methods to extract
    Database lineage from Clickhouse Source.

    Extends the base ``LineageSource`` with:

    * ``yield_cross_database_lineage`` — Cross-service table matching
      (mirrors the Trino pattern).
    * ``yield_dictionary_lineage`` — Upstream edges from
      ``system.dictionaries`` SOURCE() clauses.
    * ``_iter`` override — calls ``yield_dictionary_lineage`` in addition to
      the usual base-class steps.
    """

    sql_stmt = CLICKHOUSE_SQL_STATEMENT

    filters = """
        and (
            query_kind='Create'
            or (query_kind='Insert' and query ilike '%%insert%%into%%select%%')
        )
    """

    database_field = ""

    schema_field = "databases"

    # -----------------------------------------------------------------------
    # Cross-Database Lineage  (mirrors Trino pattern exactly)
    # -----------------------------------------------------------------------

    def get_cross_database_fqn_from_service_names(self) -> List[str]:
        """Resolve every database FQN that belongs to any service listed in
        ``source_config.crossDatabaseServiceNames``."""
        database_service_names = self.source_config.crossDatabaseServiceNames
        return [
            database.fullyQualifiedName.root
            for service in database_service_names
            for database in self.metadata.list_all_entities(
                entity=Database, params={"service": service}
            )
        ]

    def check_same_table(self, table1: Table, table2: Table) -> bool:
        """Return True when *table1* and *table2* share the same name and an
        identical set of column names — the heuristic used to decide whether
        two tables in different services are the "same" physical table."""
        return table1.name.root == table2.name.root and {
            col.name.root for col in table1.columns
        } == {col.name.root for col in table2.columns}

    def yield_cross_database_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        """
        For every table already ingested under this Clickhouse service, look
        up a table with the same FQN suffix in each configured cross-database
        service.  If the names **and** column sets match, emit a
        ``CrossDatabaseLineage`` edge from the external table to the
        Clickhouse table (external → Clickhouse, i.e. upstream first).

        Algorithm (identical to the Trino connector):
        1. Gather all database FQNs from ``crossDatabaseServiceNames``.
        2. Iterate every database and table in the current CH service.
        3. For each CH table, replace the CH database prefix with each
           external DB prefix to form a candidate FQN.
        4. Fetch the candidate from OpenMetadata (cached per FQN).
        5. If found and ``check_same_table`` passes → yield an edge.
        """
        try:
            all_cross_db_fqns = self.get_cross_database_fqn_from_service_names()
            # Cache to avoid repeated API calls for the same candidate FQN
            cross_db_table_cache: Dict[str, Optional[Table]] = {}

            clickhouse_databases = self.metadata.list_all_entities(
                entity=Database, params={"service": self.config.serviceName}
            )

            for ch_db in clickhouse_databases:
                ch_db_fqn = ch_db.fullyQualifiedName.root

                ch_tables = self.metadata.list_all_entities(
                    entity=Table, params={"database": ch_db_fqn}
                )

                for ch_table in ch_tables:
                    ch_table_fqn = ch_table.fullyQualifiedName.root

                    for cross_db_fqn in all_cross_db_fqns:
                        # Build the candidate FQN by swapping the CH DB prefix
                        candidate_fqn = ch_table_fqn.replace(ch_db_fqn, cross_db_fqn, 1)

                        # Populate cache on first encounter
                        if candidate_fqn not in cross_db_table_cache:
                            cross_db_table_cache[candidate_fqn] = (
                                self.metadata.get_by_name(Table, fqn=candidate_fqn)
                            )

                        cross_db_table = cross_db_table_cache[candidate_fqn]

                        if cross_db_table and self.check_same_table(
                            ch_table, cross_db_table
                        ):
                            yield self.get_add_cross_database_lineage_request(
                                from_entity=cross_db_table,
                                to_entity=ch_table,
                                column_lineage=self.get_column_lineage(
                                    from_table=cross_db_table,
                                    to_table=ch_table,
                                ),
                            )
                            # One upstream source per CH table is enough
                            break

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=f"{self.config.serviceName} Cross Database Lineage",
                    error=(
                        "Error yielding cross-database lineage for service "
                        f"[{self.config.serviceName}]: {exc}"
                    ),
                    stackTrace=traceback.format_exc(),
                )
            )

    # -----------------------------------------------------------------------
    # Dictionary Lineage
    # -----------------------------------------------------------------------

    def yield_dictionary_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        """
        Query ``system.dictionaries`` for all ``LOADED`` dictionaries and,
        for each one backed by a ClickHouse-native source, emit a
        ``ViewLineage`` edge::

            source_table  ──►  dictionary_entity

        Prerequisites
        -------------
        * The dictionary must already be registered in OpenMetadata as a
          ``TableType.External`` entity — this is guaranteed by the
          ``query_table_names_and_types`` override in ``metadata.py``.
        * The source table must already be registered under the same service.

        FQN construction
        ----------------
        In Clickhouse the "database" and "schema" concepts collapse into a
        single level.  OpenMetadata models this as a four-part FQN where the
        database and schema segments are identical::

            {service}.{db}.{db}.{table}
        """
        try:
            for engine in self.get_engine():
                with engine.connect() as conn:
                    rows = conn.execute(text(CLICKHOUSE_DICTIONARY_LINEAGE))
                    for row in rows:
                        row_dict = (
                            row._asdict() if hasattr(row, "_asdict") else dict(row)
                        )

                        parsed = _parse_clickhouse_dict_source(
                            row_dict.get("source_config") or ""
                        )
                        if parsed is None:
                            logger.debug(
                                "Skipping dictionary '%s': source is not a "
                                "ClickHouse-native table or could not be parsed.",
                                row_dict.get("dict_name"),
                            )
                            continue

                        source_db, source_table = parsed
                        dict_db = row_dict["database"]
                        dict_name = row_dict["dict_name"]

                        # Four-part FQN: service.db.db.table
                        source_fqn = (
                            f"{self.config.serviceName}"
                            f".{source_db}.{source_db}.{source_table}"
                        )
                        dict_fqn = (
                            f"{self.config.serviceName}"
                            f".{dict_db}.{dict_db}.{dict_name}"
                        )

                        from_entity: Optional[Table] = self.metadata.get_by_name(
                            Table, fqn=source_fqn
                        )
                        to_entity: Optional[Table] = self.metadata.get_by_name(
                            Table, fqn=dict_fqn
                        )

                        if not from_entity or not to_entity:
                            logger.debug(
                                "Skipping dictionary lineage for '%s': "
                                "source entity ('%s') or dict entity ('%s') "
                                "not found in OpenMetadata.",
                                dict_name,
                                source_fqn,
                                dict_fqn,
                            )
                            continue

                        yield Either(
                            right=AddLineageRequest(
                                edge=EntitiesEdge(
                                    fromEntity=EntityReference(
                                        id=Uuid(from_entity.id.root),
                                        type="table",
                                    ),
                                    toEntity=EntityReference(
                                        id=Uuid(to_entity.id.root),
                                        type="table",
                                    ),
                                    lineageDetails=LineageDetails(
                                        # Dictionaries derive their content
                                        # from a single declared source —
                                        # semantically identical to a view.
                                        source=Source.ViewLineage,
                                    ),
                                )
                            )
                        )

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=f"{self.config.serviceName} Dictionary Lineage",
                    error=(
                        "Error yielding dictionary lineage for service "
                        f"[{self.config.serviceName}]: {exc}"
                    ),
                    stackTrace=traceback.format_exc(),
                )
            )

    # -----------------------------------------------------------------------
    # _iter override
    # -----------------------------------------------------------------------

    def _iter(
        self, *_, **__
    ) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:
        """
        Execute all lineage steps in order:

        1. Delegate to ``super()._iter()`` which handles:
           - View lineage (``processViewLineage`` flag)
           - Stored-procedure lineage (``processStoredProcedureLineage``)
           - Query-log lineage (``processQueryLineage``)
           - Cross-database lineage (``processCrossDatabaseLineage``) via our
             ``yield_cross_database_lineage`` override above.

        2. Additionally run **dictionary lineage** when the
           ``processViewLineage`` flag is enabled — dictionaries behave like
           views in that their upstream source is declared in their DDL rather
           than captured in the query log.
        """
        yield from super()._iter()

        if self.source_config.processViewLineage:
            logger.info("Processing Clickhouse Dictionary Lineage")
            yield from self.yield_dictionary_lineage() or []
