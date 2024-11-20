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
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.type.basic import SqlQuery, Timestamp
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.status import Status
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper
from metadata.ingestion.lineage.sql_lineage import get_lineage_by_query
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import ingestion_logger
from metadata.utils.stored_procedures import get_procedure_name_from_call
from metadata.utils.time_utils import convert_timestamp_to_milliseconds

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


class StoredProcedureMixin(ABC):
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

    context: TopologyContextManager
    status: Status
    source_config: DatabaseServiceMetadataPipeline
    engine: Engine
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

    def yield_procedure_lineage(
        self, query_by_procedure: QueryByProcedure, procedure: StoredProcedure
    ) -> Iterable[Either[AddLineageRequest]]:
        """Add procedure lineage from its query"""
        self.context.get().stored_procedure_query_lineage = False
        if self.is_lineage_query(
            query_type=query_by_procedure.query_type,
            query_text=query_by_procedure.query_text,
        ):
            self.context.get().stored_procedure_query_lineage = True
            for either_lineage in get_lineage_by_query(
                self.metadata,
                query=query_by_procedure.query_text,
                service_name=self.context.get().database_service,
                database_name=query_by_procedure.query_database_name,
                schema_name=query_by_procedure.query_schema_name,
                dialect=ConnectionTypeDialectMapper.dialect_of(
                    self.service_connection.type.value
                ),
                timeout_seconds=self.source_config.queryParsingTimeoutLimit,
                lineage_source=LineageSource.QueryLineage,
            ):
                if either_lineage.right.edge.lineageDetails:
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
                    root=convert_timestamp_to_milliseconds(
                        int(query_by_procedure.query_start_time.timestamp())
                    )
                ),
                triggeredBy=EntityReference(
                    id=procedure.id,
                    type="storedProcedure",
                ),
                processedLineage=bool(
                    self.context.get().stored_procedure_query_lineage
                ),
                service=self.context.get().database_service,
            )
        )

    def yield_procedure_lineage_and_queries(
        self,
    ) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:
        """Get all the queries and procedures list and yield them"""
        if self.context.get().stored_procedures:
            logger.info("Processing Lineage for Stored Procedures")
            # First, get all the query history
            queries_dict = self.get_stored_procedure_queries_dict()
            # Then for each procedure, iterate over all its queries
            for procedure_fqn in self.context.get().stored_procedures:
                procedure: StoredProcedure = self.metadata.get_by_name(
                    entity=StoredProcedure, fqn=procedure_fqn
                )
                if procedure:
                    logger.debug(f"Processing Lineage for [{procedure.name}]")
                    for query_by_procedure in (
                        queries_dict.get(procedure.name.root.lower()) or []
                    ):
                        try:
                            yield from self.yield_procedure_lineage(
                                query_by_procedure=query_by_procedure,
                                procedure=procedure,
                            )
                        except Exception as exc:
                            logger.debug(traceback.format_exc())
                            logger.warning(
                                f"Could not get lineage for store procedure '{procedure_fqn}' due to [{exc}]."
                            )

                        try:
                            yield from self.yield_procedure_query(
                                query_by_procedure=query_by_procedure,
                                procedure=procedure,
                            )
                        except Exception as exc:
                            logger.debug(traceback.format_exc())
                            logger.warning(
                                f"Could not get query for store procedure '{procedure_fqn}' due to [{exc}]."
                            )
