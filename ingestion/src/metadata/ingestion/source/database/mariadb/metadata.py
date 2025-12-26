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
MariaDB source module
"""
import traceback
from typing import Iterable, Optional

from sqlalchemy.dialects.mysql.base import ischema_names
from sqlalchemy.dialects.mysql.reflection import MySQLTableDefinitionParser

from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedureCode
from metadata.generated.schema.entity.services.connections.database.mariaDBConnection import (
    MariaDBConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import EntityName, Markdown
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.mariadb.models import (
    ROUTINE_TYPE_MAP,
    MariaDBStoredProcedure,
)
from metadata.ingestion.source.database.mariadb.queries import (
    MARIADB_GET_FUNCTIONS,
    MARIADB_GET_STORED_PROCEDURES,
)
from metadata.ingestion.source.database.mysql.utils import col_type_map, parse_column
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

ischema_names.update(col_type_map)


MySQLTableDefinitionParser._parse_column = (  # pylint: disable=protected-access
    parse_column
)


class MariadbSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Hive Source
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: MariaDBConnection = config.serviceConnection.root.config
        if not isinstance(connection, MariaDBConnection):
            raise InvalidSourceException(
                f"Expected MariaDBConnection, but got {connection}"
            )
        return cls(config, metadata)

    def _get_stored_procedures_internal(
        self, query: str
    ) -> Iterable[MariaDBStoredProcedure]:
        results = self.engine.execute(query).all()
        for row in results:
            try:
                yield MariaDBStoredProcedure.model_validate(dict(row._mapping))
            except Exception as exc:
                error = f"Error parsing Stored Procedure payload: {exc}"
                logger.error(error)
                self.status.failed(
                    error=StackTraceError(
                        name=dict(row).get("procedure_name", "UNKNOWN"),
                        error=error,
                        stackTrace=traceback.format_exc(),
                    )
                )

    def get_stored_procedures(self) -> Iterable[MariaDBStoredProcedure]:
        """List stored procedures"""
        if self.source_config.includeStoredProcedures:
            for query in (MARIADB_GET_STORED_PROCEDURES, MARIADB_GET_FUNCTIONS):
                yield from self._get_stored_procedures_internal(
                    query.format(schema_name=self.context.get().database_schema)
                )

    def yield_stored_procedure(
        self, stored_procedure
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Prepare the stored procedure payload"""
        try:
            stored_procedure_request = CreateStoredProcedureRequest(
                name=EntityName(stored_procedure.name),
                description=(
                    Markdown(stored_procedure.description)
                    if stored_procedure.description
                    else None
                ),
                storedProcedureCode=StoredProcedureCode(
                    language=stored_procedure.language, code=stored_procedure.definition
                ),
                databaseSchema=fqn.build(
                    metadata=self.metadata,
                    entity_type=DatabaseSchema,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=self.context.get().database_schema,
                ),
                storedProcedureType=ROUTINE_TYPE_MAP[stored_procedure.procedure_type],
            )
            yield Either(right=stored_procedure_request)
            self.register_record_stored_proc_request(stored_procedure_request)

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=stored_procedure.name,
                    error=f"Error yielding Stored Procedure [{stored_procedure.name}] due to [{exc}]",
                    stackTrace=traceback.format_exc(),
                )
            )
