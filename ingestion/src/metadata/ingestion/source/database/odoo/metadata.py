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
Odoo source module
"""
import traceback
from typing import Dict, Iterable, Optional, Tuple

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    Constraint,
    DataType,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.odooConnection import (
    OdooConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.odoo.constants import (
    ODOO_TO_OPENMETADATA_TYPE_MAP,
)
from metadata.ingestion.source.database.odoo.models import OdooField, OdooModel
from metadata.utils import fqn
from metadata.utils.execution_time_tracker import calculate_execution_time_generator
from metadata.utils.filters import filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class OdooSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Odoo Source
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: OdooConnection = config.serviceConnection.root.config
        if not isinstance(connection, OdooConnection):
            raise InvalidSourceException(
                f"Expected OdooConnection, but got {connection}"
            )
        return cls(config, metadata)

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self._model_descriptions: Dict[str, str] = {}

    def get_database_names(self) -> Iterable[str]:
        yield self.service_connection.databaseName

    @calculate_execution_time_generator()
    def yield_database(
        self, database_name: str
    ) -> Iterable[Either[CreateDatabaseRequest]]:
        """
        From topology.
        Prepare a database request and pass it to the sink
        """
        try:
            database_request = CreateDatabaseRequest(
                name=EntityName(database_name),
                service=FullyQualifiedEntityName(self.context.get().database_service),
            )
            yield Either(right=database_request)
            self.register_record_database_request(database_request=database_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=database_name, error=str(exc), stackTrace=traceback.format_exc()
                )
            )

    def get_raw_database_schema_names(self) -> Iterable[str]:
        configured_schema = getattr(self.service_connection, "databaseSchema", None)
        yield configured_schema or "default"

    @calculate_execution_time_generator()
    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[Either[CreateDatabaseSchemaRequest]]:
        """
        From topology.
        Prepare a database schema request and pass it to the sink
        """
        try:
            schema_request = CreateDatabaseSchemaRequest(
                name=EntityName(schema_name),
                database=FullyQualifiedEntityName(
                    fqn.build(
                        metadata=self.metadata,
                        entity_type=Database,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                    )
                ),
            )
            yield Either(right=schema_request)
            self.register_record_schema_request(schema_request=schema_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=schema_name, error=str(exc), stackTrace=traceback.format_exc()
                )
            )

    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Ingest the models from Odoo
        """
        for model_dict in self.connection_obj.get_all_models() or []:
            try:
                model = OdooModel(**model_dict)
                table_name = model.model
                
                if filter_by_table(self.source_config.tableFilterPattern, table_name):
                    self.status.filter(table_name, "Table Filtered Out")
                    continue
                    
                self._model_descriptions[table_name] = model.name if isinstance(model.name, str) else ""
                yield table_name, TableType.Regular
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.warning(f"Unable to process model information: {err}")

    @calculate_execution_time_generator()
    def yield_table(
        self, table_name_and_type: Tuple[str, TableType]
    ) -> Iterable[Either[CreateTableRequest]]:
        """
        From topology.
        Prepare a table request and pass it to the sink
        """
        table_name, table_type = table_name_and_type
        schema_name = self.context.get().database_schema
        try:
            fields_data = self.connection_obj.get_model_fields(table_name)
            
            om_columns = []
            for ordinal, field_dict in enumerate(fields_data or [], start=1):
                field = OdooField(**field_dict)
                col_type = ODOO_TO_OPENMETADATA_TYPE_MAP.get(
                    field.ttype, DataType.UNKNOWN.name
                )
                
                # Format relations in datatype display
                data_type_display = field.ttype
                if field.relation and isinstance(field.relation, str):
                    data_type_display = f"{field.ttype} ({field.relation})"

                # In case field_description is empty but we need a description
                description = field.field_description if isinstance(field.field_description, str) else None

                om_columns.append(
                    Column(
                        name=ColumnName(field.name),
                        displayName=description or field.name,
                        description=Markdown(description) if description else None,
                        dataType=col_type,
                        dataTypeDisplay=data_type_display,
                        ordinalPosition=ordinal,
                        constraint=Constraint.NOT_NULL if field.required else Constraint.NULL,
                    )
                )

            # Retrieve the description safely
            table_description = self._model_descriptions.get(table_name)

            table_request = CreateTableRequest(
                name=EntityName(table_name),
                tableType=table_type,
                description=Markdown(table_description) if table_description else None,
                columns=om_columns,
                databaseSchema=FullyQualifiedEntityName(
                    fqn.build(
                        metadata=self.metadata,
                        entity_type=DatabaseSchema,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                        schema_name=schema_name,
                    )
                ),
            )
            yield Either(right=table_request)
            self.register_record(table_request=table_request)
        except Exception as exc:
            error = f"Unexpected exception to yield table [{table_name}]: {exc}"
            yield Either(
                left=StackTraceError(
                    name=table_name, error=error, stackTrace=traceback.format_exc()
                )
            )

    def close(self):
        super().close()
