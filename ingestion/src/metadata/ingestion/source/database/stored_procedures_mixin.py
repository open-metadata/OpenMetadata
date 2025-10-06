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
from typing import Iterator, Union

from sqlalchemy.engine import Engine

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
    DatabaseServiceQueryLineagePipeline,
)
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

    def yield_stored_procedure_queries(self) -> Iterator[QueryByProcedure]:
        """
        Yield query and stored procedure object for lineage processing.
        """
        query = self.get_stored_procedure_sql_statement()
        results = self.engine.execute(query).all()

        for row in results:
            try:
                query_by_procedure = QueryByProcedure.model_validate(dict(row))
                query_by_procedure.procedure_name = (
                    query_by_procedure.procedure_name
                    or get_procedure_name_from_call(
                        query_text=query_by_procedure.procedure_text,
                    )
                )
                yield query_by_procedure
            except Exception as exc:
                self.status.failed(
                    StackTraceError(
                        name="Stored Procedure",
                        error=f"Error trying to get procedure name due to [{exc}]",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def procedure_lineage_producer(self) -> Iterator[ProcedureAndQuery]:
        """
        Generate lineage for a list of stored procedures
        """
        query = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "bool": {
                                "should": [
                                    {
                                        "term": {
                                            "service.name.keyword": self.service_name
                                        }
                                    }
                                ]
                            }
                        },
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

        procedures_dict = {}
        queries = self.yield_stored_procedure_queries()
        queries_count_per_procedure = defaultdict(int)

        # Get the filtered list of stored procedure to process
        for procedure in (
            self.metadata.paginate_es(
                entity=StoredProcedure, query_filter=query_filter, size=10
            )
            or []
        ):
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
                procedures_dict[procedure.name.root.lower()] = procedure

        # Yield the ProcedureAndQuery for filtered stored procedure
        for query_by_procedure in queries:
            if not query_by_procedure.procedure_name:
                continue

            procedure_name = query_by_procedure.procedure_name.lower()
            queries_count_per_procedure[procedure_name] += 1

            if procedure_name in procedures_dict:
                yield ProcedureAndQuery(
                    procedure=procedures_dict[procedure_name],
                    query_by_procedure=query_by_procedure,
                )

        logger.info(
            f"Count of queries executed for stored procedures: {sum(queries_count_per_procedure.values())}"
        )
        logger.info(
            f"Count of queries per stored procedure: {pprint_format_object(dict(queries_count_per_procedure))}"
        )

    def yield_procedure_lineage(
        self,
    ) -> Iterator[Either[Union[AddLineageRequest, CreateQueryRequest]]]:
        """Get all the queries and procedures list and yield them"""
        logger.info("Processing Lineage for Stored Procedures")
        producer_fn = self.procedure_lineage_producer
        processor_fn = procedure_lineage_processor
        dialect = ConnectionTypeDialectMapper.dialect_of(
            self.service_connection.type.value
        )
        args = (
            self.metadata,
            self.service_name,
            dialect,
            self.source_config.processCrossDatabaseLineage,
            self.source_config.crossDatabaseServiceNames,
            self.source_config.parsingTimeoutLimit,
            self.procedure_graph_map,
            self.source_config.enableTempTableLineage,
        )
        yield from self.generate_lineage_with_processes(
            producer_fn,
            processor_fn,
            args,
            max_threads=self.source_config.threads,
        )
