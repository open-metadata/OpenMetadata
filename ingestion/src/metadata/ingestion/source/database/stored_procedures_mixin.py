#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
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
from copy import deepcopy
from typing import Dict, Iterable, List, Union

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
    def get_stored_procedure_queries_dict(self) -> Dict[str, List[QueryByProcedure]]:
        """
        Return the dictionary associating stored procedures to the
        queries they triggered
        """

    def procedure_queries_dict(self, query: str) -> Dict[str, List[QueryByProcedure]]:
        """
        Cache the queries ran for the stored procedures in the last `queryLogDuration` days.

        We will run this for each different and db name.

        The dictionary key will be the case-insensitive procedure name.
        """
        results = self.engine.execute(query).all()
        queries_dict = defaultdict(list)

        for row in results:
            try:
                query_by_procedure = QueryByProcedure.model_validate(dict(row))
                procedure_name = (
                    query_by_procedure.procedure_name
                    or get_procedure_name_from_call(
                        query_text=query_by_procedure.procedure_text,
                    )
                )
                queries_dict[procedure_name].append(query_by_procedure)
            except Exception as exc:
                self.status.failed(
                    StackTraceError(
                        name="Stored Procedure",
                        error=f"Error trying to get procedure name due to [{exc}]",
                        stackTrace=traceback.format_exc(),
                    )
                )

        return queries_dict

    def procedure_lineage_generator(self) -> Iterable[ProcedureAndQuery]:
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
        # First, get all the query history
        queries_dict = self.get_stored_procedure_queries_dict()
        # Then for each procedure, iterate over all its queries
        for procedure in (
            self.metadata.paginate_es(
                entity=StoredProcedure, query_filter=query_filter, size=10
            )
            or []
        ):
            if procedure:
                logger.debug(f"Processing Lineage for [{procedure.name}]")
                for query_by_procedure in (
                    queries_dict.get(procedure.name.root.lower()) or []
                ):
                    yield ProcedureAndQuery(
                        procedure=procedure, query_by_procedure=query_by_procedure
                    )

    def yield_procedure_lineage(
        self,
    ) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:
        """Get all the queries and procedures list and yield them"""
        logger.info("Processing Lineage for Stored Procedures")
        producer_fn = self.procedure_lineage_generator
        processor_fn = procedure_lineage_processor
        dialect = ConnectionTypeDialectMapper.dialect_of(
            self.service_connection.type.value
        )
        args = (
            deepcopy(self.metadata),
            self.service_name,
            dialect,
            self.source_config.parsingTimeoutLimit,
        )
        yield from self.generate_lineage_with_processes(producer_fn, processor_fn, args)
