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
Microsoft Fabric Database Source Module

Extracts metadata from Microsoft Fabric Warehouses and Lakehouses
via their SQL endpoints.
"""

import traceback
from typing import Any, Iterable, Optional

from sqlalchemy import text
from sqlalchemy.dialects.mssql.base import MSDialect, ischema_names

from metadata.clients.microsoftfabric.models import FabricStoredProcedure
from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedureCode
from metadata.generated.schema.entity.services.connections.database.microsoftFabricConnection import (
    MicrosoftFabricConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import EntityName
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.microsoftfabric.queries import (
    FABRIC_GET_DATABASES,
    FABRIC_GET_STORED_PROCEDURES,
)
from metadata.ingestion.source.database.mssql.utils import (
    get_columns,
    get_foreign_keys,
    get_pk_constraint,
    get_table_comment,
    get_table_names,
    get_unique_constraints,
    get_view_definition,
    get_view_names,
)
from metadata.ingestion.source.database.multi_db_source import MultiDBSource
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqa_utils import update_mssql_ischema_names
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_all_view_definitions,
)

logger = ingestion_logger()

# Update MSSQL type mappings
ischema_names = update_mssql_ischema_names(ischema_names)

# Monkey-patch MSDialect with enhanced methods (same as Synapse/MSSQL)
MSDialect.get_table_comment = get_table_comment
MSDialect.get_view_definition = get_view_definition
MSDialect.get_all_view_definitions = get_all_view_definitions
MSDialect.get_all_table_comments = get_all_table_comments
MSDialect.get_columns = get_columns
MSDialect.get_pk_constraint = get_pk_constraint
MSDialect.get_unique_constraints = get_unique_constraints
MSDialect.get_foreign_keys = get_foreign_keys
MSDialect.get_table_names = get_table_names
MSDialect.get_view_names = get_view_names


class MicrosoftFabricSource(CommonDbSourceService, MultiDBSource):
    """
    Implements the necessary methods to extract
    Database metadata from Microsoft Fabric Warehouses and Lakehouses.
    """

    @classmethod
    def create(
        cls,
        config_dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,  # pylint: disable=unused-argument
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: MicrosoftFabricConnection = config.serviceConnection.root.config
        if not isinstance(connection, MicrosoftFabricConnection):
            raise InvalidSourceException(f"Expected MicrosoftFabricConnection, but got {connection}")
        return cls(config, metadata)

    def get_configured_database(self) -> Optional[str]:
        """
        Return the configured database name if not ingesting all databases.
        """
        if not self.service_connection.ingestAllDatabases:
            return self.service_connection.database
        return None

    def get_database_names_raw(self) -> Iterable[str]:
        """
        Get raw database names from the Fabric workspace.
        """
        yield from self._execute_database_query(FABRIC_GET_DATABASES)

    def get_database_names(self) -> Iterable[str]:
        """
        Get database names, applying filters as needed.

        In Microsoft Fabric, each Warehouse and Lakehouse appears as a database.
        """
        if not self.config.serviceConnection.root.config.ingestAllDatabases:
            configured_db = self.config.serviceConnection.root.config.database
            self.set_inspector(database_name=configured_db)
            yield configured_db
        else:
            for new_database in self.get_database_names_raw():
                database_fqn = fqn.build(
                    self.metadata,
                    entity_type=Database,
                    service_name=self.context.get().database_service,
                    database_name=new_database,
                )

                if filter_by_database(
                    self.source_config.databaseFilterPattern,
                    database_fqn if self.source_config.useFqnForFiltering else new_database,
                ):
                    self.status.filter(database_fqn, "Database Filtered Out")
                    continue

                try:
                    self.set_inspector(database_name=new_database)
                    yield new_database
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.error(f"Error trying to connect to database {new_database}: {exc}")

    def get_stored_procedures(self) -> Iterable[Any]:
        """List stored procedures to process"""

        if self.source_config.includeStoredProcedures:
            with self.engine.connect() as conn:
                results = (
                    conn.execute(
                        text(
                            FABRIC_GET_STORED_PROCEDURES.format(
                                database_name=self.context.get().database,
                                schema_name=self.context.get().database_schema,
                            )
                        )
                    )
                    .mappings()
                    .all()
                )
            for row in results:
                stored_procedure = FabricStoredProcedure.model_validate(dict(row))
                yield stored_procedure

    def yield_stored_procedure(self, stored_procedure: Any) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Yield stored procedure requests from Fabric stored procedure metadata."""
        try:
            stored_procedure_request = CreateStoredProcedureRequest(
                name=EntityName(stored_procedure.name),
                storedProcedureCode=StoredProcedureCode(
                    language=stored_procedure.language or "SQL",
                    code=stored_procedure.definition,
                ),
                databaseSchema=fqn.build(
                    metadata=self.metadata,
                    entity_type=DatabaseSchema,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=self.context.get().database_schema,
                ),
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
