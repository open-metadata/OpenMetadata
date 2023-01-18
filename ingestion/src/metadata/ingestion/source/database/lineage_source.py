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
import traceback
from abc import ABC
from typing import Iterable, Iterator, Optional

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.lineage.models import MAP_CONNECTION_TYPE_DIALECT, Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import (
    get_lineage_by_query,
    get_lineage_via_table_entity,
)
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
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

    def get_table_query(self) -> Optional[Iterator[TableQuery]]:
        """
        If queryLogFilePath available in config iterate through log file
        otherwise execute the sql query to fetch TableQuery data.

        This is a simplified version of the UsageSource query parsing.
        """
        if self.config.sourceConfig.config.queryLogFilePath:
            with open(
                self.config.sourceConfig.config.queryLogFilePath, "r", encoding="utf-8"
            ) as file:
                for row in csv.DictReader(file):
                    query_dict = dict(row)
                    yield TableQuery(
                        query=query_dict["query_text"],
                        databaseName=self.get_database_name(query_dict),
                        serviceName=self.config.serviceName,
                        databaseSchema=self.get_schema_name(query_dict),
                    )

        else:
            logger.info(
                f"Scanning query logs for {self.start.date()} - {self.end.date()}"
            )
            try:
                with get_connection(self.service_connection).connect() as conn:
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
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(f"Source usage processing error: {exc}")

    def get_database_fqns(self):
        """
        List all service databases
        """
        return [
            database.fullyQualifiedName.__root__
            for database in self.metadata.list_all_entities(
                entity=Database,
                params={"service": self.config.serviceName},
            )
        ]

    def get_all_tables_from_api(self) -> Iterable[Table]:
        """
        Get all the views from the API with their viewDefinition
        """
        for database_fqn in self.get_database_fqns():
            logger.info(f"Getting view lineage from {database_fqn}")
            yield from self.metadata.list_all_entities(
                entity=Table,
                fields=[
                    "viewDefinition",
                ],
                params={"service": self.config.serviceName, "database": database_fqn},
            )

    def yield_table_query(self):
        """
        Basic generator getting lineage from
        table queries that we pick up from the
        service database
        """
        logger.info("Processing query history lineage...")
        connection_type = str(self.service_connection.type.value)
        dialect = MAP_CONNECTION_TYPE_DIALECT.get(connection_type, Dialect.ANSI)
        for table_query in self.get_table_query():

            lineages = get_lineage_by_query(
                self.metadata,
                query=table_query.query,
                service_name=table_query.serviceName,
                database_name=table_query.databaseName,
                schema_name=table_query.databaseSchema,
                dialect=dialect,
            )

            for lineage_request in lineages or []:
                yield lineage_request

    def yield_view_ddl(self):
        """
        Obtain the tables' viewDefinition to pick
        up the lineage from its DDL
        """
        logger.info("Processing view lineage...")
        for table_entity in self.get_all_tables_from_api():
            # We only pick up views whose viewDefinition is informed
            if (
                table_entity.tableType in {TableType.View, TableType.MaterializedView}
                and table_entity.viewDefinition
                and table_entity.viewDefinition.__root__
            ):

                try:
                    connection_type = str(self.service_connection.type.value)
                    dialect = MAP_CONNECTION_TYPE_DIALECT.get(
                        connection_type, Dialect.ANSI
                    )
                    lineage_parser = LineageParser(
                        table_entity.viewDefinition.__root__, dialect=dialect
                    )
                    if lineage_parser.source_tables and lineage_parser.target_tables:
                        yield from get_lineage_by_query(
                            self.metadata,
                            query=table_entity.viewDefinition.__root__,
                            service_name=self.config.serviceName,
                            database_name=table_entity.database.name,
                            schema_name=table_entity.databaseSchema.name,
                            dialect=dialect,
                        ) or []

                    else:
                        yield from get_lineage_via_table_entity(
                            self.metadata,
                            table_entity=table_entity,
                            service_name=self.config.serviceName,
                            database_name=table_entity.database.name,
                            schema_name=table_entity.databaseSchema.name,
                            query=table_entity.viewDefinition.__root__,
                            dialect=dialect,
                        ) or []

                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Could not parse query [{table_entity.viewDefinition.__root__}]."
                        f" Ingesting lineage failed due to: {exc}"
                    )

    def next_record(self) -> Iterable[AddLineageRequest]:
        """
        Based on the query logs, prepare the lineage
        and send it to the sink
        """
        yield from self.yield_table_query()
        yield from self.yield_view_ddl()
