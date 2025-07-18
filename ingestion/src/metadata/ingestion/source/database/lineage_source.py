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
Lineage Source Module
"""
import csv
import os
import time
import traceback
from abc import ABC
from functools import partial
from typing import Any, Callable, Iterable, Iterator, List, Optional, Tuple, Union

import billiard
import networkx as nx
from billiard import Process, Queue

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.type.basic import Uuid
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
    Source,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper, Dialect
from metadata.ingestion.lineage.sql_lineage import get_column_fqn, get_lineage_by_graph
from metadata.ingestion.models.ometa_lineage import OMetaLineageRequest
from metadata.ingestion.source.database.lineage_processors import (
    _process_chunk_in_subprocess,
    query_lineage_generator,
    view_lineage_generator,
)
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.ingestion.source.models import TableView
from metadata.utils import fqn
from metadata.utils.db_utils import get_view_lineage
from metadata.utils.filters import filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


CHUNK_SIZE = 200

THREAD_TIMEOUT = 10 * 60
PROCESS_TIMEOUT = 10 * 60
# Maximum number of processes to use for parallel processing
MAX_PROCESSES = min(billiard.cpu_count(), 8)  # Limit to 8 or available CPUs


class LineageSource(QueryParserSource, ABC):
    """
    This is the base source to handle Lineage-only ingestion.

    We will still use TableQuery as the data, but only fill up those elements
    that are truly required for the lineage use case, such as:
    - query
    - service
    - database
    - schema
    """

    dialect: Dialect

    def yield_table_queries_from_logs(self) -> Iterator[TableQuery]:
        """
        Method to handle the usage from query logs
        """
        try:
            query_log_path = self.source_config.queryLogFilePath
            if os.path.isfile(query_log_path):
                file_paths = [query_log_path]
            elif os.path.isdir(query_log_path):
                file_paths = [
                    os.path.join(query_log_path, f)
                    for f in os.listdir(query_log_path)
                    if f.endswith(".csv")
                ]
            else:
                raise ValueError(f"{query_log_path} is neither a file nor a directory.")

            for file_path in file_paths:
                with open(file_path, "r", encoding="utf-8") as file:
                    for row in csv.DictReader(file):
                        query_dict = dict(row)
                        yield TableQuery(
                            query=query_dict["query_text"],
                            databaseName=self.get_database_name(query_dict),
                            serviceName=self.config.serviceName,
                            databaseSchema=self.get_schema_name(query_dict),
                        )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to read queries form log file due to: {err}")

    def get_table_query(self) -> Iterator[TableQuery]:
        """
        If queryLogFilePath available in config iterate through log file
        otherwise execute the sql query to fetch TableQuery data.

        This is a simplified version of the UsageSource query parsing.
        """
        if self.config.sourceConfig.config.queryLogFilePath:
            yield from self.yield_table_queries_from_logs()
        else:
            logger.info(
                f"Scanning query logs for {self.start.date()} - {self.end.date()}"
            )
            yield from self.yield_table_query()

    @staticmethod
    def generate_lineage_with_processes(
        producer_fn: Callable[[], Iterable[Any]],
        processor_fn: Callable[[Any, Queue], None],
        args: Tuple[Any, ...],
        chunk_size: int = CHUNK_SIZE,
        processor_timeout: int = PROCESS_TIMEOUT,
    ):
        """
        Process data in separate processes with timeout control.

        Args:
            producer_fn: Function that yields data chunks
            processor_fn: Function that processes data and adds results to the queue
            chunk_size: Size of chunks to process
            processor_timeout: Maximum time in seconds to wait for a processor process
        """

        def chunk_generator():
            """Group items from producer into chunks of specified size."""
            chunk_index = 1
            temp_chunk = []
            for item in producer_fn():
                temp_chunk.append(item)
                if len(temp_chunk) >= chunk_size:
                    logger.info(
                        f"Processing chunk {chunk_index}: size={len(temp_chunk)}"
                    )
                    yield temp_chunk
                    temp_chunk = []
                    chunk_index += 1
            if temp_chunk:
                logger.info(
                    f"Processing final chunk {chunk_index}: size={len(temp_chunk)}"
                )
                yield temp_chunk

        # Use multiprocessing Queue for lineage requests
        queue = Queue()

        # Create chunk iterator and tracking
        chunk_iter = iter(chunk_generator())
        chunks_exhausted = False

        active_processes = []
        process_start_times = {}
        completed_chunks = 0
        total_started = 0

        logger.info(f"Starting lineage processing with MAX_PROCESSES={MAX_PROCESSES}")

        def start_next_process():
            """Start the next pending process if available."""
            nonlocal total_started

            # Try to get the next chunk for next time
            try:
                chunk = next(chunk_iter)
            except StopIteration:
                # No more chunks to process
                return False

            # Use billiard.Process to handle the multiprocessing instead of the
            # multiprocessing.Process since spawning child process from daemon
            # process is not supported in Airflow 2+.
            # Billiard is a fork of multiprocessing that is compatible with Airflow
            # and recommended by the Airflow team.
            # ref: https://github.com/apache/airflow/issues/14896
            total_started += 1
            process = Process(
                target=_process_chunk_in_subprocess,
                args=(chunk, processor_fn, queue, *args),
            )
            process.daemon = True
            process_start_times[process.name] = time.time()
            logger.info(
                f"Started lineage process {process.name} for chunk {total_started} "
                f"(active: {len(active_processes) + 1}/{MAX_PROCESSES}, chunk_size: {len(chunk)})"
            )
            active_processes.append(process)
            process.start()

            return True

        # Process requests from the queue and check for completed or timed-out processes
        while active_processes or not chunks_exhausted or not queue.empty():
            # Process any available requests from the queue
            try:
                while not queue.empty():
                    yield queue.get_nowait()
            except Exception as exc:
                logger.warning(f"Error processing queue: {exc}")
                logger.debug(traceback.format_exc())

            # Check for completed or timed-out processes
            still_active = []
            for process in active_processes:
                if process.is_alive():
                    # Check if the process has timed out
                    if (
                        time.time() - process_start_times[process.name]
                        > processor_timeout
                    ):
                        logger.warning(
                            f"Process {process.name} timed out after {processor_timeout}s"
                        )
                        process.terminate()  # Force terminate the timed out process
                        completed_chunks += 1
                    else:
                        still_active.append(process)
                else:
                    # Clean up completed process
                    process.join()
                    completed_chunks += 1
                    runtime = time.time() - process_start_times[process.name]
                    logger.info(
                        f"Lineage process {process.name} completed successfully "
                        f"(runtime: {runtime:.1f}s, progress: {completed_chunks}/{total_started})"
                    )

            active_processes = still_active

            # Start initial/next processes to fill available slots
            while len(active_processes) < MAX_PROCESSES:
                if start_next_process():
                    continue
                chunks_exhausted = True
                break

            # Small pause to prevent CPU spinning
            if active_processes or not chunks_exhausted:
                time.sleep(0.1)

        # Final check for any remaining queue requests
        try:
            while not queue.empty():
                yield queue.get_nowait()
        except Exception as exc:
            logger.warning(f"Error processing queue: {exc}")
            logger.debug(traceback.format_exc())

        logger.info(
            f"Lineage processing completed with {completed_chunks}/{total_started} chunks processed"
        )

    def yield_table_query(self) -> Iterator[TableQuery]:
        """
        Given an engine, iterate over the query results to
        yield a TableQuery with query parsing info
        """
        for engine in self.get_engine():
            with engine.connect() as conn:
                rows = conn.execute(
                    self.get_sql_statement(
                        start_time=self.start,
                        end_time=self.end,
                    )
                )
                for row in rows:
                    query_dict = dict(row)
                    try:
                        query_dict.update({k.lower(): v for k, v in query_dict.items()})
                        yield TableQuery(
                            dialect=self.dialect.value,
                            query=query_dict["query_text"],
                            databaseName=self.get_database_name(query_dict),
                            serviceName=self.config.serviceName,
                            databaseSchema=self.get_schema_name(query_dict),
                        )
                    except Exception as exc:
                        logger.debug(traceback.format_exc())
                        logger.warning(
                            f"Error processing query_dict {query_dict}: {exc}"
                        )

    def yield_query_lineage(
        self,
    ) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:
        """
        Based on the query logs, prepare the lineage
        and send it to the sink
        """
        logger.info("Processing Query Lineage")
        connection_type = str(self.service_connection.type.value)
        self.dialect = ConnectionTypeDialectMapper.dialect_of(connection_type)
        producer_fn = self.get_table_query
        processor_fn = query_lineage_generator
        args = (
            self.metadata,
            self.dialect,
            self.graph,
            self.source_config.parsingTimeoutLimit,
            self.config.serviceName,
        )
        yield from self.generate_lineage_with_processes(
            producer_fn,
            processor_fn,
            args,
        )

    def view_lineage_generator(
        self, views: List[TableView], queue: Queue
    ) -> Iterable[Either[AddLineageRequest]]:
        try:
            for view in views:
                if filter_by_table(
                    self.source_config.tableFilterPattern,
                    view.table_name,
                ):
                    self.status.filter(
                        view.table_name,
                        "View Filtered Out",
                    )
                    continue
                for lineage in get_view_lineage(
                    view=view,
                    metadata=self.metadata,
                    service_name=self.config.serviceName,
                    connection_type=self.service_connection.type.value,
                    timeout_seconds=self.source_config.parsingTimeoutLimit,
                ):
                    if lineage.right is not None:
                        view_fqn = fqn.build(
                            metadata=self.metadata,
                            entity_type=Table,
                            service_name=self.service_name,
                            database_name=view.db_name,
                            schema_name=view.schema_name,
                            table_name=view.table_name,
                            skip_es_search=True,
                        )
                        queue.put(
                            Either(
                                right=OMetaLineageRequest(
                                    lineage_request=lineage.right,
                                    override_lineage=self.source_config.overrideViewLineage,
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

    def yield_view_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        logger.info("Processing View Lineage")
        producer_fn = partial(
            self.metadata.yield_es_view_def,
            self.config.serviceName,
            self.source_config.incrementalLineageProcessing,
        )
        processor_fn = view_lineage_generator
        args = (
            self.metadata,
            self.config.serviceName,
            self.service_connection.type.value,
            self.source_config.parsingTimeoutLimit,
            self.source_config.overrideViewLineage,
        )
        yield from self.generate_lineage_with_processes(producer_fn, processor_fn, args)

    def yield_procedure_lineage(
        self,
    ) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:
        """
        By default stored   procedure lineage is not supported.
        """
        logger.info(
            f"Processing Procedure Lineage not supported for {str(self.service_connection.type.value)}"
        )

    def get_column_lineage(
        self, from_table: Table, to_table: Table
    ) -> List[ColumnLineage]:
        """
        Get the column lineage from the fields
        """
        try:
            column_lineage = []
            for column in from_table.columns:
                field = column.name.root
                from_column = get_column_fqn(table_entity=from_table, column=field)
                to_column = get_column_fqn(table_entity=to_table, column=field)
                if from_column and to_column:
                    column_lineage.append(
                        ColumnLineage(fromColumns=[from_column], toColumn=to_column)
                    )

            return column_lineage
        except Exception as exc:
            logger.debug(f"Error to get column lineage: {exc}")
            logger.debug(traceback.format_exc())
        return []

    def get_add_cross_database_lineage_request(
        self,
        from_entity: Table,
        to_entity: Table,
        column_lineage: List[ColumnLineage] = None,
    ) -> Optional[Either[AddLineageRequest]]:
        """
        Get the add cross database lineage request
        """
        if from_entity and to_entity:
            return Either(
                right=AddLineageRequest(
                    edge=EntitiesEdge(
                        fromEntity=EntityReference(
                            id=Uuid(from_entity.id.root), type="table"
                        ),
                        toEntity=EntityReference(
                            id=Uuid(to_entity.id.root), type="table"
                        ),
                        lineageDetails=LineageDetails(
                            source=Source.CrossDatabaseLineage,
                            columnsLineage=column_lineage,
                        ),
                    )
                )
            )

        return None

    def yield_cross_database_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        """
        By default cross database lineage is not supported.
        """
        logger.info(
            f"Processing Cross Database Lineage not supported for {str(self.service_connection.type.value)}"
        )

    def _iter(
        self, *_, **__
    ) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:
        """
        Based on the query logs, prepare the lineage
        and send it to the sink
        """
        if self.graph is None and self.source_config.enableTempTableLineage:
            # Create a directed graph
            self.graph = nx.DiGraph()
        if self.source_config.processViewLineage:
            yield from self.yield_view_lineage() or []
        if self.source_config.processStoredProcedureLineage:
            yield from self.yield_procedure_lineage() or []
        if self.source_config.processQueryLineage:
            if hasattr(self.service_connection, "supportsLineageExtraction"):
                yield from self.yield_query_lineage() or []
                yield from get_lineage_by_graph(
                    graph=self.graph, metadata=self.metadata
                )
            else:
                logger.warning(
                    f"Lineage extraction is not supported for {str(self.service_connection.type.value)} connection"
                )
        if (
            self.source_config.processCrossDatabaseLineage
            and self.source_config.crossDatabaseServiceNames
        ):
            yield from self.yield_cross_database_lineage() or []
