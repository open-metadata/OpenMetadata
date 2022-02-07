import logging
import traceback
import uuid
from typing import Any, Generic, Iterable, List

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.location import Location, LocationType
from metadata.generated.schema.entity.data.pipeline import Pipeline, Task
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity, IncludeFilterPattern
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_source_common import SQLSourceStatus
from metadata.utils.aws_client import AWSClient, AWSClientConfigModel
from metadata.utils.column_type_parser import ColumnTypeParser
from metadata.utils.helpers import get_database_service_or_create

logger: logging.Logger = logging.getLogger(__name__)


class DynamoDBSourceConfig(AWSClientConfigModel):
    service_type = "DynamoDB"
    service_name: str
    endpoint_url: str
    host_port: str = ""
    db_name = "DynamoDB"

    def get_service_type(self) -> DatabaseServiceType:
        return DatabaseServiceType[self.service_type]


class DynamodbSource(Source[Entity]):
    def __init__(
        self, config: DynamoDBSourceConfig, metadata_config: MetadataServerConfig, ctx
    ):
        super().__init__(ctx)
        self.status = SQLSourceStatus()

        self.config = config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.service = get_database_service_or_create(
            config, metadata_config, self.config.service_name
        )
        self.dynamodb = AWSClient(self.config).get_resource("dynamodb")

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = DynamoDBSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

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
            logger.debug(traceback.print_exc())
            logger.error(err)

    def ingest_tables(self, next_tables_token=None) -> Iterable[OMetaDatabaseAndTable]:
        try:
            tables = list(self.dynamodb.tables.all())
            for table in tables:
                database_entity = Database(
                    name=self.config.db_name,
                    service=EntityReference(id=self.service.id, type="databaseService"),
                )

                fqn = f"{self.config.service_name}.{database_entity.name}.{table}"
                self.dataset_name = fqn
                table_columns = self.get_columns(table.attribute_definitions)
                table_entity = Table(
                    id=uuid.uuid4(),
                    name=table.name,
                    description="",
                    fullyQualifiedName=fqn,
                    columns=table_columns,
                )
                table_and_db = OMetaDatabaseAndTable(
                    table=table_entity,
                    database=database_entity,
                )
                yield table_and_db
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.debug(traceback.print_exc())
            logger.error(err)

    def get_columns(self, column_data):
        for index, column in enumerate(column_data):
            try:
                if "S" in column["AttributeType"].lower():
                    column["AttributeType"] = column["AttributeType"].replace(" ", "")
                parsed_string = ColumnTypeParser._parse_datatype_string(
                    column["AttributeType"].lower()
                )
                if isinstance(parsed_string, list):
                    parsed_string = {}
                    parsed_string["dataTypeDisplay"] = str(column["AttributeType"])
                    parsed_string["dataType"] = "UNION"
                parsed_string["name"] = column["AttributeName"][:64]
                parsed_string["ordinalPosition"] = index
                parsed_string["dataLength"] = parsed_string.get("dataLength", 1)
                yield Column(**parsed_string)
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.debug(traceback.print_exc())
                logger.error(err)

    def close(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.status
