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
Mixin class with common Stored Procedures logic aimed at lineage.
"""

import json
import traceback
from abc import ABC, abstractmethod
from collections import defaultdict
from collections.abc import Iterator

from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
    DatabaseServiceQueryLineagePipeline,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.status import Status
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.lineage_processors import (
    ProcedureAndQuery,
    QueryByProcedure,
    procedure_lineage_processor,
)
from metadata.utils.filters import (
    filter_by_database,
    filter_by_schema,
    filter_by_stored_procedure,
)
from metadata.utils.helpers import pprint_format_object
from metadata.utils.logger import ingestion_logger
from metadata.utils.stored_procedures import get_procedure_name_from_call

logger = ingestion_logger()


class StoredProcedureLineageMixin(ABC):
    """
    The full flow is:
    1. List Stored Procedures
    2. Yield Stored Procedures
    3. Get the queries related to the Stored Procedures in the last X days
    4. Ingest the Lineage
    5. Ingest the Query

    This Mixin is in charge from 3 - 5 in order to handle this process efficiently.

    It should be inherited in those Sources that implement Stored Procedure ingestion.
    """

    status: Status
    source_config: DatabaseServiceQueryLineagePipeline
    engine: Engine
    stored_procedure_query_lineage: bool
    metadata: OpenMetadata

    @abstractmethod
    def get_stored_procedure_sql_statement(self) -> str:
        """
        Return the SQL statement to get the stored procedure queries
        """

    def get_stored_procedure_engines(self) -> Iterator[Engine]:
        """
        Engines to read stored-procedure query history from. Defaults to the single
        source connection. Sources whose query history is per-database (such as MSSQL
        Query Store) override this to yield one engine per database.
        """
        yield self.engine

    def yield_stored_procedure_queries(self) -> Iterator[QueryByProcedure]:
        """
        Yield query and stored procedure object for lineage processing.
        """
        for engine in self.get_stored_procedure_engines():
            # Built outside the guard below: a failure here is a bug in the source's
            # statement builder, not an unreachable engine, and must not be reported
            # as a skipped connection.
            query = self.get_stored_procedure_sql_statement()
            try:
                with engine.connect() as conn:
                    results = conn.execute(text(query)).all()
            # Narrowed: SQLAlchemy wraps driver failures, but mssql+pytds leaks raw
            # OSError subclasses on connect (socket.gaierror, TimeoutError) - the same
            # types NETWORK_ERRORS matches. A KeyError/AttributeError here is a code
            # bug and must keep propagating.
            except (SQLAlchemyError, OSError) as exc:
                logger.debug(traceback.format_exc())
                logger.warning("Failed to fetch stored procedure query history from a connection, skipping it: %s", exc)
                continue

            for row in results:
                # Bound outside the try so the handler can still name the procedure, and
                # assigned inside it so an unreadable row cannot escape and silently drop
                # every row after it.
                row_data = {}
                try:
                    row_data = row._asdict()
                    query_by_procedure = QueryByProcedure.model_validate(row_data)
                    if not query_by_procedure.procedure_name and query_by_procedure.procedure_text:
                        query_by_procedure.procedure_name = get_procedure_name_from_call(
                            query_text=query_by_procedure.procedure_text
                        )
                    yield query_by_procedure
                except Exception as exc:
                    self.status.failed(
                        StackTraceError(
                            name="Stored Procedure",
                            error=f"Error trying to get procedure name for "
                            f"[{row_data.get('PROCEDURE_NAME') or 'unknown procedure'}] due to [{exc}]",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    @staticmethod
    def _reference_name(reference: EntityReference | None) -> str:
        return reference.name.lower() if reference is not None and reference.name else ""

    @staticmethod
    def _disambiguate_procedure(
        candidates: list[StoredProcedure], query_by_procedure: QueryByProcedure
    ) -> StoredProcedure | None:
        database = (query_by_procedure.query_database_name or "").lower()
        schema = (query_by_procedure.query_schema_name or "").lower()
        scoped = [
            candidate
            for candidate in candidates
            if (not database or StoredProcedureLineageMixin._reference_name(candidate.database) == database)
            and (not schema or StoredProcedureLineageMixin._reference_name(candidate.databaseSchema) == schema)
        ]
        return scoped[0] if len(scoped) == 1 else None

    @staticmethod
    def _match_procedure(
        candidates: list[StoredProcedure] | None, query_by_procedure: QueryByProcedure
    ) -> StoredProcedure | None:
        """
        Resolve which stored procedure a query belongs to. The same procedure name can
        exist in several databases or schemas on an ingest-all run, so when more than one
        candidate shares the name we disambiguate by the database and schema the query
        reported. Returns None when the name stays ambiguous, so lineage is never attached
        to the wrong procedure.
        """
        if not candidates:
            matched = None
        elif len(candidates) == 1:
            matched = candidates[0]
        else:
            matched = StoredProcedureLineageMixin._disambiguate_procedure(candidates, query_by_procedure)
        return matched

    def procedure_lineage_producer(self) -> Iterator[ProcedureAndQuery]:
        """
        Generate lineage for a list of stored procedures
        """
        query = {
            "query": {
                "bool": {
                    "must": [
                        {"bool": {"should": [{"term": {"service.name.keyword": self.service_name}}]}},
                        {"bool": {"should": [{"term": {"deleted": False}}]}},
                    ]
                }
            }
        }
        if self.source_config.incrementalLineageProcessing:
            query.get("query").get("bool").get("must").append(
                {"bool": {"should": [{"term": {"processedLineage": False}}]}}
            )
        query_filter = json.dumps(query)
        logger.info("Processing Lineage for Stored Procedures")

        procedures_by_name = defaultdict(list)
        queries = self.yield_stored_procedure_queries()
        queries_count_per_procedure = defaultdict(int)

        # Get the filtered list of stored procedure to process
        for procedure in self.metadata.paginate_es(entity=StoredProcedure, query_filter=query_filter, size=10) or []:
            if procedure:
                if (
                    filter_by_database(
                        self.source_config.databaseFilterPattern,
                        procedure.database.name,
                    )
                    or filter_by_schema(
                        self.source_config.schemaFilterPattern,
                        procedure.databaseSchema.name,
                    )
                    or filter_by_stored_procedure(
                        self.source_config.storedProcedureFilterPattern,
                        procedure.name.root,
                    )
                ):
                    self.status.filter(
                        procedure.name.root,
                        "Stored Procedure Filtered Out",
                    )
                    continue
                logger.debug(f"Processing Lineage for [{procedure.name}]")
                procedures_by_name[procedure.name.root.lower()].append(procedure)

        # Yield the ProcedureAndQuery for filtered stored procedure
        for query_by_procedure in queries:
            if not query_by_procedure.procedure_name:
                continue

            procedure_name = query_by_procedure.procedure_name.lower()
            queries_count_per_procedure[procedure_name] += 1

            procedure = self._match_procedure(procedures_by_name.get(procedure_name), query_by_procedure)
            if procedure is not None:
                yield ProcedureAndQuery(
                    procedure=procedure,
                    query_by_procedure=query_by_procedure,
                )

        logger.info(f"Count of queries executed for stored procedures: {sum(queries_count_per_procedure.values())}")
        logger.info(f"Count of queries per stored procedure: {pprint_format_object(dict(queries_count_per_procedure))}")

    def yield_procedure_lineage(
        self,
    ) -> Iterator[Either[AddLineageRequest | CreateQueryRequest]]:
        """Get all the queries and procedures list and yield them"""
        logger.info("Processing Lineage for Stored Procedures")
        producer_fn = self.procedure_lineage_producer
        processor_fn = procedure_lineage_processor
        dialect = ConnectionTypeDialectMapper.dialect_of(self.service_connection.type.value)
        args = (
            self.metadata,
            self.service_name,
            dialect,
            self.source_config.processCrossDatabaseLineage,
            self.source_config.crossDatabaseServiceNames,
            self.source_config.parsingTimeoutLimit,
            self.procedure_graph_map,
            self.source_config.enableTempTableLineage,
            self.get_query_parser_type(),
        )
        yield from self.generate_lineage_with_processes(
            producer_fn,
            processor_fn,
            args,
            max_threads=self.source_config.threads,
        )
