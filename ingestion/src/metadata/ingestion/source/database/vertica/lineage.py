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
Vertica lineage module
"""
import traceback
from copy import deepcopy
from typing import Iterator, Optional

from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.vertica.connection import get_connection
from metadata.ingestion.source.database.vertica.queries import (
    VERTICA_LIST_DATABASES,
    VERTICA_SQL_STATEMENT,
)
from metadata.ingestion.source.database.vertica.query_parser import (
    VerticaQueryParserSource,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class VerticaLineageSource(VerticaQueryParserSource, LineageSource):
    """
    Vertica lineage parser source.

    Vertica V_MONITOR schema changes from database to database.
    To allow the lineage to happen for all the ingested databases
    we'll need to iterate over them.

    This is different from other sources such as Snowflake,
    where the queries can be extracted in a single run
    for all the databases.
    """

    sql_stmt = VERTICA_SQL_STATEMENT

    filters = "AND query_type in ('INSERT', 'UPDATE', 'QUERY', 'DDL')"

    database_field = "DBNAME()"

    schema_field = ""

    def get_table_query(self) -> Optional[Iterator[TableQuery]]:
        """
        If queryLogFilePath available run the parent implementation.

        If the database is informed, run the parent implementation.

        Otherwise, iterate over the databases and prep the engine
        with them.
        """
        if (
            self.config.sourceConfig.config.queryLogFilePath
            or self.service_connection.database
        ):
            yield from super().get_table_query()

        else:
            try:
                results = get_connection(self.service_connection).execute(
                    VERTICA_LIST_DATABASES
                )
                for res in results:
                    row = list(res)
                    new_service_connection = deepcopy(self.service_connection)
                    new_service_connection.database = row[0]

                    engine = get_connection(new_service_connection)
                    yield from self.yield_table_query(engine)

            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(f"Source usage processing error: {exc}")
