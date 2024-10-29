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
Salesforce source ingestion
"""
import traceback
from typing import Any, Iterable, Optional, Tuple, Union

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.api.data.createStoredProcedure import (
    CreateStoredProcedureRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    Constraint,
    DataType,
    Table,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.salesforceConnection import (
    SalesforceConnection,
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
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.connections.test_connections import (
    raise_test_connection_exception,
)
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection, get_test_connection_fn
from metadata.ingestion.source.database.database_service import DatabaseServiceSource
from metadata.ingestion.source.database.stored_procedures_mixin import QueryByProcedure
from metadata.utils import fqn
from metadata.utils.constants import DEFAULT_DATABASE
from metadata.utils.filters import filter_by_table
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_manager import SSLManager, check_ssl_and_init

logger = ingestion_logger()

SALESFORCE_DEFAULT_SCHEMA = "salesforce"


class SalesforceSource(DatabaseServiceSource):
    """
    Implements the necessary methods to extract
    Database metadata from Salesforce Source
    """

    def __init__(self, config, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.root.config
        self.ssl_manager: SSLManager = check_ssl_and_init(self.service_connection)
        if self.ssl_manager:
            self.service_connection = self.ssl_manager.setup_ssl(
                self.service_connection
            )
        self.client = get_connection(self.service_connection)
        self.table_constraints = None
        self.database_source_state = set()

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: SalesforceConnection = config.serviceConnection.root.config
        if not isinstance(connection, SalesforceConnection):
            raise InvalidSourceException(
                f"Expected SalesforceConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_database_names(self) -> Iterable[str]:
        """
        Default case with a single database.

        It might come informed - or not - from the source.

        Sources with multiple databases should overwrite this and
        apply the necessary filters.
        """
        database_name = self.service_connection.databaseName or DEFAULT_DATABASE
        yield database_name

    def yield_database(
        self, database_name: str
    ) -> Iterable[Either[CreateDatabaseRequest]]:
        """
        From topology.
        Prepare a database request and pass it to the sink
        """
        yield Either(
            right=CreateDatabaseRequest(
                name=database_name,
                service=self.context.get().database_service,
            )
        )

    def get_database_schema_names(self) -> Iterable[str]:
        """
        return schema names
        """
        yield SALESFORCE_DEFAULT_SCHEMA

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
            )
        )

    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Handle table and views.

        Fetches them up using the context information and
        the inspector set when preparing the db.

        :return: tables or views, depending on config
        """
        schema_name = self.context.get().database_schema

        try:
            if self.service_connection.sobjectName:
                table_name = self.standardize_table_name(
                    schema_name, self.service_connection.sobjectName
                )
                yield table_name, TableType.Regular
            else:
                for salesforce_object in self.client.describe()["sobjects"]:
                    table_name = salesforce_object["name"]
                    table_name = self.standardize_table_name(schema_name, table_name)
                    table_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                        schema_name=self.context.get().database_schema,
                        table_name=table_name,
                    )
                    if filter_by_table(
                        self.config.sourceConfig.config.tableFilterPattern,
                        table_fqn
                        if self.config.sourceConfig.config.useFqnForFiltering
                        else table_name,
                    ):
                        self.status.filter(
                            table_fqn,
                            "Table Filtered Out",
                        )
                        continue

                    yield table_name, TableType.Regular
        except Exception as exc:
            self.status.failed(
                StackTraceError(
                    name=schema_name,
                    error=f"Unexpected exception for schema name [{schema_name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_table_description(
        self, table_name: str, object_label: Optional[str]
    ) -> Optional[str]:
        """
        Method to get the table description for salesforce with Tooling API
        """
        table_description = None
        try:
            result = self.client.toolingexecute(
                f"query/?q=SELECT+Description+FROM+EntityDefinition+WHERE+QualifiedApiName='{table_name}'"
            )
            table_description = result["records"][0]["Description"]
        except KeyError as err:
            logger.warning(
                f"Unable to get required key from Tooling API response for table [{table_name}]: {err}"
            )
        except IndexError as err:
            logger.warning(
                f"Unable to get row for table [{table_name}] from EntityDefinition: {err}"
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unable to get description with Tooling API for table [{table_name}]: {exc}"
            )
        return table_description if table_description else object_label

    def yield_table(
        self, table_name_and_type: Tuple[str, TableType]
    ) -> Iterable[Either[CreateTableRequest]]:
        """
        From topology.
        Prepare a table request and pass it to the sink
        """
        table_name, table_type = table_name_and_type
        try:
            table_constraints = None
            salesforce_objects = self.client.restful(
                f"sobjects/{table_name}/describe/",
                params=None,
            )
            columns = self.get_columns(salesforce_objects.get("fields", []))
            table_request = CreateTableRequest(
                name=EntityName(table_name),
                tableType=table_type,
                description=self.get_table_description(
                    table_name, salesforce_objects.get("label")
                ),
                columns=columns,
                tableConstraints=table_constraints,
                databaseSchema=FullyQualifiedEntityName(
                    fqn.build(
                        metadata=self.metadata,
                        entity_type=DatabaseSchema,
                        service_name=self.context.get().database_service,
                        database_name=self.context.get().database,
                        schema_name=self.context.get().database_schema,
                    )
                ),
                sourceUrl=self.get_source_url(
                    table_name=table_name,
                ),
            )
            yield Either(right=table_request)
            self.register_record(table_request=table_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=table_name,
                    error=f"Unexpected exception for table [{table_name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_columns(self, salesforce_fields):
        """
        Method to handle column details
        """
        row_order = 1
        columns = []
        for column in salesforce_fields:
            col_constraint = None
            if column["nillable"]:
                col_constraint = Constraint.NULL
            elif not column["nillable"]:
                col_constraint = Constraint.NOT_NULL
            if column["unique"]:
                col_constraint = Constraint.UNIQUE

            columns.append(
                Column(
                    name=column["name"],
                    description=column["label"],
                    dataType=self.column_type(column["type"].upper()),
                    dataTypeDisplay=column["type"],
                    constraint=col_constraint,
                    ordinalPosition=row_order,
                    dataLength=column["length"],
                )
            )
            row_order += 1
        return columns

    def column_type(self, column_type: str):
        if column_type in {
            "ID",
            "PHONE",
            "EMAIL",
            "ENCRYPTEDSTRING",
            "COMBOBOX",
            "URL",
            "TEXTAREA",
            "ADDRESS",
            "REFERENCE",
        }:
            return DataType.VARCHAR.value
        return DataType.UNKNOWN.value

    def yield_view_lineage(self) -> Iterable[Either[AddLineageRequest]]:
        yield from []

    def yield_tag(
        self, schema_name: str
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """No tags to pick up"""

    def get_stored_procedures(self) -> Iterable[Any]:
        """Not implemented"""

    def yield_stored_procedure(
        self, stored_procedure: Any
    ) -> Iterable[Either[CreateStoredProcedureRequest]]:
        """Not implemented"""

    def get_stored_procedure_queries(self) -> Iterable[QueryByProcedure]:
        """Not Implemented"""

    def yield_procedure_lineage_and_queries(
        self,
    ) -> Iterable[Either[Union[AddLineageRequest, CreateQueryRequest]]]:
        """Not Implemented"""
        yield from []

    def standardize_table_name(  # pylint: disable=unused-argument
        self, schema: str, table: str
    ) -> str:
        return table

    def prepare(self):
        """Nothing to prepare"""

    def get_source_url(
        self,
        table_name: Optional[str] = None,
    ) -> Optional[str]:
        """
        Method to get the source url for salesforce
        """
        try:
            instance_url = self.client.sf_instance
            if instance_url:
                return f"https://{instance_url}/lightning/o/{table_name}/list"
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unable to get source url for {table_name}: {exc}")
        return None

    def close(self):
        """Nothing to close"""

    def test_connection(self) -> None:
        test_connection_fn = get_test_connection_fn(self.service_connection)
        result = test_connection_fn(self.client, self.service_connection)
        raise_test_connection_exception(result)
