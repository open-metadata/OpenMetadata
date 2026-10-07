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
Teradata lineage module
"""

from metadata.generated.schema.entity.services.connections.database.teradataConnection import (
    TeradataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.lineage_source import LineageSource
from metadata.ingestion.source.database.teradata.queries import (
    TERADATA_QUERY_HISTORY_STATEMENT,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class TeradataLineageSource(LineageSource):
    """
    Teradata lineage from view definitions and the DBQL query log
    """

    sql_stmt = TERADATA_QUERY_HISTORY_STATEMENT
    # INSERT ... VALUES rows (TPump/BTEQ loads) and plain CREATE TABLE DDL carry no lineage
    # and would flood resultLimit, so those two types must also read from a SELECT
    filters = """
        AND UPPER(q.StatementType) LIKE ANY ('INSERT%', 'UPDATE%', 'MERGE%', 'CREATE TABLE%')
        AND (
            UPPER(q.StatementType) NOT LIKE ALL ('INSERT%', 'CREATE TABLE%')
            OR UPPER(COALESCE(s.SqlTextInfo, q.QueryText)) LIKE '%SEL%'
        )
    """

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: TeradataConnection = config.serviceConnection.root.config
        if not isinstance(connection, TeradataConnection):
            raise InvalidSourceException(f"Expected TeradataConnection, but got {connection}")
        return cls(config, metadata)
