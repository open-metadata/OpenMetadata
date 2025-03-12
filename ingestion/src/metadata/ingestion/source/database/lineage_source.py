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
Lineage Source Module
"""
import csv
import os
import time
import traceback
from abc import ABC
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from typing import Any, Callable, Iterable, Iterator, List, Union

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, SqlQuery
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper, Dialect
from metadata.ingestion.lineage.sql_lineage import (
    get_lineage_by_graph,
    get_lineage_by_query,
)
from metadata.ingestion.models.ometa_lineage import OMetaLineageRequest
from metadata.ingestion.models.topology import Queue
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.ingestion.source.models import TableView
from metadata.utils import fqn
from metadata.utils.db_utils import get_view_lineage
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


CHUNK_SIZE = 200


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

    def generate_lineage_in_thread(
        self,
        producer_fn: Callable[[], Iterable[Any]],
        processor_fn: Callable[[Any], Iterable[Any]],
        chunk_size: int = CHUNK_SIZE,
    ):
        """
        Optimized multithreaded lineage generation with improved error handling and performance.

        Args:
            producer_fn: Function that yields input items
            processor_fn: Function to process each input item
            chunk_size: Optional batching to reduce thread creation overhead
        """

        def chunk_generator():
            temp_chunk = []
            for chunk in producer_fn():
                temp_chunk.append(chunk)
                if len(temp_chunk) >= chunk_size:
                    yield temp_chunk
                    temp_chunk = []

            if temp_chunk:
                yield temp_chunk

        thread_pool = ThreadPoolExecutor(max_workers=self.source_config.threads)
        queue = Queue()

        futures = [
            thread_pool.submit(
                processor_fn,
                chunk,
                queue,
            )
            for chunk in chunk_generator()
        ]
        while True:
            if queue.has_tasks():
                yield from queue.process()

            else:
                if not futures:
                    break

                for i, future in enumerate(futures):
                    if future.done():
                        future.result()
                        futures.pop(i)

            time.sleep(0.01)

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

    def _query_already_processed(self, table_query: TableQuery) -> bool:
        """
        Check if a query has already been processed by validating if exists
        in ES with lineageProcessed as True
        """
        checksums = self.metadata.es_get_queries_with_lineage(
            service_name=table_query.serviceName,
        )
        return fqn.get_query_checksum(table_query.query) in checksums or {}

    def query_lineage_generator(
        self, table_queries: List[TableQuery], queue: Queue
    ) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:
        if self.graph is None and self.source_config.enableTempTableLineage:
            import networkx as nx

            # Create a directed graph
            self.graph = nx.DiGraph()

        for table_query in table_queries or []:
            if not self._query_already_processed(table_query):
                lineages: Iterable[Either[AddLineageRequest]] = get_lineage_by_query(
                    self.metadata,
                    query=table_query.query,
                    service_name=table_query.serviceName,
                    database_name=table_query.databaseName,
                    schema_name=table_query.databaseSchema,
                    dialect=self.dialect,
                    timeout_seconds=self.source_config.parsingTimeoutLimit,
                    graph=self.graph,
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
                                    service=FullyQualifiedEntityName(
                                        self.config.serviceName
                                    ),
                                )
                            )
                        )

    def yield_query_lineage(
        self,
    ) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:
        """
        Based on the query logs, prepare the lineage
        and send it to the sink
        """
        connection_type = str(self.service_connection.type.value)
        self.dialect = ConnectionTypeDialectMapper.dialect_of(connection_type)
        producer_fn = self.get_table_query
        processor_fn = self.query_lineage_generator
        yield from self.generate_lineage_in_thread(
            producer_fn, processor_fn, CHUNK_SIZE
        )

    def view_lineage_generator(
        self, views: List[TableView], queue: Queue
    ) -> Iterable[Either[AddLineageRequest]]:
        try:
            for view in views:
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
        processor_fn = self.view_lineage_generator
        yield from self.generate_lineage_in_thread(producer_fn, processor_fn)

    def yield_procedure_lineage(
        self,
    ) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:
        """
        By default stored procedure lineage is not supported.
        """
        logger.info(
            f"Processing Procedure Lineage not supported for {str(self.service_connection.type.value)}"
        )

    def _iter(
        self, *_, **__
    ) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:
        """
        Based on the query logs, prepare the lineage
        and send it to the sink
        """
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
