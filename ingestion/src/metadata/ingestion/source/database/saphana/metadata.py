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
SAP Hana source module
"""
import traceback
from typing import Iterable, Optional

from sqlalchemy import text

from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import (
    Language,
    StoredProcedureCode,
)
from metadata.generated.schema.entity.services.connections.database.sapHanaConnection import (
    SapHanaConnection,
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
from metadata.ingestion.source.database.saphana.models import SapHanaStoredProcedure
from metadata.ingestion.source.database.saphana.queries import SAPHANA_TABLE_FUNCTIONS
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SaphanaSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Mysql Source
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: SapHanaConnection = config.serviceConnection.root.config
        if not isinstance(connection, SapHanaConnection):
            raise InvalidSourceException(
                f"Expected SapHanaConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_database_names(self) -> Iterable[str]:
        """
        Check if the db is configured, or query the name
        """
        self._connection_map = {}  # Lazy init as well
        self._inspector_map = {}

        if getattr(self.service_connection.connection, "database"):
            yield self.service_connection.connection.database

        else:
            try:
                yield self.connection.execute(
                    text("SELECT DATABASE_NAME FROM M_DATABASE")
                ).fetchone()[0]
            except Exception as err:
                raise RuntimeError(
                    f"Error retrieving database name from the source - [{err}]."
                    " A way through this error is by specifying the `database` in the service connection."
                )

    def get_raw_database_schema_names(self) -> Iterable[str]:
        if self.service_connection.connection.__dict__.get("databaseSchema"):
            yield self.service_connection.connection.databaseSchema
        else:
            for schema_name in self.inspector.get_schema_names():
                yield schema_name

    def get_stored_procedures(self) -> Iterable[SapHanaStoredProcedure]:
        """List SAP HANA table functions"""
        if self.source_config.includeStoredProcedures:
            schema_name = self.context.get().database_schema
            try:
                with self.engine.connect() as conn:
                    results = conn.execute(
                        text(SAPHANA_TABLE_FUNCTIONS),
                        {"schema_name": schema_name},
                    ).all()
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error fetching table functions for schema"
                    f" [{schema_name}]: {exc}"
                )
                return

            for row in results:
                try:
                    stored_procedure = SapHanaStoredProcedure.model_validate(
                        row._asdict()
                    )
                    if self.is_stored_procedure_filtered(stored_procedure.name):
                        continue
                    yield stored_procedure
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(f"Error parsing table function row: {row} - {exc}")
                    self.status.failed(
                        error=StackTraceError(
                            name=row._asdict().get("function_name", "UNKNOWN"),
                            error=f"Error parsing Table Function payload: {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def yield_stored_procedure(
        self, stored_procedure: SapHanaStoredProcedure
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Prepare the stored procedure payload"""
        try:
            stored_procedure_request = CreateStoredProcedureRequest(
                name=EntityName(stored_procedure.name),
                storedProcedureCode=StoredProcedureCode(
                    language=Language.SQL,
                    code=stored_procedure.definition or "",
                ),
                storedProcedureType=stored_procedure.procedure_type,
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
                    error=(
                        f"Error yielding Stored Procedure"
                        f" [{stored_procedure.procedure_type}:"
                        f" {stored_procedure.name}]: {exc}"
                    ),
                    stackTrace=traceback.format_exc(),
                )
            )
