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
SAP Hana lineage module
"""

import traceback
from collections.abc import Iterable, Iterator

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.api.models import Either
from metadata.ingestion.models.ometa_lineage import (
    OMetaFQNLineageRequest,
    OMetaLineageRequest,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import test_connection_common
from metadata.ingestion.source.database.lineage_source import LineageSource, TableView
from metadata.ingestion.source.database.saphana.cdata_parser import (
    ParsedLineage,
    parse_registry,
)
from metadata.ingestion.source.database.saphana.models import (
    SYS_BIC_SCHEMA_NAME,
    SapHanaLineageModel,
)
from metadata.ingestion.source.database.saphana.queries import (
    SAPHANA_LINEAGE,
    SAPHANA_QUERY_HISTORY_STATEMENT,
)
from metadata.ingestion.source.database.saphana.query_parser import (
    SapHanaQueryParserSource,
)
from metadata.utils.filters import filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# The cached statement with leading comments and whitespace removed, so a keyword match
# can stay anchored to the start of the statement. Tools routinely prefix DML with a
# comment, and the plan cache stores whatever whitespace it was submitted with.
# The block-comment body is spelled out rather than using `.`, because HANA's ICU
# regex does not let `.` cross a line terminator, which would leave a multi-line
# header comment in place.
_STATEMENT = (
    r"LTRIM(UPPER(REPLACE_REGEXPR('^(\s*(/\*(\*[^/]|[^*])*\*/|--[^\n]*\n))+'"
    r" IN STATEMENT_STRING WITH '' OCCURRENCE ALL))"
    r", ' ' || CHAR(9) || CHAR(13) || CHAR(10))"
)


class SaphanaLineageSource(SapHanaQueryParserSource, LineageSource):
    """SAP Hana lineage, from two passes covering disjoint kinds of object.

    The shared LineageSource handles what is expressed in SQL: view definitions, with
    column-level lineage, and query history for table-to-table edges. This is the only
    pass that produces anything on SAP HANA Cloud.

    Stored-procedure lineage stays unsupported. It needs StoredProcedureLineageMixin,
    which is not mixed in here, so LineageSource.yield_procedure_lineage is a no-op.

    The CDATA pass handles the repository model types, which are XML rather than SQL
    and exist only in _SYS_REPO on on-prem and HXE instances:
    - Analytic View and Attribute View based on a Table
    - Calculation View based on an Analytic, Attribute or Calculation View, or a Table

    On-premise exposes the repository models as _SYS_BIC runtime views, so the SQL pass
    skips that schema and the two never describe the same object.
    """

    sql_stmt = SAPHANA_QUERY_HISTORY_STATEMENT

    # Statements the query pass read, from the plan cache or from queryLogFilePath.
    # Counted because a CreateQueryRequest is only ever emitted alongside an edge, so it
    # cannot tell a source that returned nothing from one that returned rows.
    statements_read = 0

    # Anchored rather than wildcarded, so a SELECT that merely quotes the keyword does
    # not match. Keyword pairs allow anything between them, because SQL permits any
    # whitespace there and formatted statements routinely wrap the line.
    #
    # CREATE TABLE ... AS SELECT is missing by necessity: no DDL is cached.
    filters = f"""
        AND (
            {_STATEMENT} LIKE 'INSERT%INTO%SELECT%'
            OR {_STATEMENT} LIKE 'UPSERT%SELECT%'
            OR {_STATEMENT} LIKE 'REPLACE%SELECT%'
            OR {_STATEMENT} LIKE 'MERGE%INTO%'
            OR {_STATEMENT} LIKE 'UPDATE%SET%'
        )
        """

    def close(self) -> None:
        # The base clears masked_query_cache, which is shared across workflows.
        super().close()
        # engine is None when the source was built with get_engine=False.
        if self.engine is not None:
            self.engine.dispose()

    def _iter(self, *_, **__) -> Iterable[Either[AddLineageRequest | CreateQueryRequest]]:
        """Run the SQL passes, then the repository pass.

        Each pass reports its own edge count, because a run that succeeds and produces
        nothing is otherwise indistinguishable from one that worked. Edges and query
        records are counted apart, since the shared passes emit both.
        """
        self.statements_read = 0
        sql_edges = 0
        sql_queries = 0
        for either in super()._iter():
            # The shared passes wrap lineage rather than yielding AddLineageRequest
            # directly, so all three shapes have to be counted.
            if isinstance(either.right, AddLineageRequest | OMetaLineageRequest | OMetaFQNLineageRequest):
                sql_edges += 1
            elif isinstance(either.right, CreateQueryRequest):
                sql_queries += 1
            yield either
        logger.info(
            "Found %d lineage edges from view definitions (SYS.VIEWS) and query history "
            "(SYS.M_SQL_PLAN_CACHE), and ingested %d queries",
            sql_edges,
            sql_queries,
        )

        cdata_edges = 0
        # Repository models are views, so the flag that governs the shared view pass
        # governs this one too.
        if self.source_config.processViewLineage:  # pyright: ignore[reportOptionalMemberAccess, reportAttributeAccessIssue]
            for either in self.yield_cdata_lineage():
                cdata_edges += 1 if isinstance(either.right, AddLineageRequest) else 0
                yield either
            logger.info(
                "Found %d lineage edges from calculation, analytic and attribute views (_SYS_REPO.ACTIVE_OBJECT)",
                cdata_edges,
            )

        if sql_edges or cdata_edges:
            return

        if self.statements_read:
            logger.warning(
                "No lineage was created from %d analysed queries. Most likely the tables they "
                "reference have not been ingested yet, so run metadata ingestion for this service "
                "first. If lineage has run before, the queries may simply have been processed already.",
                self.statements_read,
            )
        # CATALOG READ is only worth raising when the query pass actually ran. A view-only
        # run would otherwise be sent to fix a privilege it never needed.
        elif self.source_config.processQueryLineage:  # pyright: ignore[reportOptionalMemberAccess, reportAttributeAccessIssue]
            logger.warning(
                "No lineage was created and no queries were found to analyse. Check that metadata "
                "ingestion has run for this service, and that the ingestion user has CATALOG READ, "
                "without which SYS.M_SQL_PLAN_CACHE only reports queries the ingestion user ran itself."
            )
        else:
            logger.warning(
                "No lineage was created. Query Lineage is disabled, so only view definitions were "
                "read. Check that metadata ingestion has run for this service and that its views are "
                "in scope."
            )

    def query_lineage_producer(self) -> Iterator[TableQuery]:
        """Count what the query pass actually read.

        The shared pass reports how many edges it produced, which says nothing about
        whether there was anything to read in the first place. That distinction is the
        whole of the no-edge diagnosis, so it is counted here at the source. The base
        reads either the plan cache or queryLogFilePath, and both are counted.
        """
        for table_query in super().query_lineage_producer():
            self.statements_read += 1
            yield table_query

    def view_lineage_producer(self) -> Iterable[TableView]:
        """Leave the repository models to the CDATA pass.

        On-premise exposes calculation, analytic and attribute views as runtime views in
        _SYS_BIC. SYS.VIEWS carries no definition for them on the instances checked, so
        they never reach this producer, which reads definitions from the search index.
        The partition is kept for an instance that does expose one, where both passes
        would otherwise describe the same entity, one from SQL and one from the XML.
        """
        for view in super().view_lineage_producer():
            if view.schema_name == SYS_BIC_SCHEMA_NAME:
                self.status.filter(view.table_name, "Lineage comes from the view's model (_SYS_REPO) instead")
                continue
            yield view

    def yield_query_lineage(self) -> Iterable[Either[AddLineageRequest | CreateQueryRequest]]:
        """Query-history lineage, guarded so a restricted plan cache is not fatal.

        yield_table_query does not guard its own execute, so an unreadable
        SYS.M_SQL_PLAN_CACHE raises. Only this pass is wrapped: a failure in the view
        pass must still surface, because on Cloud that pass is the whole result.
        """
        try:
            yield from super().yield_query_lineage()
        except Exception as exc:
            # Recorded on the workflow status, not just logged, so the run is not
            # reported as a clean success that happened to produce nothing.
            yield Either(
                right=None,
                left=StackTraceError(
                    name="Query history lineage",
                    error=(
                        "Could not read the SAP HANA query history (SYS.M_SQL_PLAN_CACHE), so no "
                        "lineage was created from queries. Check that the ingestion user has "
                        f"CATALOG READ. Cause: {exc}"
                    ),
                    stackTrace=traceback.format_exc(),
                ),
            )

    def yield_cdata_lineage(self) -> Iterable[Either[AddLineageRequest | CreateQueryRequest]]:
        """Lineage for calculation, analytic and attribute views, from _SYS_REPO.

        On-prem and HXE only. HANA Cloud has no classic repository, so this yields
        nothing there and the SQL passes above carry the whole result.
        """
        with self.engine.connect() as conn:  # pyright: ignore[reportOptionalMemberAccess]
            try:
                result = conn.execution_options(stream_results=True, max_row_buffer=100).execute(text(SAPHANA_LINEAGE))
            except DBAPIError as exc:
                # SAP HANA Cloud never has _SYS_REPO (classic repository, deprecated since 2018,
                # never carried into Cloud) - only on-prem/HXE instances do. HANA raises 362
                # (invalid schema name) or 259 (invalid table name) for that specific case - only
                # swallow those. Anything else (connection drop, timeout, insufficient privilege)
                # is a real failure and should not be silently reported as "no lineage found".
                error_code = getattr(getattr(exc, "orig", None), "errorcode", None)
                if error_code not in (362, 259):
                    raise
                logger.info(
                    "This instance has no classic repository (_SYS_REPO), so there are no calculation, "
                    "analytic or attribute view models to read. That is normal on SAP HANA Cloud, and "
                    "view and query lineage are unaffected."
                )
                # The driver error is only of interest when this guard misfires.
                logger.debug("Reading _SYS_REPO.ACTIVE_OBJECT failed with %s", exc)
                result = []
            for row in result:
                try:
                    lineage_model = SapHanaLineageModel.validate(row._asdict())

                    if filter_by_table(
                        self.source_config.tableFilterPattern,  # pyright: ignore[reportAttributeAccessIssue]
                        lineage_model.name,
                    ):
                        self.status.filter(
                            lineage_model.name,
                            "View Object Filtered Out",
                        )
                        continue

                    logger.debug("Processing lineage for view: %s", lineage_model.name)
                    # Either is invariant, so parse_cdata's narrower Either[AddLineageRequest]
                    # does not widen into the union the shared framework yields.
                    yield from self.parse_cdata(  # pyright: ignore[reportReturnType]
                        metadata=self.metadata, lineage_model=lineage_model
                    )
                except Exception as exc:
                    self.status.failed(
                        error=StackTraceError(
                            name=row["OBJECT_NAME"],
                            error=f"Error validating lineage model due to [{exc}]",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def parse_cdata(
        self, metadata: OpenMetadata, lineage_model: SapHanaLineageModel
    ) -> Iterable[Either[AddLineageRequest]]:
        """Parse the CDATA XML definition from _SYS_REPO.ACTIVE_OBJECT"""
        parse_fn = parse_registry.registry.get(lineage_model.object_suffix.value)
        try:
            parsed_lineage: ParsedLineage = parse_fn(lineage_model.cdata)
            to_entity: Table = metadata.get_by_name(
                entity=Table,
                fqn=lineage_model.get_fqn(
                    metadata=metadata,
                    service_name=self.config.serviceName,
                ),
            )

            if to_entity:
                yield from parsed_lineage.to_request(
                    metadata=metadata,
                    engine=self.engine,
                    service_name=self.config.serviceName,
                    to_entity=to_entity,
                )
        except Exception as exc:
            error = (
                f"Error parsing CDATA XML for {lineage_model.object_suffix} at "
                + f"{lineage_model.name} due to [{exc}]"
            )
            self.status.failed(
                error=StackTraceError(
                    name=lineage_model.name,
                    error=error,
                    stackTrace=traceback.format_exc(),
                )
            )

    def test_connection(self) -> None:
        test_connection_common(self.metadata, self.engine, self.service_connection)
