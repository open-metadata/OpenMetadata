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
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import (
    Column,
    DataType,
    Table,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    AzureConfig,
    DatalakeConnection,
    GCSConfig,
    S3Config,
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
from metadata.ingestion.source.database.datalake.models import DatalakeColumnWrapper
from metadata.utils import fqn
from metadata.utils.filters import filter_by_schema, filter_by_table
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

DATALAKE_DATA_TYPES = {
    **dict.fromkeys(["int64", "INT", "int32"], DataType.INT.value),
    "object": DataType.STRING.value,
    **dict.fromkeys(["float64", "float32", "float"], DataType.FLOAT.value),
    "bool": DataType.BOOLEAN.value,
    **dict.fromkeys(
        ["datetime64", "timedelta[ns]", "datetime64[ns]"], DataType.DATETIME.value
    ),
}

JSON_SUPPORTED_TYPES = (".json", ".json.gz", ".json.zip")

DATALAKE_SUPPORTED_FILE_TYPES = (
    ".csv",
    ".tsv",
    ".parquet",
    ".avro",
) + JSON_SUPPORTED_TYPES


def ometa_to_dataframe(config_source, client, table):
    """
    Method to get dataframe for profiling
    """
    data = None
    if isinstance(config_source, GCSConfig):
        data = DatalakeSource.get_gcs_files(
            client=client,
            key=table.name.__root__,
            bucket_name=table.databaseSchema.name,
        )
    if isinstance(config_source, S3Config):
        data = DatalakeSource.get_s3_files(
            client=client,
            key=table.name.__root__,
            bucket_name=table.databaseSchema.name,
        )
    if isinstance(data, DatalakeColumnWrapper):
        data = data.dataframes
    return data


class DatalakeSource(DatabaseServiceSource):  # pylint: disable=too-many-public-methods
    """
    Implements the necessary methods to extract
    Database metadata from Datalake Source
    """

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        self.status = SQLSourceStatus()
        self.config = config
        self.source_config: DatabaseServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.service_connection = self.config.serviceConnection.__root__.config
        self.connection = get_connection(self.service_connection)
        self.client = self.connection.client
        self.table_constraints = None
        self.data_models = {}
        self.dbt_tests = {}
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

    def fetch_gcs_bucket_names(self):
        for bucket in self.client.list_buckets():
            schema_fqn = fqn.build(
                self.metadata,
                entity_type=DatabaseSchema,
                service_name=self.context.database_service.name.__root__,
                database_name=self.context.database.name.__root__,
                schema_name=bucket.name,
            )
            if filter_by_schema(
                self.config.sourceConfig.config.schemaFilterPattern,
                schema_fqn
                if self.config.sourceConfig.config.useFqnForFiltering
                else bucket.name,
            ):
                self.status.filter(schema_fqn, "Bucket Filtered Out")
                continue

            yield bucket.name

    def fetch_s3_bucket_names(self):
        for bucket in self.client.list_buckets()["Buckets"]:
            schema_fqn = fqn.build(
                self.metadata,
                entity_type=DatabaseSchema,
                service_name=self.context.database_service.name.__root__,
                database_name=self.context.database.name.__root__,
                schema_name=bucket["Name"],
            )
            if filter_by_schema(
                self.config.sourceConfig.config.schemaFilterPattern,
                schema_fqn
                if self.config.sourceConfig.config.useFqnForFiltering
                else bucket["Name"],
            ):
                self.status.filter(schema_fqn, "Bucket Filtered Out")
                continue
            yield bucket["Name"]

    def get_database_schema_names(self) -> Iterable[str]:
        """
        return schema names
        """
        bucket_name = self.service_connection.bucketName
        if isinstance(self.service_connection.configSource, GCSConfig):
            if bucket_name:
                yield bucket_name
            else:
                yield from self.fetch_gcs_bucket_names()

        if isinstance(self.service_connection.configSource, S3Config):
            if bucket_name:
                yield bucket_name
            else:
                yield from self.fetch_s3_bucket_names()

        if isinstance(self.service_connection.configSource, AzureConfig):
            yield from self.get_container_names()

    def get_container_names(self) -> Iterable[str]:
        """
        To get schema names
        """
        prefix = (
            self.service_connection.bucketName
            if self.service_connection.bucketName
            else ""
        )
        schema_names = self.client.list_containers(name_starts_with=prefix)
        for schema in schema_names:
            schema_fqn = fqn.build(
                self.metadata,
                entity_type=DatabaseSchema,
                service_name=self.context.database_service.name.__root__,
                database_name=self.context.database.name.__root__,
                schema_name=schema["name"],
            )
            if filter_by_schema(
                self.config.sourceConfig.config.schemaFilterPattern,
                schema_fqn
                if self.config.sourceConfig.config.useFqnForFiltering
                else schema["name"],
            ):
                self.status.filter(schema_fqn, "Container Filtered Out")
                continue

            yield schema["name"]

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

    def _list_s3_objects(self, **kwargs) -> Iterable:
        try:
            paginator = self.client.get_paginator("list_objects_v2")
            for page in paginator.paginate(**kwargs):
                yield from page.get("Contents", [])
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected exception to yield s3 object: {exc}")

    def get_tables_name_and_type(  # pylint: disable=too-many-branches
        self,
    ) -> Optional[Iterable[Tuple[str, str]]]:
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
                    table_name = self.standardize_table_name(bucket_name, key.name)
                    # adding this condition as the gcp blobs also contains directory, which we can filter out
                    if table_name.endswith("/") or not self.check_valid_file_type(
                        key.name
                    ):
                        logger.debug(
                            f"Object filtered due to unsupported file type: {key.name}"
                        )
                        continue
                    table_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.context.database_service.name.__root__,
                        database_name=self.context.database.name.__root__,
                        schema_name=self.context.database_schema.name.__root__,
                        table_name=table_name,
                        skip_es_search=True,
                    )

                    if filter_by_table(
                        self.config.sourceConfig.config.tableFilterPattern,
                        table_fqn
                        if self.config.sourceConfig.config.useFqnForFiltering
                        else table_name,
                    ):
                        self.status.filter(
                            table_fqn,
                            "Object Filtered Out",
                        )
                        continue

                    yield table_name, TableType.Regular
            if isinstance(self.service_connection.configSource, S3Config):
                kwargs = {"Bucket": bucket_name}
                if prefix:
                    kwargs["Prefix"] = prefix if prefix.endswith("/") else f"{prefix}/"
                for key in self._list_s3_objects(**kwargs):
                    table_name = self.standardize_table_name(bucket_name, key["Key"])
                    table_fqn = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.context.database_service.name.__root__,
                        database_name=self.context.database.name.__root__,
                        schema_name=self.context.database_schema.name.__root__,
                        table_name=table_name,
                        skip_es_search=True,
                    )
                    if filter_by_table(
                        self.config.sourceConfig.config.tableFilterPattern,
                        table_fqn
                        if self.config.sourceConfig.config.useFqnForFiltering
                        else table_name,
                    ):

                        self.status.filter(
                            table_fqn,
                            "Object Filtered Out",
                        )
                        continue
                    if not self.check_valid_file_type(key["Key"]):
                        logger.debug(
                            f"Object filtered due to unsupported file type: {key['Key']}"
                        )
                        continue

                    yield table_name, TableType.Regular
            if isinstance(self.service_connection.configSource, AzureConfig):
                files_names = self.get_tables(container_name=bucket_name)
                for file in files_names.list_blobs(name_starts_with=prefix):
                    file_name = file.name
                    if "/" in file.name:
                        table_name = self.standardize_table_name(bucket_name, file_name)
                        table_fqn = fqn.build(
                            self.metadata,
                            entity_type=Table,
                            service_name=self.context.database_service.name.__root__,
                            database_name=self.context.database.name.__root__,
                            schema_name=self.context.database_schema.name.__root__,
                            table_name=table_name,
                            skip_es_search=True,
                        )
                        if filter_by_table(
                            self.config.sourceConfig.config.tableFilterPattern,
                            table_fqn
                            if self.config.sourceConfig.config.useFqnForFiltering
                            else table_name,
                        ):
                            self.status.filter(
                                table_fqn,
                                "Object Filtered Out",
                            )
                            continue
                        if not self.check_valid_file_type(file_name):
                            logger.debug(
                                f"Object filtered due to unsupported file type: {file_name}"
                            )
                            continue
                        yield file_name, TableType.Regular

    def get_tables(self, container_name) -> Iterable[any]:
        tables = self.client.get_container_client(container_name)
        return tables

    def yield_table(
        self, table_name_and_type: Tuple[str, str]
    ) -> Iterable[Optional[CreateTableRequest]]:
        """
        From topology.
        Prepare a table request and pass it to the sink
        """
        from pandas import DataFrame  # pylint: disable=import-outside-toplevel

        table_name, table_type = table_name_and_type
        schema_name = self.context.database_schema.name.__root__
        columns = []
        try:
            table_constraints = None
            if isinstance(self.service_connection.configSource, GCSConfig):
                data_frame = self.get_gcs_files(
                    client=self.client, key=table_name, bucket_name=schema_name
                )
            if isinstance(self.service_connection.configSource, S3Config):
                connection_args = self.service_connection.configSource.securityConfig
                data_frame = self.get_s3_files(
                    client=self.client,
                    key=table_name,
                    bucket_name=schema_name,
                    client_kwargs=connection_args,
                )
            if isinstance(self.service_connection.configSource, AzureConfig):
                connection_args = self.service_connection.configSource.securityConfig
                storage_options = {
                    "tenant_id": connection_args.tenantId,
                    "client_id": connection_args.clientId,
                    "client_secret": connection_args.clientSecret.get_secret_value(),
                    "account_name": connection_args.accountName,
                }
                data_frame = self.get_azure_files(
                    client=self.client,
                    key=table_name,
                    container_name=schema_name,
                    storage_options=storage_options,
                )
            if isinstance(data_frame, DataFrame):
                columns = self.get_columns(data_frame)
            if isinstance(data_frame, list) and data_frame:
                columns = self.get_columns(data_frame[0])
            if isinstance(data_frame, DatalakeColumnWrapper):
                columns = data_frame.columns
            if columns:
                table_request = CreateTableRequest(
                    name=self._clean_name(table_name),
                    displayName=table_name,
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
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected exception to yield table [{table_name}]: {exc}")
            self.status.failures.append(f"{self.config.serviceName}.{table_name}")

    @staticmethod
    def get_gcs_files(client, key, bucket_name):
        """
        Fetch GCS Bucket files
        """
        from metadata.utils.gcs_utils import (  # pylint: disable=import-outside-toplevel
            read_avro_from_gcs,
            read_csv_from_gcs,
            read_json_from_gcs,
            read_parquet_from_gcs,
            read_tsv_from_gcs,
        )

        try:
            if key.endswith(".csv"):
                return read_csv_from_gcs(key, bucket_name)

            if key.endswith(".tsv"):
                return read_tsv_from_gcs(key, bucket_name)

            if key.endswith(JSON_SUPPORTED_TYPES):
                return read_json_from_gcs(client, key, bucket_name)

            if key.endswith(".parquet"):
                return read_parquet_from_gcs(key, bucket_name)

            if key.endswith(".avro"):
                return read_avro_from_gcs(client, key, bucket_name)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Unexpected exception to get GCS files from [{bucket_name}]: {exc}"
            )
        return None

    @staticmethod
    def get_azure_files(client, key, container_name, storage_options):
        """
        Fetch Azure Storage files
        """
        from metadata.utils.azure_utils import (  # pylint: disable=import-outside-toplevel
            read_avro_from_azure,
            read_csv_from_azure,
            read_json_from_azure,
            read_parquet_from_azure,
        )

        try:
            if key.endswith(".csv"):
                return read_csv_from_azure(client, key, container_name, storage_options)

            if key.endswith(JSON_SUPPORTED_TYPES):
                return read_json_from_azure(client, key, container_name)

            if key.endswith(".parquet"):
                return read_parquet_from_azure(
                    client, key, container_name, storage_options
                )

            if key.endswith(".tsv"):
                return read_csv_from_azure(
                    client, key, container_name, storage_options, sep="\t"
                )

            if key.endswith(".avro"):
                return read_avro_from_azure(client, key, container_name)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Unexpected exception get in azure for file [{key}] for {container_name}: {exc}"
            )
        return None

    @staticmethod
    def get_s3_files(client, key, bucket_name, client_kwargs=None):
        """
        Fetch S3 Bucket files
        """
        from metadata.utils.s3_utils import (  # pylint: disable=import-outside-toplevel
            read_avro_from_s3,
            read_csv_from_s3,
            read_json_from_s3,
            read_parquet_from_s3,
            read_tsv_from_s3,
        )

        try:
            if key.endswith(".csv"):
                return read_csv_from_s3(client, key, bucket_name)

            if key.endswith(".tsv"):
                return read_tsv_from_s3(client, key, bucket_name)

            if key.endswith(JSON_SUPPORTED_TYPES):
                return read_json_from_s3(client, key, bucket_name)

            if key.endswith(".parquet"):
                return read_parquet_from_s3(client_kwargs, key, bucket_name)

            if key.endswith(".avro"):
                return read_avro_from_s3(client, key, bucket_name)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Unexpected exception to get S3 file [{key}] from bucket [{bucket_name}]: {exc}"
            )
        return None

    @staticmethod
    def get_columns(data_frame):
        """
        method to process column details
        """
        cols = []
        if hasattr(data_frame, "columns"):
            df_columns = list(data_frame.columns)
            for column in df_columns:
                # use String by default
                data_type = DataType.STRING.value
                try:
                    if hasattr(data_frame[column], "dtypes"):
                        data_type = DATALAKE_DATA_TYPES.get(
                            data_frame[column].dtypes.name, DataType.STRING.value
                        )

                    parsed_string = {
                        "dataTypeDisplay": data_type,
                        "dataType": data_type,
                        "name": column[:64],
                    }
                    parsed_string["dataLength"] = parsed_string.get("dataLength", 1)
                    cols.append(Column(**parsed_string))
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Unexpected exception parsing column [{column}]: {exc}"
                    )

        return cols

    def yield_view_lineage(self) -> Optional[Iterable[AddLineageRequest]]:
        yield from []

    def yield_tag(self, schema_name: str) -> Iterable[OMetaTagAndClassification]:
        pass

    def standardize_table_name(
        self, schema: str, table: str  # pylint: disable=unused-argument
    ) -> str:
        return table

    def check_valid_file_type(self, key_name):
        if key_name.endswith(DATALAKE_SUPPORTED_FILE_TYPES):
            return True
        return False

    def close(self):
        if isinstance(self.service_connection.configSource, AzureConfig):
            self.client.close()

    def get_status(self) -> SourceStatus:
        return self.status

    def test_connection(self) -> None:

        test_connection_fn = get_test_connection_fn(self.service_connection)
        test_connection_fn(self.connection)

    def _clean_name(self, name: str) -> str:
        if len(name) > 128:
            return str(hash(name))
        return name
