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
DataLake connector to fetch metadata from a files stored s3, gcs and Hdfs
"""
import traceback
import uuid
from sys import prefix
from typing import Iterable, Optional

import boto3
import dask.dataframe as dd
import gcsfs
import pandas as pd
import pyarrow.parquet as pq

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, Table, TableData
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
    GCSConfig,
    S3Config,
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
from metadata.utils.connections import get_connection
from metadata.utils.filters import filter_by_table
from metadata.utils.gcs_utils import (
    read_csv_from_gcs,
    read_json_from_gcs,
    read_parquet_from_gcs,
    read_tsv_from_gcs,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.s3_utils import (
    read_csv_from_s3,
    read_json_from_s3,
    read_parquet_from_s3,
    read_tsv_from_s3,
)

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
        self.client = self.connection.client if self.connection else None

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

            bucket_name = self.service_connection.bucketName
            prefix = self.service_connection.prefix

            if isinstance(self.service_connection.configSource, GCSConfig):
                if bucket_name:
                    yield from self.get_gcs_files(bucket_name, prefix)
                else:
                    for bucket in self.client.list_buckets():
                        yield from self.get_gcs_files(bucket.name, prefix)

            if isinstance(self.service_connection.configSource, S3Config):
                if bucket_name:
                    yield from self.get_s3_files(bucket_name, prefix)
                else:
                    for bucket in self.client.list_buckets()["Buckets"]:
                        yield from self.get_s3_files(bucket["Name"], prefix)

        except Exception as err:
            logger.error(traceback.format_exc())
            logger.error(err)

    def get_gcs_files(self, bucket_name, prefix):

        bucket = self.client.get_bucket(bucket_name)

        for key in bucket.list_blobs(prefix=prefix):
            try:
                if filter_by_table(
                    self.config.sourceConfig.config.tableFilterPattern, key.name
                ):
                    self.status.filter(
                        "{}".format(key["Key"]),
                        "Table pattern not allowed",
                    )
                    continue

                if key.name.endswith(".csv"):

                    df = read_csv_from_gcs(key, bucket_name)

                    yield from self.ingest_tables(key.name, df, bucket_name)

                if key.name.endswith(".tsv"):

                    df = read_tsv_from_gcs(key, bucket_name)

                    yield from self.ingest_tables(key.name, df, bucket_name)

                if key.name.endswith(".json"):

                    df = read_json_from_gcs(key)

                    yield from self.ingest_tables(key.name, df, bucket_name)

                if key.name.endswith(".parquet"):

                    df = read_parquet_from_gcs(key, bucket_name)

                    yield from self.ingest_tables(key.name, df, bucket_name)

            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(err)

    def get_s3_files(self, bucket_name, prefix):
        kwargs = {"Bucket": bucket_name}
        if prefix:
            kwargs["prefix"] = prefix
        for key in self.client.list_objects(**kwargs)["Contents"]:
            try:
                if filter_by_table(
                    self.config.sourceConfig.config.tableFilterPattern, key["Key"]
                ):
                    self.status.filter(
                        "{}".format(key["Key"]),
                        "Table pattern not allowed",
                    )
                    continue
                if key["Key"].endswith(".csv"):

                    df = read_csv_from_s3(self.client, key, bucket_name)

                    yield from self.ingest_tables(key["Key"], df, bucket_name)

                if key["Key"].endswith(".tsv"):

                    df = read_tsv_from_s3(self.client, key, bucket_name)

                    yield from self.ingest_tables(key["Key"], df, bucket_name)

                if key["Key"].endswith(".json"):

                    df = read_json_from_s3(self.client, key, bucket_name)

                    yield from self.ingest_tables(key["Key"], df, bucket_name)

                if key["Key"].endswith(".parquet"):

                    df = read_parquet_from_s3(self.client, key, bucket_name)

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

            yield table_and_db

        except Exception as err:
            logger.debug(traceback.format_exc())
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
                if hasattr(df[column], "dtypes"):
                    if df[column].dtypes.name == "int64":
                        data_type = "INT"
                    if df[column].dtypes.name == "object":
                        data_type = "INT"
                else:
                    data_type = "STRING"
                parsed_string = {}
                parsed_string["dataTypeDisplay"] = column
                parsed_string["dataType"] = data_type
                parsed_string["name"] = column[:64]
                parsed_string["dataLength"] = parsed_string.get("dataLength", 1)
                yield Column(**parsed_string)
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(err)

    def close(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.status

    def test_connection(self) -> None:
        pass
