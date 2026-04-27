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
Trino lineage module
"""

import traceback
from typing import Dict, Iterable, Iterator, List, Optional

from sqlalchemy import text

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.trino.queries import TRINO_SQL_STATEMENT
from metadata.ingestion.source.database.trino.query_parser import (
    TRINO_QUERY_BATCH_SIZE,
    TrinoQueryParserSource,
)
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class TrinoLineageSource(TrinoQueryParserSource, LineageSource):
    """
    Trino class for Lineage
    """

    sql_stmt = TRINO_SQL_STATEMENT

    filters = """
        AND (
            lower("query") LIKE '%%create%%table%%as%%select%%'
            OR lower("query") LIKE '%%insert%%into%%select%%'
            OR lower("query") LIKE '%%update%%'
            OR lower("query") LIKE '%%merge%%'
        )
    """

    def yield_table_query(self) -> Iterator[TableQuery]:
        """
        Given an engine, iterate over the query results to
        yield a TableQuery with query parsing info with pagination
        """
        for engine in self.get_engine():
            offset = 0
            total_fetched = 0
            max_results = self.source_config.resultLimit
            while total_fetched < max_results:
                batch_size = min(TRINO_QUERY_BATCH_SIZE, max_results - total_fetched)
                row_count = 0
                with engine.connect() as conn:
                    sql_statement = self.get_sql_statement(
                        start_time=self.start,
                        end_time=self.end,
                        offset=offset,
                        limit=batch_size,
                    )
                    logger.debug(f"Executing lineage query: {sql_statement}")
                    rows = conn.execute(text(sql_statement))
                    for row in rows:
                        query_dict = row._asdict()
                        query_dict.update({k.lower(): v for k, v in query_dict.items()})
                        row_count += 1
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
                            logger.warning(f"Error processing query_dict {query_dict}: {exc}")
                total_fetched += row_count
                if row_count < batch_size:
                    break
                offset += batch_size
                logger.info(
                    f"Fetching next page with offset {offset} (fetched {total_fetched}/{max_results}) "
                    f"for lineage queries"
                )

    def get_cross_database_fqn_from_service_names(self) -> List[str]:
        database_service_names = self.source_config.crossDatabaseServiceNames
        return [
            database.fullyQualifiedName.root
            for service in database_service_names
            for database in self.metadata.list_all_entities(entity=Database, params={"service": service})
        ]

    def check_same_table(self, table1: Table, table2: Table) -> bool:
        """
        Method to check whether the table1 and table2 are same
        """
        if table1.name.root.lower() != table2.name.root.lower():
            return False

        if not table1.columns and not table2.columns:
            return True

        if not table1.columns or not table2.columns:
            return False
        return {column.name.root.lower() for column in table1.columns} == {
            column.name.root.lower() for column in table2.columns
        }

    def _get_cross_database_schema_fqn(
        self,
        cross_database_fqn: str,
        trino_table: Table,
        cross_database_schema_mapping: Dict[str, Dict[str, str]],
    ) -> Optional[str]:
        trino_schema_name = None
        if trino_table.databaseSchema and trino_table.databaseSchema.name:
            trino_schema_name = trino_table.databaseSchema.name.root

        if not trino_schema_name and trino_table.fullyQualifiedName and trino_table.fullyQualifiedName.root:
            trino_table_fqn_parts = fqn.split(trino_table.fullyQualifiedName.root)
            if len(trino_table_fqn_parts) >= 4:
                trino_schema_name = trino_table_fqn_parts[-2]

        if not trino_schema_name:
            return None

        if cross_database_fqn not in cross_database_schema_mapping:
            cross_database_schema_mapping[cross_database_fqn] = {}

        cross_database_schema_fqn = cross_database_schema_mapping[cross_database_fqn].get(trino_schema_name.lower())
        if cross_database_schema_fqn:
            return cross_database_schema_fqn

        cross_database_fqn_parts = fqn.split(cross_database_fqn)
        if len(cross_database_fqn_parts) == 2:
            cross_database_service_name, cross_database_name = cross_database_fqn_parts
            cross_database_schemas = fqn.search_database_schema_from_es(
                metadata=self.metadata,
                database_name=cross_database_name,
                schema_name=trino_schema_name,
                service_name=cross_database_service_name,
                fetch_multiple_entities=True,
                fields="fullyQualifiedName,name",
            )
            if cross_database_schemas:
                for cross_database_schema in cross_database_schemas:
                    if cross_database_schema.name and cross_database_schema.fullyQualifiedName:
                        cross_database_schema_mapping[cross_database_fqn][cross_database_schema.name.root.lower()] = (
                            cross_database_schema.fullyQualifiedName.root
                        )

        return (
            cross_database_schema_mapping[cross_database_fqn].get(trino_schema_name.lower())
            or f"{cross_database_fqn}.{fqn.quote_name(trino_schema_name)}"
        )

    def _get_case_insensitive_cross_database_table(
        self,
        cross_database_schema_fqn: str,
        trino_table: Table,
        cross_database_table_schema_mapping: Dict[str, Dict[str, List[Table]]],
    ) -> Optional[Table]:
        if cross_database_schema_fqn not in cross_database_table_schema_mapping:
            cross_database_table_schema_mapping[cross_database_schema_fqn] = {}

        table_key = trino_table.name.root.lower()
        if table_key not in cross_database_table_schema_mapping[cross_database_schema_fqn]:
            cross_database_table_schema_mapping[cross_database_schema_fqn][table_key] = []
            cross_database_schema_fqn_parts = fqn.split(cross_database_schema_fqn)
            if len(cross_database_schema_fqn_parts) == 3:
                (
                    cross_database_service_name,
                    cross_database_name,
                    cross_database_schema_name,
                ) = cross_database_schema_fqn_parts
                cross_database_tables = fqn.search_table_from_es(
                    metadata=self.metadata,
                    database_name=cross_database_name,
                    schema_name=cross_database_schema_name,
                    service_name=cross_database_service_name,
                    table_name=table_key,
                    fetch_multiple_entities=True,
                    fields="fullyQualifiedName,name,columns,databaseSchema",
                )
                if cross_database_tables:
                    cross_database_table_schema_mapping[cross_database_schema_fqn][table_key] = cross_database_tables

        for cross_database_table in cross_database_table_schema_mapping[cross_database_schema_fqn].get(table_key, []):
            if self.check_same_table(trino_table, cross_database_table):
                return cross_database_table

        return None

    def get_cross_database_lineage(self, from_table: Table, to_table: Table) -> Either[AddLineageRequest]:
        """
        Method to return cross database lineage request object
        """
        column_lineage = None
        if from_table and from_table.columns and to_table and to_table.columns:
            column_lineage = self.get_column_lineage(from_table=from_table, to_table=to_table)
        return self.get_add_cross_database_lineage_request(
            from_entity=from_table, to_entity=to_table, column_lineage=column_lineage
        )

    def _get_cross_database_lineage_for_table(
        self,
        trino_database_fqn: str,
        trino_table: Table,
        *,
        all_cross_database_fqns: List[str],
        cross_database_table_fqn_mapping: Dict[str, Optional[Table]],
        cross_database_schema_fqn_mapping: Dict[str, Dict[str, str]],
        cross_database_table_schema_mapping: Dict[str, Dict[str, List[Table]]],
    ) -> Optional[Either[AddLineageRequest]]:
        trino_table_fqn = trino_table.fullyQualifiedName.root
        trino_database_prefix = f"{trino_database_fqn}."
        if not trino_table_fqn.startswith(trino_database_prefix):
            return None

        trino_table_suffix = trino_table_fqn[len(trino_database_fqn) :]
        for cross_database_fqn in all_cross_database_fqns:
            cross_database_table_fqn = f"{cross_database_fqn}{trino_table_suffix}"
            if cross_database_table_fqn not in cross_database_table_fqn_mapping:
                cross_database_table = self.metadata.get_by_name(Table, fqn=cross_database_table_fqn)
                if not cross_database_table:
                    cross_database_schema_fqn = self._get_cross_database_schema_fqn(
                        cross_database_fqn,
                        trino_table,
                        cross_database_schema_fqn_mapping,
                    )
                    if cross_database_schema_fqn:
                        cross_database_table = self._get_case_insensitive_cross_database_table(
                            cross_database_schema_fqn,
                            trino_table,
                            cross_database_table_schema_mapping,
                        )
                cross_database_table_fqn_mapping[cross_database_table_fqn] = cross_database_table

            cross_database_table = cross_database_table_fqn_mapping[cross_database_table_fqn]
            if cross_database_table and self.check_same_table(trino_table, cross_database_table):
                return self.get_cross_database_lineage(cross_database_table, trino_table)

        return None

    def yield_cross_database_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        try:
            all_cross_database_fqns = self.get_cross_database_fqn_from_service_names()
            cross_database_table_fqn_mapping = {}
            cross_database_schema_fqn_mapping: Dict[str, Dict[str, str]] = {}
            cross_database_table_schema_mapping: Dict[str, Dict[str, List[Table]]] = {}

            # Get all databases for the specified Trino service
            trino_databases = self.metadata.list_all_entities(
                entity=Database, params={"service": self.config.serviceName}
            )
            for trino_database in trino_databases:
                trino_database_fqn = trino_database.fullyQualifiedName.root

                # Get all tables for the specified Trino database schema
                trino_tables = self.metadata.list_all_entities(entity=Table, params={"database": trino_database_fqn})
                # NOTE: Currently, tables in system-defined schemas will also be checked for lineage.
                for trino_table in trino_tables:
                    cross_database_lineage = self._get_cross_database_lineage_for_table(
                        trino_database_fqn=trino_database_fqn,
                        trino_table=trino_table,
                        all_cross_database_fqns=all_cross_database_fqns,
                        cross_database_table_fqn_mapping=cross_database_table_fqn_mapping,
                        cross_database_schema_fqn_mapping=cross_database_schema_fqn_mapping,
                        cross_database_table_schema_mapping=cross_database_table_schema_mapping,
                    )
                    if cross_database_lineage:
                        yield cross_database_lineage
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=f"{self.config.serviceName} Cross Database Lineage",
                    error=(
                        f"Error to yield cross database lineage details service name [{self.config.serviceName}]: {exc}"
                    ),
                    stackTrace=traceback.format_exc(),
                )
            )
