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
Microsoft Fabric lineage module
"""
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.microsoftfabric.queries import (
    FABRIC_GET_STORED_PROCEDURE_QUERIES,
    FABRIC_SQL_STATEMENT,
)
from metadata.ingestion.source.database.microsoftfabric.query_parser import (
    MicrosoftFabricQueryParserSource,
)
from metadata.ingestion.source.database.stored_procedures_mixin import (
    StoredProcedureLineageMixin,
)
from metadata.utils.helpers import get_start_and_end
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class MicrosoftFabricLineageSource(
    MicrosoftFabricQueryParserSource, StoredProcedureLineageMixin, LineageSource
):
    """
    Microsoft Fabric lineage source
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.start = self.start.replace(tzinfo=None)
        self.end = self.end.replace(tzinfo=None)

    sql_stmt = FABRIC_SQL_STATEMENT

    filters = """
        AND (
            lower(h.command) LIKE '%%select%%into%%'
            OR lower(h.command) LIKE '%%insert%%into%%select%%'
            OR lower(h.command) LIKE '%%update%%'
            OR lower(h.command) LIKE '%%merge%%'
        )
        AND lower(h.command) NOT LIKE '%%create%%procedure%%'
        AND lower(h.command) NOT LIKE '%%create%%function%%'
        AND lower(h.command) NOT LIKE '%%declare%%'
        AND lower(h.command) NOT LIKE '%%exec sp_%%'
    """

    def get_stored_procedure_sql_statement(self) -> str:
        """
        Return the SQL statement to get the stored procedure queries
        """
        start, _ = get_start_and_end(self.source_config.queryLogDuration)
        return FABRIC_GET_STORED_PROCEDURE_QUERIES.format(
            start_date=start.replace(tzinfo=None),
        )
