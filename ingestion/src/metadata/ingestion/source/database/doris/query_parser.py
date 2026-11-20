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
Doris query parser module: the query log is `__internal_schema.audit_log`
"""

from abc import ABC
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from metadata.generated.schema.entity.services.connections.database.dorisConnection import (
    DorisConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.doris.queries import (
    DORIS_GET_AUDIT_LOG_ENABLED,
    DORIS_TEST_GET_QUERIES,
)
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DorisQueryParserSource(QueryParserSource, ABC):
    """
    Doris base for Usage
    """

    @classmethod
    def create(cls, config_dict: dict[str, Any], metadata: OpenMetadata, pipeline_name: str | None = None):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        if config.serviceConnection is None:
            raise InvalidSourceException("Doris service connection is required")
        connection = config.serviceConnection.root.config
        if not isinstance(connection, DorisConnection):
            raise InvalidSourceException(f"Expected DorisConnection, but got {connection}")
        return cls(config, metadata)

    def prepare(self):
        """Say what is missing when the query log cannot be read or Doris does not record queries

        Neither fails the run: AutoPilot stops at a failed usage agent, before the profiler and
        classification agents, and reading the query log needs a grant of its own.
        """
        if getattr(self.source_config, "queryLogFilePath", None):
            return
        with self.engine.connect() as conn:  # pyright: ignore[reportOptionalMemberAccess]
            try:
                conn.execute(text(DORIS_TEST_GET_QUERIES)).fetchall()
            except SQLAlchemyError as exc:
                reason = (
                    "Cannot read the Doris query log __internal_schema.audit_log, so no query is read. It needs"
                    f" Doris 4.1 or later and SELECT_PRIV on internal.__internal_schema.audit_log for the user: {exc}"
                )
                logger.error("%s", reason)
                self.status.warning("__internal_schema.audit_log", reason)
                return
            if not conn.execute(text(DORIS_GET_AUDIT_LOG_ENABLED)).scalar():
                reason = (
                    "Doris is not recording queries: enable_audit_plugin is false, the default before Doris 3.1.2"
                    " that an upgraded cluster keeps. Only the queries recorded while it was true are read; turn it"
                    " on with SET GLOBAL enable_audit_plugin = true"
                )
                logger.warning("%s", reason)
                self.status.warning("enable_audit_plugin", reason)
