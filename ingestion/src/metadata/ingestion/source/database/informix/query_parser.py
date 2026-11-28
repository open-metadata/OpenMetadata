#  Copyright 2026 OpenMetadata
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
Shared base for the Informix usage and lineage sources.
"""

import calendar
import re
from abc import ABC
from datetime import datetime

from metadata.generated.schema.entity.services.connections.database.informixConnection import (
    InformixConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.informix.queries import INFORMIX_SQL_STATEMENT
from metadata.ingestion.source.database.query_parser_source import QueryParserSource

# Informix names a table in another database database:owner.table, which the SQL
# parser misreads as a table called after the database. Written
# database.owner.table it resolves, database included.
INFORMIX_DATABASE_QUALIFIER = re.compile(r"\b([A-Za-z_]\w*):(\w+\.\w+)\b")


def normalise_table_references(query: str) -> str:
    return INFORMIX_DATABASE_QUALIFIER.sub(r"\1.\2", query)


class InformixQueryParserSource(QueryParserSource, ABC):
    """Reads query history from sysmaster:syssqltrace."""

    sql_stmt = INFORMIX_SQL_STATEMENT
    filters: str

    @classmethod
    def create(cls, config_dict: dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        service_conn = config.serviceConnection
        connection = service_conn.root.config if service_conn is not None else None
        if not isinstance(connection, InformixConnection):
            raise InvalidSourceException(f"Expected InformixConnection, but got {connection}")
        return cls(config, metadata)

    def get_sql_statement(self, start_time: datetime, end_time: datetime) -> str:
        """The window as UTC epochs, which is what sql_finishtime holds. A naive
        datetime is UTC, as get_start_and_end builds it."""
        return self.sql_stmt.format(
            start_time=calendar.timegm(start_time.utctimetuple()),
            end_time=calendar.timegm(end_time.utctimetuple()),
            filters=self.get_filters(),
            result_limit=self.source_config.resultLimit,  # pyright: ignore[reportAttributeAccessIssue, reportOptionalMemberAccess]
        )
