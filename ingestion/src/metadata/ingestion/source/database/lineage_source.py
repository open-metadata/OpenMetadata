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
import traceback
from abc import ABC
from typing import Iterable, Iterator, Union

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, SqlQuery
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.api.models import Either
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper
from metadata.ingestion.lineage.sql_lineage import (
    get_lineage_by_graph,
    get_lineage_by_query,
)
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


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

    def yield_table_queries_from_logs(self) -> Iterator[TableQuery]:
        """
        Method to handle the usage from query logs
        """
        try:
            query_log_path = self.config.sourceConfig.config.queryLogFilePath
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

    def _iter(
        self, *_, **__
    ) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:
        """
        Based on the query logs, prepare the lineage
        and send it to the sink
        """
        connection_type = str(self.service_connection.type.value)
        dialect = ConnectionTypeDialectMapper.dialect_of(connection_type)
        import networkx as nx

        # Create a directed graph
        graph = nx.DiGraph()
        for table_query in self.get_table_query():
            if not self._query_already_processed(table_query):
                lineages: Iterable[Either[AddLineageRequest]] = get_lineage_by_query(
                    self.metadata,
                    query=table_query.query,
                    service_name=table_query.serviceName,
                    database_name=table_query.databaseName,
                    schema_name=table_query.databaseSchema,
                    dialect=dialect,
                    timeout_seconds=self.source_config.parsingTimeoutLimit,
                    graph=graph,
                )

                for lineage_request in lineages or []:
                    yield lineage_request

                    # If we identified lineage properly, ingest the original query
                    if lineage_request.right:
                        yield Either(
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
        yield from get_lineage_by_graph(graph=graph)
