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
Trino lineage module
"""
import traceback
from typing import Iterable, List, Tuple

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.trino.queries import TRINO_SQL_STATEMENT
from metadata.ingestion.source.database.trino.query_parser import TrinoQueryParserSource


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

    def get_cross_database_fqn_from_service_names(self):
        database_service_names = self.source_config.crossDatabaseServiceNames
        return [
            database.fullyQualifiedName.root
            for service in database_service_names
            for database in self.metadata.list_all_entities(
                entity=Database, params={"service": service}
            )
        ]

    def check_same_table(self, table1, table2):
        """
        Method to check whether the table1 and table2 are same
        """
        return table1.name.root == table2.name.root and {
            column.name.root for column in table1.columns
        } == {column.name.root for column in table2.columns}

    def get_lineage_details(self) -> List[Tuple[Table, Table]]:
        """
        Method to fetch database lineage details.
        """
        all_cross_database_fqns = self.get_cross_database_fqn_from_service_names()
        cross_database_table_fqn_mapping = {}
        lineage_details = []

        # Get all databases for the specified Trino service
        trino_databases = self.metadata.list_all_entities(
            entity=Database, params={"service": self.config.serviceName}
        )
        for trino_database in trino_databases:
            trino_database_fqn = trino_database.fullyQualifiedName.root

            # Get all schemas for the specified Trino database
            trino_schemas = self.metadata.list_all_entities(
                entity=DatabaseSchema,
                params={"database": trino_database.fullyQualifiedName.root},
            )
            for trino_schema in trino_schemas:
                if trino_schema.name.root == "information_schema":
                    continue

                # Get all tables for the specified Trino database schema
                trino_tables = self.metadata.list_all_entities(
                    entity=Table,
                    params={"databaseSchema": trino_schema.fullyQualifiedName.root},
                )
                for trino_table in trino_tables:
                    trino_table_fqn = trino_table.fullyQualifiedName.root

                    for cross_database_fqn in all_cross_database_fqns:
                        # Construct the FQN for cross-database tables
                        cross_database_table_fqn = trino_table_fqn.replace(
                            trino_database_fqn, cross_database_fqn
                        )
                        # Cache cross-database table against its FQN to avoid repeated API calls
                        cross_database_table = cross_database_table_fqn_mapping[
                            cross_database_table_fqn
                        ] = cross_database_table_fqn_mapping.get(
                            cross_database_table_fqn,
                            self.metadata.get_by_name(
                                Table, fqn=cross_database_table_fqn
                            ),
                        )
                        if cross_database_table and self.check_same_table(
                            trino_table, cross_database_table
                        ):
                            lineage_details.append((trino_table, cross_database_table))
                            break

        return lineage_details

    def yield_cross_database_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        if not (
            self.source_config.processCrossDatabaseLineage
            and self.source_config.crossDatabaseServiceNames
        ):
            return

        try:
            lineage_details = self.get_lineage_details()
            for target, source in lineage_details:
                column_lineage = None
                if source and source.columns and target and target.columns:
                    columns_list = [column.name.root for column in source.columns]
                    column_lineage = self._get_column_lineage(
                        from_table=source, to_table=target, columns_list=columns_list
                    )
                yield self._get_add_lineage_request(
                    from_entity=source, to_entity=target, column_lineage=column_lineage
                )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=f"{self.config.serviceName} Cross Database Lineage",
                    error=(
                        "Error to yield cross database lineage details "
                        f"service name [{self.config.serviceName}]: {exc}"
                    ),
                    stackTrace=traceback.format_exc(),
                )
            )
