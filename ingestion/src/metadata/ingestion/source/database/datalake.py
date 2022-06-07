import traceback
import uuid
from io import StringIO
from typing import Iterable, Optional

import pandas as pd

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, Table, TableData
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
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


class DatalakeSource(Source[Entity]):
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
        self.s3 = self.connection.client

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: DatalakeConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, DatalakeConnection):
            raise InvalidSourceException(
                f"Expected DatalakeConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[Entity]:
        try:

            bucket_name = self.service_connection.base_path

            yield from self.get_s3_data(bucket_name)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(err)

    def get_s3_data(self, bucket_name):
        for key in self.s3.list_objects(Bucket=bucket_name)["Contents"]:
            try:
                if key["Key"].endswith("csv"):
                    print("##" * 100)
                    print(key["Key"])
                    csv_obj = self.s3.get_object(Bucket=bucket_name, Key=key["Key"])
                    body = csv_obj["Body"]
                    csv_string = body.read().decode("utf-8")
                    df = pd.read_csv(StringIO(csv_string))
                    if filter_by_table(
                        self.config.sourceConfig.config.tableFilterPattern, key["Key"]
                    ):
                        self.status.filter(
                            "{}".format(key["Key"]),
                            "Table pattern not allowed",
                        )
                        continue
                    yield from self.ingest_tables(key["Key"], df, bucket_name)
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(err)

    def ingest_tables(self, key, df, bucket_name) -> Iterable[OMetaDatabaseAndTable]:
        try:
            table_columns = self.get_columns(df)
            database_entity = Database(
                id=uuid.uuid4(),
                name="default",
                service=EntityReference(id=self.service.id, type="databaseService"),
            )
            table_entity = Table(
                id=uuid.uuid4(),
                name=key,
                description="",
                columns=table_columns,
            )
            schema_entity = DatabaseSchema(
                id=uuid.uuid4(),
                name=bucket_name,
                database=EntityReference(id=database_entity.id, type="database"),
                service=EntityReference(id=self.service.id, type="databaseService"),
            )
            table_and_db = OMetaDatabaseAndTable(
                table=table_entity,
                database=database_entity,
                database_schema=schema_entity,
            )
            try:
                if self.source_config.generateSampleData:
                    table_data = self.fetch_sample_data(df, bucket_name)
                    if table_data:
                        table_entity.sampleData = table_data
                        print("table_data", table_entity.sampleData)
            # Catch any errors during the ingestion and continue
            except Exception as err:  # pylint: disable=broad-except
                logger.error(repr(err))
                logger.error(traceback.format_exc())
                logger.error(err)

            yield table_and_db

        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(traceback.format_exc())
            logger.error(err)

    def fetch_sample_data(self, df, table: str) -> Optional[TableData]:
        try:
            cols = []
            table_columns = self.get_columns(df)

            for col in table_columns:
                cols.append(col.name.__root__)
            table_rows = df.values.tolist()

            return TableData(columns=cols, rows=table_rows)
        # Catch any errors and continue the ingestion
        except Exception as err:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to generate sample data for {table} - {err}")
        return None

    def get_columns(self, df):
        df_columns = list(df.columns)
        for column in df_columns:
            try:

                if df[column].dtypes.name == "int64":
                    data_type = "INT"
                if df[column].dtypes.name == "object":
                    data_type = "INT"
                parsed_string = {}
                parsed_string["dataTypeDisplay"] = column
                parsed_string["dataType"] = data_type
                parsed_string["name"] = column[:64]
                parsed_string["dataLength"] = parsed_string.get("dataLength", 1)
                yield Column(**parsed_string)
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(traceback.format_exc())
                logger.error(err)

    def close(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.status

    def test_connection(self) -> None:
        pass

    @staticmethod
    def _get_bucket_name_with_prefix(bucket_name: str) -> str:
        return (
            "s3://" + bucket_name
            if not bucket_name.startswith("s3://")
            else bucket_name
        )
