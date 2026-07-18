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

# pylint: disable=protected-access
"""Oracle source module"""

import traceback
import types
from typing import Iterable, List, Optional, Tuple  # noqa: UP035

from sqlalchemy import text
from sqlalchemy.dialects.oracle.base import INTERVAL, OracleDialect, ischema_names
from sqlalchemy.engine import Inspector
from sqlalchemy.exc import NoSuchTableError

from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import (
    Language,
    StoredProcedureCode,
    StoredProcedureType,
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
from metadata.generated.schema.type.basic import EntityName
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import create_sqlalchemy_type
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.oracle.models import (
    FetchObjectList,
    OracleStoredObject,
)
from metadata.ingestion.source.database.oracle.queries import (
    ORACLE_GET_STORED_PACKAGES,
    ORACLE_GET_STORED_PROCEDURES,
)
from metadata.ingestion.source.database.oracle.utils import (
    _get_col_type,
    _get_constraint_data,
    denormalize_name,
    get_all_view_definitions,
    get_columns,
    get_indexes_preserve_case,
    get_mview_names,
    get_mview_names_dialect,
    get_table_comment,
    get_table_comment_preserve_case,
    get_table_names,
    get_table_prefix_from_connection,
    get_view_definition,
    get_view_definition_preserve_case,
    get_view_names,
    get_view_names_dialect,
    normalize_name,
)
from metadata.utils import fqn
from metadata.utils.helpers import clean_up_starting_ending_double_quotes_in_string
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import (
    get_all_table_comments,
    get_all_table_ddls,
    get_table_ddl,
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
OracleDialect.get_mview_names = get_mview_names_dialect
Inspector.get_view_names = get_view_names
OracleDialect.get_view_names = get_view_names_dialect

Inspector.get_all_table_ddls = get_all_table_ddls
Inspector.get_table_ddl = get_table_ddl

OracleDialect._get_constraint_data = _get_constraint_data


class OracleSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Oracle Source
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        dialect = self.engine.dialect
        dialect.table_prefix = get_table_prefix_from_connection(self.service_connection)
        if getattr(self.service_connection, "preserveIdentifierCase", False):
            dialect.normalize_name = types.MethodType(normalize_name, dialect)
            dialect.denormalize_name = types.MethodType(denormalize_name, dialect)
            dialect.get_table_comment = types.MethodType(get_table_comment_preserve_case, dialect)
            dialect.get_view_definition = types.MethodType(get_view_definition_preserve_case, dialect)
            dialect.get_indexes = types.MethodType(get_indexes_preserve_case, dialect)

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None):  # noqa: UP045
        config = WorkflowSource.model_validate(config_dict)
        connection: OracleConnection = config.serviceConnection.root.config
        if not isinstance(connection, OracleConnection):
            raise InvalidSourceException(f"Expected OracleConnection, but got {connection}")
        return cls(config, metadata)

    @staticmethod
    def _get_columns_with_constraints(
        schema_name: str, table_name: str, inspector: Inspector
    ) -> Tuple[List, List, List]:  # noqa: UP006
        """
        Oracle-only override: under SQLAlchemy >= 2.0, the Oracle dialect's
        get_pk_constraint() is a thin wrapper over the bulk get_multi_pk_constraint()
        API, which simply omits any table that has no PK-constraint row from its
        result. The wrapper then raises NoSuchTableError for "absent from result",
        even when the table exists and just has no primary key (previously it
        returned an empty dict for this case). We only swallow the error here,
        scoped to Oracle: this dialect's specific PK-lookup query is the one
        confirmed to conflate "no PK" with "absent from result", so a
        NoSuchTableError from Oracle's get_pk_constraint at this call site is
        expected to mean "no PK", not "table missing" (a genuinely missing table
        will still fail later during column reflection). For other dialects this
        override does not apply, so a NoSuchTableError there continues to
        propagate as a real "table not found" signal.
        """
        try:
            pk_constraints = inspector.get_pk_constraint(table_name, schema_name)
        except NoSuchTableError:
            logger.debug(f"No primary key constraint found for table [{schema_name}.{table_name}]")
            pk_constraints = {}
        try:
            unique_constraints = inspector.get_unique_constraints(table_name, schema_name)
        except NotImplementedError:
            logger.debug(
                f"Cannot obtain unique constraints for table [{schema_name}.{table_name}]: NotImplementedError"
            )
            unique_constraints = []
        try:
            foreign_constraints = inspector.get_foreign_keys(table_name, schema_name)
        except NotImplementedError:
            logger.debug(
                f"Cannot obtain foreign constraints for table [{schema_name}.{table_name}]: NotImplementedError"
            )
            foreign_constraints = []

        pk_columns = (
            pk_constraints.get("constrained_columns")
            if len(pk_constraints) > 0 and pk_constraints.get("constrained_columns")
            else {}
        )

        foreign_columns = []
        for foreign_constraint in foreign_constraints:
            if len(foreign_constraint) > 0 and foreign_constraint.get("constrained_columns"):
                foreign_constraint.update(
                    {
                        "constrained_columns": [
                            clean_up_starting_ending_double_quotes_in_string(column)
                            for column in foreign_constraint.get("constrained_columns")
                        ],
                        "referred_columns": [
                            clean_up_starting_ending_double_quotes_in_string(column)
                            for column in foreign_constraint.get("referred_columns")
                        ],
                    }
                )
                foreign_columns.append(foreign_constraint)

        unique_columns = []
        for constraint in unique_constraints:
            if constraint.get("column_names"):
                unique_columns.append(  # noqa: PERF401
                    [
                        clean_up_starting_ending_double_quotes_in_string(column)
                        for column in constraint.get("column_names")
                    ]
                )

        pk_columns = [clean_up_starting_ending_double_quotes_in_string(pk_column) for pk_column in pk_columns]

        return pk_columns, unique_columns, foreign_columns

    def query_table_names_and_types(self, schema_name: str) -> Iterable[TableNameAndType]:
        """
        Connect to the source database to get the table
        name and type. By default, use the inspector method
        to get the names and pass the Regular type.

        This is useful for sources where we need fine-grained
        logic on how to handle table types, e.g., external, foreign,...
        """

        regular_tables = [
            TableNameAndType(name=table_name) for table_name in self.inspector.get_table_names(schema_name) or []
        ]
        material_tables = [
            TableNameAndType(name=table_name, type_=TableType.MaterializedView)
            for table_name in self.inspector.get_mview_names(schema_name) or []
        ]

        return regular_tables + material_tables

    def process_result(self, data: FetchObjectList):
        """Process data as per our stored procedure format"""
        result_dict = {}

        for row in data:
            owner, name, line, text, procedure_type = row
            key = (owner, name)
            if key not in result_dict:
                result_dict[key] = {"lines": [], "text": "", "procedure_type": ""}
            result_dict[key]["lines"].append(line)
            result_dict[key]["text"] += text
            result_dict[key]["procedure_type"] = procedure_type

        # Return the concatenated text for each procedure name, ordered by line
        return result_dict

    def _get_stored_procedures_internal(self, query: str) -> Iterable[OracleStoredObject]:
        schema = self.context.get().database_schema
        if not getattr(self.service_connection, "preserveIdentifierCase", False):
            schema = schema.upper()
        prefix = getattr(self.engine.dialect, "table_prefix", "DBA")
        with self.engine.connect() as conn:
            results: FetchObjectList = conn.execute(text(query.format(schema=schema, prefix=prefix))).all()
        results = self.process_result(data=results)
        for row in results.items():
            stored_procedure = OracleStoredObject(
                name=row[0][1],
                definition=row[1]["text"],
                owner=row[0][0],
                procedure_type=row[1]["procedure_type"],
            )
            if self.is_stored_procedure_filtered(stored_procedure.name):
                continue
            yield stored_procedure

    def get_stored_procedures(self) -> Iterable[OracleStoredObject]:
        """List Oracle Stored Procedures"""
        if self.source_config.includeStoredProcedures:
            yield from self._get_stored_procedures_internal(ORACLE_GET_STORED_PROCEDURES)
            yield from self._get_stored_procedures_internal(ORACLE_GET_STORED_PACKAGES)

    def yield_stored_procedure(
        self, stored_procedure: OracleStoredObject
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Prepare the stored procedure payload"""
        try:
            stored_procedure_request = CreateStoredProcedureRequest(
                name=EntityName(stored_procedure.name),
                storedProcedureCode=StoredProcedureCode(
                    language=Language.SQL,
                    code=stored_procedure.definition,
                ),
                storedProcedureType=(
                    StoredProcedureType.StoredPackage
                    if stored_procedure.procedure_type == "StoredPackage"
                    else StoredProcedureType.StoredProcedure
                ),
                owners=self.metadata.get_reference_by_name(name=stored_procedure.owner.lower(), is_owner=True),
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
