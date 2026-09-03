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
from collections.abc import Iterable
from datetime import datetime
from multiprocessing import Queue

import networkx as nx
from pydantic import BaseModel, ConfigDict, Field

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.metadataIngestion.parserconfig.queryParserConfig import (
    QueryParserType,
)
from metadata.generated.schema.type.basic import SqlQuery, Timestamp
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.models import Dialect
from metadata.ingestion.lineage.sql_lineage import get_lineage_by_query
from metadata.ingestion.models.ometa_lineage import (
    LineageRequest,
    OMetaFQNLineageRequest,
    OMetaLineageRequest,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.models import TableView
from metadata.utils import fqn
from metadata.utils.db_utils import ViewLineageExtension, get_view_lineage
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
    query_database_name: str | None = Field(None, alias="QUERY_DATABASE_NAME")
    query_schema_name: str | None = Field(None, alias="QUERY_SCHEMA_NAME")
    procedure_text: str = Field(..., alias="PROCEDURE_TEXT")
    procedure_start_time: datetime = Field(..., alias="PROCEDURE_START_TIME")
    procedure_end_time: datetime = Field(..., alias="PROCEDURE_END_TIME")
    query_start_time: datetime | None = Field(None, alias="QUERY_START_TIME")
    query_duration: float | None = Field(None, alias="QUERY_DURATION")
    query_text: str = Field(..., alias="QUERY_TEXT")
    query_user_name: str | None = Field(None, alias="QUERY_USER_NAME")

    model_config = ConfigDict(populate_by_name=True)


class ProcedureAndQuery(BaseModel):
    """
    Model to hold the procedure and its queries
    """

    procedure: StoredProcedure
    query_by_procedure: QueryByProcedure

    model_config = ConfigDict(populate_by_name=True)


class ProcedureAndProcedureGraph(BaseModel):
    """
    Model to hold the procedure and its graph
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    procedure: StoredProcedure
    graph: nx.DiGraph


def is_lineage_query(query_type: str, query_text: str) -> bool:
    """Check if it's worth it to parse the query for lineage"""

    logger.debug(f"Validating query lineage for type [{query_type}] and text [{query_text}]")

    if query_type in ("MERGE", "UPDATE", "CREATE_TABLE_AS_SELECT"):
        return True

    if query_type == "INSERT" and re.search("^.*insert.*into.*select.*$", query_text.replace("\n", " "), re.IGNORECASE):  # noqa: SIM103
        return True

    return False


def _yield_procedure_lineage(
    metadata: OpenMetadata,
    service_name: str,
    dialect: Dialect,
    processCrossDatabaseLineage: bool,  # noqa: N803
    crossDatabaseServiceNames: list[str],  # noqa: N803
    parsingTimeoutLimit: int,  # noqa: N803
    query_by_procedure: QueryByProcedure,
    procedure: StoredProcedure,
    procedure_graph_map: dict[str, ProcedureAndProcedureGraph],
    enableTempTableLineage: bool,  # noqa: N803
    parser_type: QueryParserType,
) -> Iterable[Either[LineageRequest]]:
    """Add procedure lineage from its query"""
    graph = None
    if enableTempTableLineage:
        if not procedure_graph_map.get(procedure.fullyQualifiedName.root):
            # Map to store the directed graph for each procedure with its FQN as key
            procedure_graph_map[procedure.fullyQualifiedName.root] = ProcedureAndProcedureGraph(
                procedure=procedure, graph=nx.DiGraph()
            )

        graph = procedure_graph_map.get(procedure.fullyQualifiedName.root).graph

    # Prepare service names for lineage processing
    service_names = [service_name]
    if processCrossDatabaseLineage and crossDatabaseServiceNames:
        service_names.extend(crossDatabaseServiceNames)

    if is_lineage_query(
        query_type=query_by_procedure.query_type,
        query_text=query_by_procedure.query_text,
    ):
        for either_lineage in get_lineage_by_query(
            metadata,
            query=query_by_procedure.query_text,
            service_names=service_names,
            database_name=query_by_procedure.query_database_name,
            schema_name=query_by_procedure.query_schema_name,
            dialect=dialect,
            timeout_seconds=parsingTimeoutLimit,
            lineage_source=LineageSource.QueryLineage,
            graph=graph,
            parser_type=parser_type,
        ):
            if either_lineage.left is None and either_lineage.right:
                if isinstance(either_lineage.right, OMetaFQNLineageRequest):
                    lineage_details = either_lineage.right.lineage_details
                else:
                    lineage_details = either_lineage.right.edge.lineageDetails
                if lineage_details:
                    lineage_details.pipeline = EntityReference.model_validate(
                        {
                            "id": procedure.id,
                            "type": "storedProcedure",
                        }
                    )

            yield either_lineage


def procedure_lineage_processor(
    procedure_and_queries: list[ProcedureAndQuery],
    queue: Queue,
    metadata: OpenMetadata,
    service_name: str,
    dialect: Dialect,
    processCrossDatabaseLineage: bool,  # noqa: N803
    crossDatabaseServiceNames: list[str],  # noqa: N803
    parsingTimeoutLimit: int,  # noqa: N803
    procedure_graph_map: dict[str, ProcedureAndProcedureGraph],
    enableTempTableLineage: bool,  # noqa: N803
    parser_type: QueryParserType,
) -> None:
    """
    Process the procedure and its queries to add lineage
    """
    for procedure_and_query in procedure_and_queries:
        try:
            for lineage in _yield_procedure_lineage(
                query_by_procedure=procedure_and_query.query_by_procedure,
                procedure=procedure_and_query.procedure,
                metadata=metadata,
                service_name=service_name,
                dialect=dialect,
                processCrossDatabaseLineage=processCrossDatabaseLineage,
                crossDatabaseServiceNames=crossDatabaseServiceNames,
                parsingTimeoutLimit=parsingTimeoutLimit,
                procedure_graph_map=procedure_graph_map,
                enableTempTableLineage=enableTempTableLineage,
                parser_type=parser_type,
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
            queryDate=Timestamp(root=datetime_to_timestamp(query_by_procedure.query_start_time, True)),
            triggeredBy=EntityReference(
                id=procedure.id,
                type="storedProcedure",
            ),
            processedLineage=bool(stored_procedure_query_lineage),
            service=service_name,
        )
    )


# Function that will run in separate processes - defined at module level for pickling
def process_chunk_in_subprocess(chunk, processor_fn, queue, *args):
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
        return True  # noqa: TRY300
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


def query_lineage_processor(
    table_queries: list[TableQuery],
    queue: Queue,
    metadata: OpenMetadata,
    dialect: Dialect,
    graph: nx.DiGraph,
    processCrossDatabaseLineage: bool,  # noqa: N803
    crossDatabaseServiceNames: list[str],  # noqa: N803
    parsingTimeoutLimit: int,  # noqa: N803
    serviceName: str,  # noqa: N803
    parser_type: QueryParserType,
) -> None:
    """
    Generate lineage for a list of table queries
    """

    for table_query in table_queries or []:
        if not _query_already_processed(metadata, table_query):
            # Prepare service names for lineage processing
            service_names = [table_query.serviceName]
            if processCrossDatabaseLineage and crossDatabaseServiceNames:
                service_names.extend(crossDatabaseServiceNames)

            lineages: Iterable[Either[LineageRequest]] = get_lineage_by_query(
                metadata,
                query=table_query.query,
                service_names=service_names,
                database_name=table_query.databaseName,
                schema_name=table_query.databaseSchema,
                dialect=dialect,
                timeout_seconds=parsingTimeoutLimit,
                graph=graph,
                parser_type=parser_type,
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


def _writes_into_view(lineage_request: LineageRequest, view_fqn: str | None) -> bool:
    """
    Whether a view lineage edge points at the view being processed.

    `overrideViewLineage` deletes the existing view lineage of the entity an edge points
    at before writing it. That is only safe while the edge points at the view itself:
    an edge into another table -- a Clickhouse materialized view writing into its
    `TO` target, for instance -- would wipe the lineage that the sibling views writing
    into that same table just created.

    Edges whose target FQN is unknown -- and views whose own FQN could not be built --
    keep the previous behaviour of honouring the flag.
    """
    if not view_fqn:
        return True
    if isinstance(lineage_request, OMetaFQNLineageRequest):
        target_fqn = lineage_request.to_entity_fqn
    else:
        target_fqn = lineage_request.edge.toEntity.fullyQualifiedName
    if not target_fqn:
        return True
    return model_str(target_fqn).lower() == view_fqn.lower()


def view_lineage_processor(
    views: list[TableView],
    queue: Queue,
    metadata: OpenMetadata,
    service_name: str,
    connectionType: str,  # noqa: N803
    processCrossDatabaseLineage: bool,  # noqa: N803
    crossDatabaseServiceNames: list[str],  # noqa: N803
    parsingTimeoutLimit: int,  # noqa: N803
    overrideViewLineage: bool,  # noqa: N803
    parser_type: QueryParserType,
    extension: ViewLineageExtension | None = None,
) -> None:
    """
    Generate lineage for a list of views
    """
    try:
        for view in views:
            # Prepare service names for lineage processing
            service_names = [service_name]
            if processCrossDatabaseLineage and crossDatabaseServiceNames:
                service_names.extend(crossDatabaseServiceNames)

            for lineage in get_view_lineage(
                view=view,
                metadata=metadata,
                service_names=service_names,
                connection_type=connectionType,
                timeout_seconds=parsingTimeoutLimit,
                parser_type=parser_type,
                extension=extension,
            ):
                if lineage.right is not None:
                    view_fqn = fqn.build(
                        metadata=metadata,
                        entity_type=Table,
                        service_name=service_name,
                        database_name=view.db_name,
                        schema_name=view.schema_name,
                        table_name=view.table_name,
                        skip_es_search=True,
                    )
                    queue.put(
                        Either(
                            right=OMetaLineageRequest(
                                lineage_request=lineage.right,
                                override_lineage=(overrideViewLineage and _writes_into_view(lineage.right, view_fqn)),
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
