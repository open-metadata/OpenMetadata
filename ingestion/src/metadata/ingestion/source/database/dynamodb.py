import traceback
from typing import Iterable, Optional, Tuple

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Column, TableType
from metadata.generated.schema.entity.services.connections.database.dynamoDBConnection import (
    DynamoDBConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException, SourceStatus
from metadata.ingestion.models.ometa_tag_category import OMetaTagAndCategory
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.database_service import (
    DatabaseServiceSource,
    SQLSourceStatus,
)
from metadata.utils.column_type_parser import ColumnTypeParser
from metadata.utils.connections import get_connection
from metadata.utils.filters import filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DynamodbSource(DatabaseServiceSource):
    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        self.status = SQLSourceStatus()
        self.config = config
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.service_connection = self.config.serviceConnection.__root__.config
        self.service = self.metadata.get_service_or_create(
            entity=DatabaseService, config=config
        )
        self.connection = get_connection(self.service_connection)
        self.dynamodb = self.connection.client
        self.database_source_state = set()
        super().__init__()

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: DynamoDBConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, DynamoDBConnection):
            raise InvalidSourceException(
                f"Expected DynamoDBConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def prepare(self):
        pass

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
        if self.service_connection.__dict__.get("databaseSchema"):
            yield self.service_connection.databaseSchema

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
        if self.source_config.includeTables:
            tables = list(self.dynamodb.tables.all())
            for table in tables:
                if filter_by_table(
                    self.source_config.tableFilterPattern, table_name=table.name
                ):
                    self.status.filter(
                        f"{self.config.serviceName}.{table.name}",
                        "Table pattern not allowed",
                    )
                    continue
                table_name = self.standardize_table_name(schema_name, table.name)
                yield table_name, TableType.Regular

    def get_columns(self, column_data):
        for column in column_data:
            try:
                if "S" in column["AttributeType"].upper():
                    column["AttributeType"] = column["AttributeType"].replace(" ", "")
                parsed_string = ColumnTypeParser._parse_datatype_string(
                    column["AttributeType"].lower()
                )
                if isinstance(parsed_string, list):
                    parsed_string = {}
                    parsed_string["dataTypeDisplay"] = str(column["AttributeType"])
                    parsed_string["dataType"] = "UNION"
                parsed_string["name"] = column["AttributeName"][:64]
                parsed_string["dataLength"] = parsed_string.get("dataLength", 1)
                yield Column(**parsed_string)
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.debug(traceback.format_exc())
                logger.error(err)

    def yield_table(
        self, table_name_and_type: Tuple[str, str]
    ) -> Iterable[Optional[CreateTableRequest]]:
        """
        From topology.
        Prepare a table request and pass it to the sink
        """
        table_name, table_type = table_name_and_type
        try:
            table = self.dynamodb.Table(table_name)
            columns = self.get_columns(table.attribute_definitions)

            table_request = CreateTableRequest(
                name=table_name,
                tableType=table_type,
                description="",
                columns=columns,
                tableConstraints=None,
                databaseSchema=EntityReference(
                    id=self.context.database_schema.id,
                    type="databaseSchema",
                ),
            )

            yield table_request
            self.register_record(table_request=table_request)

        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(err)
            self.status.failures.append(
                "{}.{}".format(self.config.serviceName, table_name)
            )

    def yield_view_lineage(
        self, table_name_and_type: Tuple[str, str]
    ) -> Optional[Iterable[AddLineageRequest]]:
        pass

    def yield_tag(self, schema_name: str) -> Iterable[OMetaTagAndCategory]:
        pass

    def standardize_table_name(self, schema: str, table: str) -> str:
        return table

    def close(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.status

    def test_connection(self) -> None:
        pass
