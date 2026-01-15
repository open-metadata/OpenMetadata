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
"""Mysql source module"""
import traceback
from typing import Iterable, Optional, cast

from sqlalchemy.dialects.mysql.base import ischema_names
from sqlalchemy.dialects.mysql.reflection import MySQLTableDefinitionParser
from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedureCode
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
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
from metadata.ingestion.source.database.mysql.models import (
    STORED_PROC_LANGUAGE_MAP,
    STORED_PROC_TYPE_MAP,
    MysqlRoutine,
)
from metadata.ingestion.source.database.mysql.queries import MYSQL_GET_ROUTINES
from metadata.ingestion.source.database.mysql.utils import col_type_map, parse_column
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import get_all_table_ddls, get_table_ddl

logger = ingestion_logger()

ischema_names.update(col_type_map)


MySQLTableDefinitionParser._parse_column = (  # pylint: disable=protected-access
    parse_column
)

Inspector.get_all_table_ddls = get_all_table_ddls
Inspector.get_table_ddl = get_table_ddl


class MysqlSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Mysql Source
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = cast(MysqlConnection, config.serviceConnection.root.config)
        if not isinstance(connection, MysqlConnection):
            raise InvalidSourceException(
                f"Expected MysqlConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_stored_procedures(self) -> Iterable[MysqlRoutine]:
        """List stored procedures and functions"""
        if self.source_config.includeStoredProcedures:
            results = self.engine.execute(
                MYSQL_GET_ROUTINES.format(
                    schema_name=self.context.get().database_schema
                )
            ).all()
            for row in results:
                try:
                    stored_procedure = MysqlRoutine.model_validate(
                        dict(row._mapping)  # pylint: disable=protected-access
                    )
                    yield stored_procedure
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Error parsing stored procedure/function: {dict(row._mapping).get('routine_name', 'UNKNOWN')} - {exc}"
                    )
                    self.status.failed(
                        error=StackTraceError(
                            name=dict(row._mapping).get("routine_name", "UNKNOWN"),
                            error=f"Error parsing Stored Procedure/Function payload: {exc}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

    def yield_stored_procedure(
        self, stored_procedure: MysqlRoutine
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
                    language=STORED_PROC_LANGUAGE_MAP.get(stored_procedure.language),
                    code=stored_procedure.definition,
                ),
                databaseSchema=fqn.build(
                    metadata=self.metadata,
                    entity_type=DatabaseSchema,
                    service_name=self.context.get().database_service,
                    database_name=self.context.get().database,
                    schema_name=self.context.get().database_schema,
                ),
                storedProcedureType=STORED_PROC_TYPE_MAP.get(
                    stored_procedure.routine_type
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
