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
Teradata source implementation.
"""
import traceback
from typing import Iterable, Optional

from teradatasqlalchemy.dialect import TeradataDialect

from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedureCode
from metadata.generated.schema.entity.services.connections.database.teradataConnection import (
    TeradataConnection,
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
from metadata.ingestion.source.database.teradata.models import (
    STORED_PROC_LANGUAGE_MAP,
    TeradataStoredProcedure,
)
from metadata.ingestion.source.database.teradata.queries import (
    TERADATA_GET_STORED_PROCEDURES,
    TERADATA_SHOW_STORED_PROCEDURE,
)
from metadata.ingestion.source.database.teradata.utils import get_table_comment
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import get_all_table_comments

logger = ingestion_logger()

TeradataDialect.get_table_comment = get_table_comment
TeradataDialect.get_all_table_comments = get_all_table_comments


class TeradataSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Teradata Source
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config
        if not isinstance(connection, TeradataConnection):
            raise InvalidSourceException(
                f"Expected TeradataConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_stored_procedures(self) -> Iterable[TeradataStoredProcedure]:
        """List Teradata stored procedures"""
        if self.source_config.includeStoredProcedures:
            results = self.engine.execute(
                TERADATA_GET_STORED_PROCEDURES.format(
                    schema_name=self.context.get().database_schema,
                )
            ).all()
            for row in results:
                try:
                    stored_procedure = TeradataStoredProcedure.model_validate(dict(row))
                    stored_procedure.definition = self.describe_procedure_definition(
                        stored_procedure
                    )
                    yield stored_procedure
                except Exception as exc:
                    logger.error()
                    self.status.failed(
                        error=StackTraceError(
                            name=dict(row).get("name", "UNKNOWN"),
                            error=f"Error parsing Stored Procedure payload: {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def describe_procedure_definition(
        self, stored_procedure: TeradataStoredProcedure
    ) -> str:
        """
        We can only get the SP definition via SHOW PROCEDURE
        """
        res = self.engine.execute(
            TERADATA_SHOW_STORED_PROCEDURE.format(
                schema_name=stored_procedure.database_schema,
                procedure_name=stored_procedure.procedure_name,
            )
        )
        return str(res.first()[0])

    def yield_stored_procedure(
        self, stored_procedure: TeradataStoredProcedure
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Prepare the stored procedure payload"""

        try:
            stored_procedure_request = CreateStoredProcedureRequest(
                name=EntityName(stored_procedure.procedure_name),
                description=None,
                storedProcedureCode=StoredProcedureCode(
                    language=STORED_PROC_LANGUAGE_MAP.get(
                        stored_procedure.procedure_type
                    ),
                    code=stored_procedure.definition,
                ),
                databaseSchema=fqn.build(
                    metadata=self.metadata,
                    entity_type=DatabaseSchema,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=stored_procedure.database_schema,
                ),
            )
            yield Either(right=stored_procedure_request)
            self.register_record_stored_proc_request(stored_procedure_request)

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=stored_procedure.procedure_name,
                    error=f"Error yielding Stored Procedure [{stored_procedure.procedure_name}] due to [{exc}]",
                    stackTrace=traceback.format_exc(),
                )
            )
