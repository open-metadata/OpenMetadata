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
import re
import time
import traceback
from copy import deepcopy
from datetime import datetime
from multiprocessing import Queue
from typing import Iterable, List, Optional, Union

import networkx as nx
from pydantic import BaseModel, ConfigDict, Field

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.basic import SqlQuery, Timestamp
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.sql_lineage import get_lineage_by_query
from metadata.ingestion.models.ometa_lineage import OMetaLineageRequest
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.models import TableView
from metadata.utils import fqn
from metadata.utils.db_utils import get_view_lineage
from metadata.utils.logger import ingestion_logger
from metadata.utils.time_utils import datetime_to_timestamp

logger = ingestion_logger()

# pylint: disable=invalid-name


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
    metadata: OpenMetadata,
    service_name: str,
    dialect: Dialect,
    parsingTimeoutLimit: int,
    query_by_procedure: QueryByProcedure,
    procedure: StoredProcedure,
) -> Iterable[Either[AddLineageRequest]]:
    """Add procedure lineage from its query"""
    if is_lineage_query(
        query_type=query_by_procedure.query_type,
        query_text=query_by_procedure.query_text,
    ):
        for either_lineage in get_lineage_by_query(
            metadata,
            query=query_by_procedure.query_text,
            service_name=service_name,
            database_name=query_by_procedure.query_database_name,
            schema_name=query_by_procedure.query_schema_name,
            dialect=dialect,
            timeout_seconds=parsingTimeoutLimit,
            lineage_source=LineageSource.QueryLineage,
        ):
            if either_lineage.left is None and either_lineage.right.edge.lineageDetails:
                either_lineage.right.edge.lineageDetails.pipeline = EntityReference(
                    id=procedure.id,
                    type="storedProcedure",
                )

            yield either_lineage


def procedure_lineage_processor(
    procedure_and_queries: List[ProcedureAndQuery],
    queue: Queue,
    metadata: OpenMetadata,
    service_name: str,
    dialect: Dialect,
    parsingTimeoutLimit: int,
) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:
    """
    Process the procedure and its queries to add lineage
    """
    for procedure_and_query in procedure_and_queries:
        try:
            for lineage in _yield_procedure_lineage(
                query_by_procedure=procedure_and_query.query_by_procedure,
                procedure=procedure_and_query.procedure,
                metadata=deepcopy(metadata),
                service_name=service_name,
                dialect=dialect,
                parsingTimeoutLimit=parsingTimeoutLimit,
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
                f"Could not get lineage for store procedure "
                f"'{procedure_and_query.procedure.fullyQualifiedName}' due to [{exc}]."
            )
        try:
            for lineage in yield_procedure_query(
                query_by_procedure=procedure_and_query.query_by_procedure,
                procedure=procedure_and_query.procedure,
                service_name=service_name,
            ):
                queue.put(lineage)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Could not get query for store procedure "
                f"'{procedure_and_query.procedure.fullyQualifiedName}' due to [{exc}]."
            )


def yield_procedure_query(
    query_by_procedure: QueryByProcedure, procedure: StoredProcedure, service_name: str
) -> Iterable[Either[CreateQueryRequest]]:
    """Check the queries triggered by the procedure and add their lineage, if any"""
    stored_procedure_query_lineage = is_lineage_query(
        query_type=query_by_procedure.query_type,
        query_text=query_by_procedure.query_text,
    )

    yield Either(
        right=CreateQueryRequest(
            query=SqlQuery(query_by_procedure.query_text),
            query_type=query_by_procedure.query_type,
            duration=query_by_procedure.query_duration,
            queryDate=Timestamp(
                root=datetime_to_timestamp(query_by_procedure.query_start_time, True)
            ),
            triggeredBy=EntityReference(
                id=procedure.id,
                type="storedProcedure",
            ),
            processedLineage=bool(stored_procedure_query_lineage),
            service=service_name,
        )
    )


# Function that will run in separate processes - defined at module level for pickling
def _process_chunk_in_subprocess(chunk, processor_fn, queue, *args):
    """
    Process a chunk of data in a subprocess.

    Args:
        chunk_and_processor_fn: Tuple containing (chunk, processor_fn, queue, *args)

    Returns:
        True if processing succeeded, False otherwise
    """
    try:
        # Process each item in the chunk
        processor_fn(chunk, queue, *args)
        time.sleep(0.1)
        return True
    except Exception as e:
        logger.error(f"Error processing chunk in subprocess: {e}")
        logger.error(traceback.format_exc())
        return False


def _query_already_processed(metadata: OpenMetadata, table_query: TableQuery) -> bool:
    """
    Check if a query has already been processed by validating if exists
    in ES with lineageProcessed as True
    """
    checksums = metadata.es_get_queries_with_lineage(
        service_name=table_query.serviceName,
    )
    return fqn.get_query_checksum(table_query.query) in checksums or {}


def query_lineage_generator(
    table_queries: List[TableQuery],
    queue: Queue,
    metadata: OpenMetadata,
    dialect: Dialect,
    graph: nx.DiGraph,
    parsingTimeoutLimit: int,
    serviceName: str,
) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:
    """
    Generate lineage for a list of table queries
    """

    for table_query in table_queries or []:
        if not _query_already_processed(
            metadata=deepcopy(metadata), table_query=table_query
        ):
            lineages: Iterable[Either[AddLineageRequest]] = get_lineage_by_query(
                metadata=deepcopy(metadata),
                query=table_query.query,
                service_name=table_query.serviceName,
                database_name=table_query.databaseName,
                schema_name=table_query.databaseSchema,
                dialect=dialect,
                timeout_seconds=parsingTimeoutLimit,
                graph=graph,
            )

            for lineage_request in lineages or []:
                queue.put(lineage_request)

                # If we identified lineage properly, ingest the original query
                if lineage_request.right:
                    queue.put(
                        Either(
                            right=CreateQueryRequest(
                                query=SqlQuery(table_query.query),
                                query_type=table_query.query_type,
                                duration=table_query.duration,
                                processedLineage=True,
                                service=serviceName,
                            )
                        )
                    )


def view_lineage_generator(
    views: List[TableView],
    queue: Queue,
    metadata: OpenMetadata,
    serviceName: str,
    connectionType: str,
    parsingTimeoutLimit: int,
    overrideViewLineage: bool,
) -> Iterable[Either[AddLineageRequest]]:
    """
    Generate lineage for a list of views
    """
    try:
        for view in views:
            for lineage in get_view_lineage(
                view=view,
                metadata=deepcopy(metadata),
                service_name=serviceName,
                connection_type=connectionType,
                timeout_seconds=parsingTimeoutLimit,
            ):
                if lineage.right is not None:
                    view_fqn = fqn.build(
                        metadata=deepcopy(metadata),
                        entity_type=Table,
                        service_name=serviceName,
                        database_name=view.db_name,
                        schema_name=view.schema_name,
                        table_name=view.table_name,
                        skip_es_search=True,
                    )
                    queue.put(
                        Either(
                            right=OMetaLineageRequest(
                                lineage_request=lineage.right,
                                override_lineage=overrideViewLineage,
                                entity_fqn=view_fqn,
                                entity=Table,
                            )
                        )
                    )
                else:
                    queue.put(lineage)
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(f"Error processing view {view}: {exc}")
