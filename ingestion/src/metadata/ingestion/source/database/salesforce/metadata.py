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
from typing import Iterable, Optional, Tuple

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import (
    Column,
    Constraint,
    Table,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.salesforceConnection import (
    SalesforceConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException, SourceStatus
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection, get_test_connection_fn
from metadata.ingestion.source.database.database_service import (
    DatabaseServiceSource,
    SQLSourceStatus,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SalesforceSource(DatabaseServiceSource):
    """
    Implements the necessary methods to extract
    Database metadata from Salesforce Source
    """

    def __init__(self, config, metadata_config: OpenMetadataConnection):
        self.config = config
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.service_connection = self.config.serviceConnection.__root__.config
        self.status = SQLSourceStatus()
        self.client = get_connection(self.service_connection)
        self.table_constraints = None
        self.data_models = {}
        self.dbt_tests = {}
        self.database_source_state = set()
        super().__init__()

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: SalesforceConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, SalesforceConnection):
            raise InvalidSourceException(
                f"Expected SalesforceConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_database_names(self) -> Iterable[str]:
        """
        Default case with a single database.

        It might come informed - or not - from the source.

        Sources with multiple databases should overwrite this and
        apply the necessary filters.
        """
        database_name = "default"
        yield database_name

    def yield_database(self, database_name: str) -> Iterable[CreateDatabaseRequest]:
        """
        From topology.
        Prepare a database request and pass it to the sink
        """
        yield CreateDatabaseRequest(
            name=database_name,
            service=EntityReference(
                id=self.context.database_service.id,
                type="databaseService",
            ),
        )

    def get_database_schema_names(self) -> Iterable[str]:
        """
        return schema names
        """
        schema_name = self.service_connection.scheme.name
        yield schema_name

    def yield_database_schema(
        self, schema_name: str
    ) -> Iterable[CreateDatabaseSchemaRequest]:
        """
        From topology.
        Prepare a database schema request and pass it to the sink
        """
        yield CreateDatabaseSchemaRequest(
            name=schema_name,
            database=EntityReference(id=self.context.database.id, type="database"),
        )

    def get_tables_name_and_type(self) -> Optional[Iterable[Tuple[str, str]]]:
        """
        Handle table and views.

        Fetches them up using the context information and
        the inspector set when preparing the db.

        :return: tables or views, depending on config
        """
        schema_name = self.context.database_schema.name.__root__
        table_name = ""
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
                        service_name=self.context.database_service.name.__root__,
                        database_name=self.context.database.name.__root__,
                        schema_name=self.context.database_schema.name.__root__,
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
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unexpected exception for schema name [{schema_name}]: {exc}"
            )
            self.status.failures.append(f"{self.config.serviceName}.{table_name}")

    def yield_table(
        self, table_name_and_type: Tuple[str, str]
    ) -> Iterable[Optional[CreateTableRequest]]:
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
            columns = self.get_columns(salesforce_objects["fields"])
            table_request = CreateTableRequest(
                name=table_name,
                tableType=table_type,
                description="",
                columns=columns,
                tableConstraints=table_constraints,
                databaseSchema=EntityReference(
                    id=self.context.database_schema.id,
                    type="databaseSchema",
                ),
            )
            yield table_request
            self.register_record(table_request=table_request)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected exception for table [{table_name}]: {exc}")
            self.status.failures.append(f"{self.config.serviceName}.{table_name}")

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
                    constraint=col_constraint,
                    ordinalPosition=row_order,
                    dataLength=column["length"],
                )
            )
            row_order += 1
        return columns

    def column_type(self, column_type: str):
        if column_type in {"ID", "PHONE", "CURRENCY"}:
            return "INT"
        return "VARCHAR"

    def yield_view_lineage(self) -> Optional[Iterable[AddLineageRequest]]:
        yield from []

    def yield_tag(self, schema_name: str) -> Iterable[OMetaTagAndClassification]:
        pass

    def standardize_table_name(  # pylint: disable=unused-argument
        self, schema: str, table: str
    ) -> str:
        return table

    def prepare(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        pass

    def test_connection(self) -> None:
        test_connection_fn = get_test_connection_fn(self.service_connection)
        test_connection_fn(self.client)
