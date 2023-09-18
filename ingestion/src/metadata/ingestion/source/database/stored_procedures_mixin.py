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
from collections import defaultdict
from datetime import datetime
from functools import lru_cache
from typing import Dict, Iterable, List, Optional

from pydantic import BaseModel, Field
from sqlalchemy.engine import Engine

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.type.basic import SqlQuery, Timestamp
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.models import Either, StackTraceError
from metadata.ingestion.api.status import Status
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper
from metadata.ingestion.lineage.sql_lineage import get_lineage_by_query
from metadata.ingestion.models.topology import TopologyContext
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.stored_procedures import get_procedure_name_from_call
from metadata.utils.time_utils import convert_timestamp_to_milliseconds


class QueryByProcedure(BaseModel):
    """
    Query(ies) executed by each stored procedure
    """

    procedure_id: str = Field(..., alias="PROCEDURE_ID")
    query_id: str = Field(..., alias="QUERY_ID")
    query_type: str = Field(..., alias="QUERY_TYPE")
    procedure_text: str = Field(..., alias="PROCEDURE_TEXT")
    procedure_start_time: datetime = Field(..., alias="PROCEDURE_START_TIME")
    procedure_end_time: datetime = Field(..., alias="PROCEDURE_END_TIME")
    query_start_time: datetime = Field(..., alias="QUERY_START_TIME")
    query_duration: Optional[float] = Field(None, alias="QUERY_DURATION")
    query_text: str = Field(..., alias="QUERY_TEXT")
    query_user_name: Optional[str] = Field(None, alias="QUERY_USER_NAME")

    class Config:
        allow_population_by_field_name = True


class StoredProcedureMixin:
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

    context: TopologyContext
    status: Status
    source_config: DatabaseServiceMetadataPipeline
    engine: Engine
    metadata: OpenMetadata

    @lru_cache(
        maxsize=1
    )  # Limit the caching since it cannot be repeated due to the topology ordering
    def procedure_queries_dict(
        self, query: str, schema_name: str, database_name: str
    ) -> Dict[str, List[QueryByProcedure]]:
        """
        Cache the queries ran for the stored procedures in the last `queryLogDuration` days.

        We will run this for each different and db name.

        The dictionary key will be the case-insensitive procedure name.
        """
        results = self.engine.execute(query).all()
        queries_dict = defaultdict(list)

        for row in results:
            try:
                query_by_procedure = QueryByProcedure.parse_obj(dict(row))
                procedure_name = get_procedure_name_from_call(
                    query_text=query_by_procedure.procedure_text,
                    schema_name=schema_name,
                    database_name=database_name,
                )
                queries_dict[procedure_name].append(query_by_procedure)
            except Exception as exc:
                self.status.failed(
                    StackTraceError(
                        name="Stored Procedure",
                        error=f"Error trying to get procedure name due to [{exc}]",
                        stack_trace=traceback.format_exc(),
                    )
                )

        return queries_dict

    @staticmethod
    def is_lineage_query(query_type: str, query_text: str) -> bool:
        """Check if it's worth it to parse the query for lineage"""

        if query_type in ("MERGE", "UPDATE", "CREATE_TABLE_AS_SELECT"):
            return True

        if query_type == "INSERT" and re.search(
            "^.*insert.*into.*select.*$", query_text, re.IGNORECASE
        ):
            return True

        return False

    def yield_procedure_lineage(
        self, query_by_procedure: QueryByProcedure
    ) -> Iterable[Either[AddLineageRequest]]:
        """Add procedure lineage from its query"""

        if self.is_lineage_query(
            query_type=query_by_procedure.query_type,
            query_text=query_by_procedure.query_text,
        ):

            for either_lineage in get_lineage_by_query(
                self.metadata,
                query=query_by_procedure.query_text,
                service_name=self.context.database_service.name.__root__,
                database_name=self.context.database.name.__root__,
                schema_name=self.context.database_schema.name.__root__,
                dialect=ConnectionTypeDialectMapper.dialect_of(
                    self.context.database_service.serviceType.value
                ),
                timeout_seconds=self.source_config.queryParsingTimeoutLimit,
                lineage_source=LineageSource.QueryLineage,
            ):
                if either_lineage.right.edge.lineageDetails:
                    either_lineage.right.edge.lineageDetails.pipeline = EntityReference(
                        id=self.context.stored_procedure.id,
                        type="storedProcedure",
                    )

                yield either_lineage

    def yield_procedure_query(
        self, query_by_procedure: QueryByProcedure
    ) -> Iterable[Either[CreateQueryRequest]]:
        """Check the queries triggered by the procedure and add their lineage, if any"""

        yield Either(
            right=CreateQueryRequest(
                query=SqlQuery(__root__=query_by_procedure.query_text),
                query_type=query_by_procedure.query_type,
                duration=query_by_procedure.query_duration,
                queryDate=Timestamp(
                    __root__=convert_timestamp_to_milliseconds(
                        int(query_by_procedure.query_start_time.timestamp())
                    )
                ),
                triggeredBy=EntityReference(
                    id=self.context.stored_procedure.id,
                    type="storedProcedure",
                ),
                processedLineage=bool(self.context.stored_procedure_query_lineage),
                service=self.context.database_service.name.__root__,
            )
        )
