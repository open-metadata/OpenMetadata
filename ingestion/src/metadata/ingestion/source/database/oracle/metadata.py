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

# pylint: disable=protected-access
"""Oracle source module"""
import traceback
from typing import Dict, Iterable, List, Optional

from sqlalchemy.dialects.oracle.base import INTERVAL, OracleDialect, ischema_names
from sqlalchemy.engine import Inspector

from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.entity.data.database import EntityName
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import (
    Language,
    StoredProcedureCode,
)
from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.oracleConnection import (
    OracleConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import create_sqlalchemy_type
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.oracle.models import (
    FetchProcedureList,
    OracleStoredProcedure,
)
from metadata.ingestion.source.database.oracle.queries import (
    ORACLE_GET_STORED_PROCEDURE_QUERIES,
    ORACLE_GET_STORED_PROCEDURES,
)
from metadata.ingestion.source.database.oracle.utils import (
    _get_col_type,
    get_columns,
    get_mview_definition,
    get_mview_names,
    get_mview_names_dialect,
    get_table_comment,
    get_table_names,
    get_view_definition,
)
from metadata.ingestion.source.database.stored_procedures_mixin import (
    QueryByProcedure,
    StoredProcedureMixin,
)
from metadata.utils import fqn
from metadata.utils.helpers import get_start_and_end
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_all_view_definitions,
)

logger = ingestion_logger()


ischema_names.update(
    {
        "ROWID": create_sqlalchemy_type("ROWID"),
        "XMLTYPE": create_sqlalchemy_type("XMLTYPE"),
        "INTERVAL YEAR TO MONTH": INTERVAL,
    }
)

OracleDialect.get_table_comment = get_table_comment
OracleDialect.get_columns = get_columns
OracleDialect._get_col_type = _get_col_type
OracleDialect.get_view_definition = get_view_definition
OracleDialect.get_all_view_definitions = get_all_view_definitions
OracleDialect.get_all_table_comments = get_all_table_comments
OracleDialect.get_table_names = get_table_names
Inspector.get_mview_names = get_mview_names
Inspector.get_mview_definition = get_mview_definition
OracleDialect.get_mview_names = get_mview_names_dialect


class OracleSource(StoredProcedureMixin, CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Oracle Source
    """

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata):
        config = WorkflowSource.parse_obj(config_dict)
        connection: OracleConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, OracleConnection):
            raise InvalidSourceException(
                f"Expected OracleConnection, but got {connection}"
            )
        return cls(config, metadata)

    def query_table_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Connect to the source database to get the table
        name and type. By default, use the inspector method
        to get the names and pass the Regular type.

        This is useful for sources where we need fine-grained
        logic on how to handle table types, e.g., external, foreign,...
        """

        regular_tables = [
            TableNameAndType(name=table_name)
            for table_name in self.inspector.get_table_names(schema_name) or []
        ]
        material_tables = [
            TableNameAndType(name=table_name, type_=TableType.MaterializedView)
            for table_name in self.inspector.get_mview_names(schema_name) or []
        ]

        return regular_tables + material_tables

    def get_view_definition(
        self, table_type: str, table_name: str, schema_name: str, inspector: Inspector
    ) -> Optional[str]:
        if table_type not in {TableType.View, TableType.MaterializedView}:
            return None

        definition_fn = inspector.get_view_definition
        if table_type == TableType.MaterializedView:
            definition_fn = inspector.get_mview_definition

        try:
            view_definition = definition_fn(table_name, schema_name)
            view_definition = "" if view_definition is None else str(view_definition)
            return view_definition

        except NotImplementedError:
            logger.warning("View definition not implemented")

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch view definition for {table_name}: {exc}")
        return None

    def process_result(self, data: FetchProcedureList):
        """Process data as per our stored procedure format"""
        result_dict = {}

        for row in data:
            owner, name, line, text = row
            key = (owner, name)
            if key not in result_dict:
                result_dict[key] = {"lines": [], "text": ""}
            result_dict[key]["lines"].append(line)
            result_dict[key]["text"] += text

        # Return the concatenated text for each procedure name, ordered by line
        return result_dict

    def get_stored_procedures(self) -> Iterable[OracleStoredProcedure]:
        """List Oracle Stored Procedures"""
        if self.source_config.includeStoredProcedures:
            results: FetchProcedureList = self.engine.execute(
                ORACLE_GET_STORED_PROCEDURES.format(
                    schema=self.context.database_schema.upper()
                )
            ).all()
            results = self.process_result(data=results)
            for row in results.items():
                stored_procedure = OracleStoredProcedure(
                    name=row[0][1], definition=row[1]["text"], owner=row[0][0]
                )
                yield stored_procedure

    def yield_stored_procedure(
        self, stored_procedure: OracleStoredProcedure
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Prepare the stored procedure payload"""

        try:
            stored_procedure_request = CreateStoredProcedureRequest(
                name=EntityName(__root__=stored_procedure.name),
                storedProcedureCode=StoredProcedureCode(
                    language=Language.SQL,
                    code=stored_procedure.definition,
                ),
                owner=self.metadata.get_reference_by_email(
                    email=stored_procedure.owner.lower()
                ),
                databaseSchema=fqn.build(
                    metadata=self.metadata,
                    entity_type=DatabaseSchema,
                    service_name=self.context.database_service,
                    database_name=self.context.database,
                    schema_name=self.context.database_schema,
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

    def get_stored_procedure_queries_dict(self) -> Dict[str, List[QueryByProcedure]]:
        """
        Return the dictionary associating stored procedures to the
        queries they triggered
        """
        start, _ = get_start_and_end(self.source_config.queryLogDuration)
        query = ORACLE_GET_STORED_PROCEDURE_QUERIES.format(
            start_date=start,
        )
        queries_dict = self.procedure_queries_dict(
            query=query,
        )

        return queries_dict
