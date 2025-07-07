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
import re
import traceback
from abc import ABC, abstractmethod
from collections import defaultdict
from datetime import datetime
from typing import Dict, Iterable, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field
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
from metadata.generated.schema.type.basic import SqlQuery, Timestamp
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.status import Status
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper
from metadata.ingestion.lineage.sql_lineage import get_lineage_by_query
from metadata.ingestion.models.ometa_lineage import OMetaLineageRequest
from metadata.ingestion.models.topology import Queue
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import ingestion_logger
from metadata.utils.stored_procedures import get_procedure_name_from_call
from metadata.utils.time_utils import datetime_to_timestamp

logger = ingestion_logger()


class QueryByProcedure(BaseModel):
    """
    Query(ies) executed by each stored procedure
    """

    procedure_name: str = Field(None, alias="PROCEDURE_NAME")
    query_type: str = Field(..., alias="QUERY_TYPE")
    query_database_name: Optional[str] = Field(None, alias="QUERY_DATABASE_NAME")
    query_schema_name: Optional[str] = Field(None, alias="QUERY_SCHEMA_NAME")
    procedure_text: str = Field(..., alias="PROCEDURE_TEXT")
    procedure_start_time: datetime = Field(..., alias="PROCEDURE_START_TIME")
    procedure_end_time: datetime = Field(..., alias="PROCEDURE_END_TIME")
    query_start_time: Optional[datetime] = Field(None, alias="QUERY_START_TIME")
    query_duration: Optional[float] = Field(None, alias="QUERY_DURATION")
    query_text: str = Field(..., alias="QUERY_TEXT")
    query_user_name: Optional[str] = Field(None, alias="QUERY_USER_NAME")

    model_config = ConfigDict(populate_by_name=True)


class ProcedureAndQuery(BaseModel):
    """
    Model to hold the procedure and its queries
    """

    procedure: StoredProcedure
    query_by_procedure: QueryByProcedure

    model_config = ConfigDict(populate_by_name=True)


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

    @staticmethod
    def is_lineage_query(query_type: str, query_text: str) -> bool:
        """Check if it's worth it to parse the query for lineage"""

        logger.debug(
            f"Validating query lineage for type [{query_type}] and text [{query_text}]"
        )

        if query_type in ("MERGE", "UPDATE", "CREATE_TABLE_AS_SELECT"):
            return True

        if query_type == "INSERT" and re.search(
            "^.*insert.*into.*select.*$", query_text.replace("\n", " "), re.IGNORECASE
        ):
            return True

        return False

    def _yield_procedure_lineage(
        self, query_by_procedure: QueryByProcedure, procedure: StoredProcedure
    ) -> Iterable[Either[AddLineageRequest]]:
        """Add procedure lineage from its query"""
        self.stored_procedure_query_lineage = False
        if self.is_lineage_query(
            query_type=query_by_procedure.query_type,
            query_text=query_by_procedure.query_text,
        ):
            self.stored_procedure_query_lineage = True
            for either_lineage in get_lineage_by_query(
                self.metadata,
                query=query_by_procedure.query_text,
                service_name=self.service_name,
                database_name=query_by_procedure.query_database_name,
                schema_name=query_by_procedure.query_schema_name,
                dialect=ConnectionTypeDialectMapper.dialect_of(
                    self.service_connection.type.value
                ),
                timeout_seconds=self.source_config.parsingTimeoutLimit,
                lineage_source=LineageSource.QueryLineage,
            ):
                if (
                    either_lineage.left is None
                    and either_lineage.right.edge.lineageDetails
                ):
                    either_lineage.right.edge.lineageDetails.pipeline = EntityReference(
                        id=procedure.id,
                        type="storedProcedure",
                    )

                yield either_lineage

    def yield_procedure_query(
        self, query_by_procedure: QueryByProcedure, procedure: StoredProcedure
    ) -> Iterable[Either[CreateQueryRequest]]:
        """Check the queries triggered by the procedure and add their lineage, if any"""

        yield Either(
            right=CreateQueryRequest(
                query=SqlQuery(query_by_procedure.query_text),
                query_type=query_by_procedure.query_type,
                duration=query_by_procedure.query_duration,
                queryDate=Timestamp(
                    root=datetime_to_timestamp(
                        query_by_procedure.query_start_time, True
                    )
                ),
                triggeredBy=EntityReference(
                    id=procedure.id,
                    type="storedProcedure",
                ),
                processedLineage=bool(self.stored_procedure_query_lineage),
                service=self.service_name,
            )
        )

    def procedure_lineage_processor(
        self, procedure_and_queries: List[ProcedureAndQuery], queue: Queue
    ) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:
        for procedure_and_query in procedure_and_queries:
            try:
                for lineage in self._yield_procedure_lineage(
                    query_by_procedure=procedure_and_query.query_by_procedure,
                    procedure=procedure_and_query.procedure,
                ):
                    if lineage and lineage.right is not None:
                        queue.put(
                            Either(
                                right=OMetaLineageRequest(
                                    override_lineage=False,
                                    lineage_request=lineage.right,
                                    entity=StoredProcedure,
                                    entity_fqn=procedure_and_query.procedure.fullyQualifiedName.root,
                                )
                            )
                        )
                    else:
                        queue.put(lineage)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Could not get lineage for store procedure '{procedure_and_query.procedure.fullyQualifiedName}' due to [{exc}]."
                )
            try:
                for lineage in self.yield_procedure_query(
                    query_by_procedure=procedure_and_query.query_by_procedure,
                    procedure=procedure_and_query.procedure,
                ):
                    queue.put(lineage)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Could not get query for store procedure '{procedure_and_query.procedure.fullyQualifiedName}' due to [{exc}]."
                )

    def procedure_lineage_generator(self) -> Iterable[ProcedureAndQuery]:
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
        processor_fn = self.procedure_lineage_processor
        yield from self.generate_lineage_in_thread(
            producer_fn, processor_fn, max_threads=self.source_config.threads
        )
