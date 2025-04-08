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
Deltalake PySpark Client
"""
import re
import traceback
from enum import Enum
from typing import Any, Callable, Dict, Iterable, List, Optional

from pyspark.sql.utils import AnalysisException, ParseException

from metadata.generated.schema.entity.data.table import Column, TableType
from metadata.generated.schema.entity.services.connections.database.deltalake.metastoreConfig import (
    MetastoreConfig,
    MetastoreDbConnection,
)
from metadata.generated.schema.entity.services.connections.database.deltaLakeConnection import (
    DeltaLakeConnection,
)
from metadata.ingestion.connections.builders import get_connection_args_common
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.deltalake.clients.base import (
    DeltalakeBaseClient,
    TableInfo,
)
from metadata.utils.constants import DEFAULT_DATABASE
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SparkTableType(Enum):
    MANAGED = "MANAGED"
    TEMPORARY = "TEMPORARY"
    VIEW = "VIEW"
    EXTERNAL = "EXTERNAL"


TABLE_TYPE_MAP = {
    SparkTableType.MANAGED.value: TableType.Regular,
    SparkTableType.VIEW.value: TableType.View,
    SparkTableType.EXTERNAL.value: TableType.External,
}

ARRAY_CHILD_START_INDEX = 6
ARRAY_CHILD_END_INDEX = -1

ARRAY_DATATYPE_REPLACE_MAP = {"(": "<", ")": ">", "=": ":", "<>": ""}


class DeltalakePySparkClient(DeltalakeBaseClient):
    def __init__(self, spark_session):
        self._spark = spark_session

    @classmethod
    def from_config(cls, config: DeltaLakeConnection) -> "DeltalakeBaseClient":
        """Returns a Deltalake Client based on the DeltalakeConfig passed."""
        import pyspark
        from delta import configure_spark_with_delta_pip

        builder = (
            pyspark.sql.SparkSession.builder.appName(
                config.configSource.appName or "OpenMetadata"
            )
            .enableHiveSupport()
            .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
            .config(
                "spark.sql.catalog.spark_catalog",
                "org.apache.spark.sql.delta.catalog.DeltaCatalog",
            )
            # Download delta-core jars when creating the SparkSession
            .config("spark.jars.packages", "io.delta:delta-core_2.12:2.0.0")
        )

        # Check that the attribute exists and is properly informed
        if (
            hasattr(config.configSource.connection, "metastoreHostPort")
            and config.configSource.connection.metastoreHostPort
        ):
            builder.config(
                "hive.metastore.uris",
                f"thrift://{config.configSource.connection.metastoreHostPort}",
            )

        if isinstance(config.configSource.connection, MetastoreDbConnection):
            if config.configSource.connection.metastoreDb:
                builder.config(
                    "spark.hadoop.javax.jdo.option.ConnectionURL",
                    config.configSource.connection.metastoreDb,
                )
            if config.configSource.connection.jdbcDriverClassPath:
                builder.config(
                    "spark.driver.extraClassPath",
                    config.configSource.connection.jdbcDriverClassPath,
                )
            if config.configSource.connection.username:
                builder.config(
                    "spark.hadoop.javax.jdo.option.ConnectionUserName",
                    config.configSource.connection.username,
                )
            if config.configSource.connection.password:
                builder.config(
                    "spark.hadoop.javax.jdo.option.ConnectionPassword",
                    config.configSource.connection.password.get_secret_value(),
                )
            if config.configSource.connection.driverName:
                builder.config(
                    "spark.hadoop.javax.jdo.option.ConnectionDriverName",
                    config.configSource.connection.driverName,
                )
        if (
            hasattr(config.configSource.connection, "metastoreFilePath")
            and config.configSource.connection.metastoreFilePath
        ):
            # From https://stackoverflow.com/questions/38377188/how-to-get-rid-of-derby-log-metastore-db-from-spark-shell
            # derby.system.home is the one in charge of the path for `metastore_db` dir and `derby.log`
            # We can use this option to control testing, as well as to properly point to the right
            # local database when ingesting data
            builder.config(
                "spark.driver.extraJavaOptions",
                f"-Dderby.system.home={config.configSource.connection.metastoreFilePath}",
            )

        for key, value in get_connection_args_common(config).items():
            builder.config(key, value)

        return cls(spark_session=configure_spark_with_delta_pip(builder).getOrCreate())

    def get_database_names(
        self, service_connection: DeltaLakeConnection
    ) -> Iterable[str]:
        """Returns the Database Names, based on the underlying client."""
        yield service_connection.databaseName or DEFAULT_DATABASE

    def get_database_schema_names(
        self, service_connection: DeltaLakeConnection
    ) -> Iterable[str]:
        """Returns the RAW database schema names, based on the underlying client."""
        for schema in self._spark.catalog.listDatabases():
            yield schema.name

    def get_table_info(
        self, service_connection: DeltaLakeConnection, schema_name: str
    ) -> Iterable[TableInfo]:
        """Returns the Tables name and type, based on the underlying client."""
        for table in self._spark.catalog.listTables(dbName=schema_name):

            if table.tableType == SparkTableType.TEMPORARY.value:
                logger.debug(f"Skipping temporary table {table.name}")
                continue

            yield TableInfo(
                schema=schema_name,
                name=table.name,
                description=table.description,
                _type=TABLE_TYPE_MAP.get(table.tableType, TableType.Regular),
            )

    def update_table_info(self, table_info: TableInfo) -> TableInfo:
        return TableInfo(
            schema=table_info.schema,
            name=table_info.name,
            _type=table_info._type,
            location=table_info.location,
            description=table_info.description,
            columns=self.get_columns(table_info.schema, table_info.name),
            table_partitions=table_info.table_partitions,
        )

    def _check_col_length(self, datatype, col_raw_type):
        if datatype and datatype.upper() in {"CHAR", "VARCHAR", "BINARYU", "VARBINARY"}:
            try:
                return col_raw_type.length if col_raw_type.length else 1
            except AttributeError:
                return 1
        return None

    def _get_display_data_type(self, row):
        display_data_type = repr(row["data_type"]).lower()
        for original, new in ARRAY_DATATYPE_REPLACE_MAP.items():
            display_data_type = display_data_type.replace(original, new)
        return display_data_type

    def _get_col_info(self, row):
        parsed_string = ColumnTypeParser._parse_datatype_string(row["data_type"])

        if parsed_string:
            parsed_string["dataLength"] = self._check_col_length(
                parsed_string["dataType"], row["data_type"]
            )
            if row["data_type"] == "array":
                array_data_type_display = self._get_display_data_type(row)
                parsed_string["dataTypeDisplay"] = array_data_type_display
                # Parse Primitive Datatype string
                # if Datatype is Array(int) -> Parse int
                parsed_string[
                    "arrayDataType"
                ] = ColumnTypeParser._parse_primitive_datatype_String(
                    array_data_type_display[
                        ARRAY_CHILD_START_INDEX:ARRAY_CHILD_END_INDEX
                    ]
                )[
                    "dataType"
                ]

            column = Column(name=row["col_name"], **parsed_string)
        else:
            col_type = re.search(r"^\w+", row["data_type"]).group(0)
            charlen = re.search(r"\(([\d]+)\)", row["data_type"])
            if charlen:
                charlen = int(charlen.group(1))
            if (
                col_type.upper() in {"CHAR", "VARCHAR", "VARBINARY", "BINARY"}
                and charlen is None
            ):
                charlen = 1
            column = Column(
                name=row["col_name"],
                description=row.get("comment"),
                dataType=col_type,
                dataLength=charlen,
                displayName=row["data_type"],
            )
        return column

    def fetch_view_schema(self, view_name: str) -> Optional[Dict]:
        try:
            describe_output = self._spark.sql(
                f"describe extended {view_name}"
            ).collect()
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unexpected exception to fetch view schema [{view_name}]: {exc}"
            )
            return None

        view_detail = {}
        col_details = False

        for row in describe_output:
            row_dict = row.asDict()
            if col_details:
                view_detail[row_dict["col_name"]] = row_dict["data_type"]
            if "# Detailed Table" in row_dict["col_name"]:
                col_details = True
        return view_detail.get("View Text")

    def get_columns(self, schema: str, table: str) -> List[Column]:
        field_dict: Dict[str, Any] = {}
        table_name = f"{schema}.{table}"

        try:
            raw_columns = self._spark.sql(f"describe {table_name}").collect()
            for field in self._spark.table(f"{table_name}").schema:
                field_dict[field.name] = field
        except (AnalysisException, ParseException) as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unexpected exception getting columns for [{table_name}]: {exc}"
            )
            return []

        parsed_columns: List[Column] = []
        partition_cols = False
        for row in raw_columns:
            col_name = row["col_name"]
            if col_name == "" or "#" in col_name:
                partition_cols = True
                continue
            if not partition_cols:
                column = self._get_col_info(row)
                parsed_columns.append(column)

        return parsed_columns

    def close(self, service_connection: DeltaLakeConnection):
        """Closes the Client connection."""
        pass

    def get_test_get_databases_fn(self, config: MetastoreConfig) -> Callable:
        """Returns a Callable used to test the GetDatabases condition."""
        return self._spark.catalog.listDatabases

    def get_test_get_tables_fn(self, config: MetastoreConfig) -> Callable:
        """Returns a Callable used to test the GetTables condition."""

        def test_get_tables():
            for database in self._spark.catalog.listDatabases():
                if database:
                    self._spark.catalog.listTables(database[0])
                    break

        return test_get_tables
