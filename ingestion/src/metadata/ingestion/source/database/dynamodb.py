import traceback
import uuid
from typing import Iterable

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, Table, TableData
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
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import SQLSourceStatus
from metadata.utils.column_type_parser import ColumnTypeParser
from metadata.utils.connections import get_connection
from metadata.utils.filters import filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DynamodbSource(Source[Entity]):
    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__()
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

    def next_record(self) -> Iterable[Entity]:
        try:
            table_list = list(self.dynamodb.tables.all())
            if not table_list:
                return
            yield from self.ingest_tables()
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(err)

    def ingest_tables(self, next_tables_token=None) -> Iterable[OMetaDatabaseAndTable]:
        tables = list(self.dynamodb.tables.all())
        for table in tables:
            try:
                if filter_by_table(
                    self.config.sourceConfig.config.tableFilterPattern, table.name
                ):
                    self.status.filter(
                        "{}".format(table.name),
                        "Table pattern not allowed",
                    )
                    continue
                database_entity = Database(
                    id=uuid.uuid4(),
                    name="default",
                    service=EntityReference(id=self.service.id, type="databaseService"),
                )

                table_columns = self.get_columns(table.attribute_definitions)
                table_entity = Table(
                    id=uuid.uuid4(),
                    name=table.name,
                    description="",
                    columns=table_columns,
                )
                schema_entity = DatabaseSchema(
                    id=uuid.uuid4(),
                    name=self.config.serviceConnection.__root__.config.database,
                    database=EntityReference(id=database_entity.id, type="database"),
                    service=EntityReference(id=self.service.id, type="databaseService"),
                )
                table_and_db = OMetaDatabaseAndTable(
                    table=table_entity,
                    database=database_entity,
                    database_schema=schema_entity,
                )

                yield table_and_db

            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.debug(traceback.format_exc())
                logger.error(err)

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

    def close(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.status

    def test_connection(self) -> None:
        pass
