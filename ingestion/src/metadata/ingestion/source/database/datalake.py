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
from typing import Iterable, Optional, Tuple

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import (
    Column,
    DataType,
    TableData,
    TableType,
)
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
from metadata.ingestion.api.source import InvalidSourceException, SourceStatus
from metadata.ingestion.models.ometa_tag_category import OMetaTagAndCategory
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.database_service import (
    DatabaseServiceSource,
    SQLSourceStatus,
)
from metadata.utils.connections import get_connection, test_connection
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

DATALAKE_INT_TYPES = {"int64", "INT"}

DATALAKE_SUPPORTED_FILE_TYPES = (".csv", ".tsv", ".json", ".parquet")


class DatalakeSource(DatabaseServiceSource):
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
        self.client = self.connection.client
        self.table_constraints = None
        self.database_source_state = set()
        super().__init__()

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: DatalakeConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, DatalakeConnection):
            raise InvalidSourceException(
                f"Expected DatalakeConnection, but got {connection}"
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
        bucket_name = self.service_connection.bucketName
        if isinstance(self.service_connection.configSource, GCSConfig):
            if bucket_name:
                yield bucket_name
            else:
                for bucket in self.client.list_buckets():
                    yield bucket.name

        if isinstance(self.service_connection.configSource, S3Config):
            if bucket_name:
                yield bucket_name
            else:
                for bucket in self.client.list_buckets()["Buckets"]:
                    yield bucket["Name"]

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
        bucket_name = self.context.database_schema.name.__root__
        prefix = self.service_connection.prefix
        if self.source_config.includeTables:
            if isinstance(self.service_connection.configSource, GCSConfig):
                bucket = self.client.get_bucket(bucket_name)
                for key in bucket.list_blobs(prefix=prefix):
                    if filter_by_table(
                        self.config.sourceConfig.config.tableFilterPattern, key.name
                    ):
                        self.status.filter(
                            "{}".format(key.name),
                            "Object pattern not allowed",
                        )
                        continue
                    if not self.check_valid_file_type(key.name):
                        logger.debug(
                            f"Object filtered due to unsupported file type: {key.name}"
                        )
                        continue
                    table_name = self.standardize_table_name(bucket_name, key.name)
                    yield table_name, TableType.Regular
            if isinstance(self.service_connection.configSource, S3Config):
                kwargs = {"Bucket": bucket_name}
                if prefix:
                    kwargs["Prefix"] = prefix if prefix.endswith("/") else f"{prefix}/"
                for key in self.client.list_objects(**kwargs)["Contents"]:
                    if filter_by_table(
                        self.config.sourceConfig.config.tableFilterPattern, key["Key"]
                    ):
                        self.status.filter(
                            "{}".format(key["Key"]),
                            "Object pattern not allowed",
                        )
                        continue
                    if not self.check_valid_file_type(key["Key"]):
                        logger.debug(
                            f"Object filtered due to unsupported file type: {key['Key']}"
                        )
                        continue
                    table_name = self.standardize_table_name(bucket_name, key["Key"])
                    yield table_name, TableType.Regular

    def yield_table(
        self, table_name_and_type: Tuple[str, str]
    ) -> Iterable[Optional[CreateTableRequest]]:
        """
        From topology.
        Prepare a table request and pass it to the sink
        """
        table_name, table_type = table_name_and_type
        schema_name = self.context.database_schema.name.__root__
        try:
            table_constraints = None
            if isinstance(self.service_connection.configSource, GCSConfig):
                df = self.get_gcs_files(key=table_name, bucket_name=schema_name)
            if isinstance(self.service_connection.configSource, S3Config):
                df = self.get_s3_files(key=table_name, bucket_name=schema_name)
            columns = self.get_columns(df)
            table_request = CreateTableRequest(
                name=table_name,
                tableType=table_type,
                description="",
                columns=columns,
                tableConstraints=table_constraints if table_constraints else None,
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

    def get_gcs_files(self, key, bucket_name):
        try:
            if key.endswith(".csv"):
                return read_csv_from_gcs(key, bucket_name)

            if key.endswith(".tsv"):
                return read_tsv_from_gcs(key, bucket_name)

            if key.endswith(".json"):
                return read_json_from_gcs(self.client, key, bucket_name)

            if key.endswith(".parquet"):
                return read_parquet_from_gcs(key, bucket_name)

        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(err)

    def get_s3_files(self, key, bucket_name):
        try:
            if key.endswith(".csv"):
                return read_csv_from_s3(self.client, key, bucket_name)

            if key.endswith(".tsv"):
                return read_tsv_from_s3(self.client, key, bucket_name)

            if key.endswith(".json"):
                return read_json_from_s3(self.client, key, bucket_name)

            if key.endswith(".parquet"):
                return read_parquet_from_s3(self.client, key, bucket_name)

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
        if hasattr(df, "columns"):
            df_columns = list(df.columns)
            for column in df_columns:
                try:
                    if (
                        hasattr(df[column], "dtypes")
                        and df[column].dtypes.name in DATALAKE_INT_TYPES
                    ):
                        if df[column].dtypes.name == "int64":
                            data_type = DataType.INT.value
                    else:
                        data_type = DataType.STRING.value
                    parsed_string = {}
                    parsed_string["dataTypeDisplay"] = data_type
                    parsed_string["dataType"] = data_type
                    parsed_string["name"] = column[:64]
                    parsed_string["dataLength"] = parsed_string.get("dataLength", 1)
                    yield Column(**parsed_string)
                except Exception as err:
                    logger.debug(traceback.format_exc())
                    logger.error(err)

    def yield_view_lineage(
        self, table_name_and_type: Tuple[str, str]
    ) -> Optional[Iterable[AddLineageRequest]]:
        pass

    def yield_tag(self, schema_name: str) -> Iterable[OMetaTagAndCategory]:
        pass

    def standardize_table_name(self, schema: str, table: str) -> str:
        return table

    def check_valid_file_type(self, key_name):
        if key_name.endswith(DATALAKE_SUPPORTED_FILE_TYPES):
            return True
        return False

    def close(self):
        pass

    def get_status(self) -> SourceStatus:
        return self.status

    def test_connection(self) -> None:
        test_connection(self.connection)
