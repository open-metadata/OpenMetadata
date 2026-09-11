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
from collections.abc import Iterable

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import test_connection_common
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.saphana.cdata_parser import (
    ParsedLineage,
    parse_registry,
)
from metadata.ingestion.source.database.saphana.models import SapHanaLineageModel
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

# The cached statement with leading whitespace removed, so a keyword match can stay
# anchored to the start of the statement.
_STATEMENT = "LTRIM(UPPER(STATEMENT_STRING), ' ' || CHAR(9) || CHAR(13) || CHAR(10))"


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

    The two never describe the same object, so every edge has exactly one origin.
    """

    sql_stmt = SAPHANA_QUERY_HISTORY_STATEMENT

    # Matched against the trimmed statement, because cached statements keep the
    # whitespace they were submitted with. Still anchored, since a leading wildcard
    # also matches a SELECT that merely quotes the keyword.
    #
    # CREATE TABLE ... AS SELECT is missing by necessity: the plan cache holds no DDL.
    filters = f"""
        AND (
            {_STATEMENT} LIKE 'INSERT INTO%SELECT%'
            OR {_STATEMENT} LIKE 'UPSERT%SELECT%'
            OR {_STATEMENT} LIKE 'REPLACE%SELECT%'
            OR {_STATEMENT} LIKE 'MERGE INTO%'
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
        sql_edges = 0
        sql_queries = 0
        for either in super()._iter():
            if isinstance(either.right, AddLineageRequest):
                sql_edges += 1
            elif isinstance(either.right, CreateQueryRequest):
                sql_queries += 1
            yield either
        logger.info(
            "SAP HANA SQL lineage produced %d edges from view definitions and query history, "
            "alongside %d query records",
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
            logger.info("SAP HANA repository lineage produced %d edges from _SYS_REPO models", cdata_edges)

        if sql_edges or cdata_edges:
            return

        if sql_queries:
            logger.warning(
                "SAP HANA lineage finished with no edges, though %d queries were read. The queries were "
                "found but neither endpoint resolved to an ingested asset, so check that the metadata "
                "workflow covers the schemas those queries reference.",
                sql_queries,
            )
        else:
            logger.warning(
                "SAP HANA lineage finished with no edges and read no queries. Check that the metadata "
                "workflow has already ingested the tables and views, that processViewLineage or "
                "processQueryLineage is enabled, and that the ingestion user holds CATALOG READ, without "
                "which SYS.M_SQL_PLAN_CACHE only returns the ingestion user's own statements."
            )

    def yield_query_lineage(self) -> Iterable[Either[AddLineageRequest | CreateQueryRequest]]:
        """Query-history lineage, guarded so a restricted plan cache is not fatal.

        yield_table_query does not guard its own execute, so an unreadable
        SYS.M_SQL_PLAN_CACHE raises. Only this pass is wrapped: a failure in the view
        pass must still surface, because on Cloud that pass is the whole result.
        """
        try:
            yield from super().yield_query_lineage()
        except Exception as exc:
            logger.warning(
                "SAP HANA query-history lineage failed, so no table-to-table edges were read. View "
                "lineage is unaffected. Check that the ingestion user holds CATALOG READ. Cause: %s",
                exc,
            )
            logger.debug(traceback.format_exc())

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
                    "_SYS_REPO is not present, so there are no repository models to read. This is normal on "
                    "SAP HANA Cloud, where the classic repository was never carried over. View and query "
                    "lineage are unaffected. Cause: %s",
                    exc,
                )
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
