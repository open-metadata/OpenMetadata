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
Common NoSQL source methods.
"""

import traceback
from abc import ABC, abstractmethod
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union

from pydantic import BaseModel

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    Table,
    TableConstraint,
    TableType,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.ingestion.api.models import Either
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.database_service import DatabaseServiceSource
from metadata.ingestion.source.database.stored_procedures_mixin import QueryByProcedure
from metadata.utils import fqn
from metadata.utils.constants import DEFAULT_DATABASE
from metadata.utils.datalake.datalake_utils import DataFrameColumnParser
from metadata.utils.filters import filter_by_schema, filter_by_table
from metadata.utils.helpers import retry_with_docker_host
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_manager import check_ssl_and_init

logger = ingestion_logger()


SAMPLE_SIZE = 1000


class TableNameAndType(BaseModel):
    """
    Helper model for passing down
    names and types of tables
    """

    name: str
    type_: TableType = TableType.Regular


class CommonNoSQLSource(DatabaseServiceSource, ABC):
    """
    Implements the necessary methods to extract
    Database metadata from NoSQL source
    """

    @retry_with_docker_host()
    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.root.config
        self.ssl_manager = check_ssl_and_init(self.service_connection)
        if self.ssl_manager:
            self.service_connection = self.ssl_manager.setup_ssl(
                self.service_connection
            )
        self.connection_obj = get_connection(self.service_connection)

        self.test_connection()

    def prepare(self):
        """
        by default there is nothing to prepare
        """

    def get_database_names(self) -> Iterable[str]:
        """
        Default case with a single database.

        It might come informed - or not - from the source.

        Sources with multiple databases should overwrite this and
        apply the necessary filters.
        """
        yield self.service_connection.__dict__.get("databaseName") or DEFAULT_DATABASE

    def yield_database(
        self, database_name: str
    ) -> Iterable[Either[CreateDatabaseRequest]]:
        """
        From topology.
        Prepare a database request and pass it to the sink
        """

        yield Either(
            right=CreateDatabaseRequest(
                name=EntityName(database_name),
                service=self.context.get().database_service,
                sourceUrl=self.get_source_url(database_name=database_name),
            )
        )

    @abstractmethod
    def get_schema_name_list(self) -> List[str]:
        """
        Method to get list of schema names available within NoSQL db
        need to be overridden by sources
        """

    def get_database_schema_names(self) -> Iterable[str]:
        for schema in self.get_schema_name_list():
            schema_fqn = fqn.build(
                self.metadata,
                entity_type=DatabaseSchema,
                service_name=self.context.get().database_service,
                database_name=self.context.get().database,
                schema_name=schema,
            )

            if filter_by_schema(
                self.source_config.schemaFilterPattern,
                schema_fqn if self.source_config.useFqnForFiltering else schema,
            ):
                self.status.filter(schema_fqn, "Schema Filtered Out")
                continue

            yield schema

    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[Either[CreateDatabaseSchemaRequest]]:
        """
        From topology.
        Prepare a database schema request and pass it to the sink
        """

        yield Either(
            right=CreateDatabaseSchemaRequest(
                name=EntityName(schema_name),
                database=FullyQualifiedEntityName(
                    fqn.build(
                        metadata=self.metadata,
                        entity_type=Database,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                    )
                ),
                sourceUrl=self.get_source_url(
                    database_name=self.context.get().database,
                    schema_name=schema_name,
                ),
            )
        )

    @abstractmethod
    def query_table_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Method to get list of table names and types available within schema db
        need to be overridden by sources
        """

    def query_view_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Method to get list of materialized view names and types available within schema db
        need to be overridden by sources if views are supported by the database.
        """

    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, TableType]]]:
        """
        Handle table and views.

        Fetches them up using the context information and
        the inspector set when preparing the db.

        :return: tables or views, depending on config
        """
        schema_name = self.context.get().database_schema

        try:
            for table_and_type_fn, flag in {
                self.query_table_names_and_types: self.source_config.includeTables,
                self.query_view_names_and_types: self.source_config.includeViews,
            }.items():
                if not flag:
                    continue

                for table_and_type in table_and_type_fn(schema_name=schema_name) or []:
                    table_name, table_type = table_and_type.name, table_and_type.type_

                    table_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                        schema_name=self.context.get().database_schema,
                        table_name=table_name,
                    )
                    if filter_by_table(
                        self.source_config.tableFilterPattern,
                        (
                            table_fqn
                            if self.source_config.useFqnForFiltering
                            else table_name
                        ),
                    ):
                        self.status.filter(
                            table_fqn,
                            "Table Filtered Out",
                        )
                        continue
                    yield table_name, table_type
        except Exception as err:
            logger.warning(
                f"Fetching tables names failed for schema {schema_name} due to - {err}"
            )
            logger.debug(traceback.format_exc())

    def get_table_columns_dict(
        self, schema_name: str, table_name: str
    ) -> Union[List[Dict], Dict]:
        """
        Method to get actual data available within table
        need to be overridden by sources
        """

    def get_table_constraints(
        self,
        db_name: str,
        schema_name: str,
        table_name: str,
    ) -> Optional[List[TableConstraint]]:
        # pylint: disable=unused-argument
        return None

    def get_table_columns(self, schema_name: str, table_name: str) -> List[Column]:
        """
        Method to return all columns of a table
        """
        import pandas as pd  # pylint: disable=import-outside-toplevel

        df = pd.DataFrame.from_records(
            list(self.get_table_columns_dict(schema_name, table_name))
        )
        column_parser = DataFrameColumnParser.create(df)
        return column_parser.get_columns()

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
            table_request = CreateTableRequest(
                name=EntityName(table_name),
                tableType=table_type,
                columns=self.get_table_columns(schema_name, table_name),
                tableConstraints=self.get_table_constraints(
                    schema_name=schema_name,
                    table_name=table_name,
                    db_name=self.context.get().database,
                ),
                databaseSchema=FullyQualifiedEntityName(
                    fqn.build(
                        metadata=self.metadata,
                        entity_type=DatabaseSchema,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                        schema_name=schema_name,
                    )
                ),
                sourceUrl=self.get_source_url(
                    database_name=self.context.get().database,
                    schema_name=schema_name,
                    table_name=table_name,
                    table_type=table_type,
                ),
            )

            yield Either(right=table_request)
            self.register_record(table_request=table_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=table_name,
                    error=f"Unexpected exception to yield table [{table_name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_tag(
        self, schema_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        tags are not supported with NoSQL
        """

    def get_stored_procedures(self) -> Iterable[Any]:
        """Not implemented"""

    def yield_stored_procedure(
        self, stored_procedure: Any
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Not implemented"""

    def get_stored_procedure_queries(self) -> Iterable[QueryByProcedure]:
        """Not Implemented"""

    def get_source_url(
        self,
        database_name: Optional[str] = None,
        schema_name: Optional[str] = None,
        table_name: Optional[str] = None,
        table_type: Optional[TableType] = None,
    ) -> Optional[str]:
        """
        By default the source url is not supported for
        """

    def close(self):
        """
        By default there is nothing to close
        """
