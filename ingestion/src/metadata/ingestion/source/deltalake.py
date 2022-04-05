import logging
import re
import uuid
from typing import Any, Dict, Iterable, List, Optional

import pyspark
from delta import configure_spark_with_delta_pip
from pyspark.sql import SparkSession
from pyspark.sql.catalog import Table as pyTable
from pyspark.sql.types import ArrayType, MapType, StructField, StructType
from pyspark.sql.utils import AnalysisException, ParseException

from metadata.config.common import ConfigModel
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Column, Table, TableType
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import IncludeFilterPattern, WorkflowContext
from metadata.ingestion.api.source import Source
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_source import SQLSourceStatus
from metadata.utils.column_type_parser import ColumnTypeParser
from metadata.utils.helpers import get_database_service_or_create

logger: logging.Logger = logging.getLogger(__name__)


class DeltalakeSourceConfig(ConfigModel):
    database: str = "delta"
    platform_name: str = "deltalake"
    metastore_host_port: Optional[str]
    metastore_file_path: Optional[str]
    app_name: str
    schema_filter_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()
    table_filter_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()
    service_name: str
    service_type: str = DatabaseServiceType.DeltaLake.value

    def get_service_name(self) -> str:
        return self.service_name

    def get_service_type(self) -> DatabaseServiceType:
        return DatabaseServiceType[self.service_type]


class DeltalakeSource(Source):
    spark: SparkSession = None

    def __init__(
        self,
        config: DeltalakeSourceConfig,
        metadata_config: MetadataServerConfig,
        ctx: WorkflowContext,
    ):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.service = get_database_service_or_create(
            config=config,
            metadata_config=metadata_config,
            service_name=config.service_name,
        )
        self.status = SQLSourceStatus()
        logger.info("Establishing Sparks Session")
        builder = (
            pyspark.sql.SparkSession.builder.appName(self.config.app_name)
            .enableHiveSupport()
            .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
            .config(
                "spark.sql.catalog.spark_catalog",
                "org.apache.spark.sql.delta.catalog.DeltaCatalog",
            )
        )
        if self.config.metastore_host_port:
            builder.config(
                "hive.metastore.uris", f"thrift://{self.config.metastore_host_port}"
            )
        elif self.config.metastore_file_path:
            builder.config(
                "spark.sql.warehouse.dir", f"{self.config.metastore_file_path}"
            )
        self.spark = configure_spark_with_delta_pip(builder).getOrCreate()
        self.table_type_map = {
            TableType.External.value.lower(): TableType.External.value,
            TableType.View.value.lower(): TableType.View.value,
            TableType.SecureView.value.lower(): TableType.SecureView.value,
            TableType.Iceberg.value.lower(): TableType.Iceberg.value,
        }
        self.array_datatype_replace_map = {"(": "<", ")": ">", "=": ":", "<>": ""}
        self.ARRAY_CHILD_START_INDEX = 6
        self.ARRAY_CHILD_END_INDEX = -1

    def set_spark(self, spark):
        self.spark = spark

    @classmethod
    def create(
        cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext
    ):
        config = DeltalakeSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def next_record(self) -> Iterable[OMetaDatabaseAndTable]:
        schemas = self.spark.catalog.listDatabases()
        for schema in schemas:
            if not self.config.schema_filter_pattern.included(schema.name):
                self.status.filter(schema.name, "Schema pattern not allowed")
                continue
            yield from self.fetch_tables(schema.name)

    def get_status(self):
        return self.status

    def prepare(self):
        return super().prepare()

    def _get_table_type(self, table_type: str):
        return self.table_type_map.get(table_type.lower(), TableType.Regular.value)

    def fetch_tables(self, schema: str) -> Iterable[OMetaDatabaseAndTable]:
        for table in self.spark.catalog.listTables(schema):
            try:
                database = table.database
                table_name = table.name
                if not self.config.table_filter_pattern.included(table_name):
                    self.status.filter(
                        "{}.{}".format(self.config.get_service_name(), table_name),
                        "Table pattern not allowed",
                    )
                    continue
                self.status.scanned(
                    "{}.{}".format(self.config.get_service_name(), table_name)
                )
                table_columns = self._fetch_columns(schema, table_name)
                fqn = f"{self.config.service_name}.{self.config.database}.{schema}.{table_name}"
                if table.tableType and table.tableType.lower() != "view":
                    table_entity = Table(
                        id=uuid.uuid4(),
                        name=table_name,
                        tableType=self._get_table_type(table.tableType),
                        description=table.description,
                        fullyQualifiedName=fqn,
                        columns=table_columns,
                    )
                else:
                    view_definition = self._fetch_view_schema(table_name)
                    table_entity = Table(
                        id=uuid.uuid4(),
                        name=table_name,
                        tableType=self._get_table_type(table.tableType),
                        description=table.description,
                        fullyQualifiedName=fqn,
                        columns=table_columns,
                        viewDefinition=view_definition,
                    )

                table_and_db = OMetaDatabaseAndTable(
                    table=table_entity, database=self._get_database(schema)
                )
                yield table_and_db
            except Exception as err:
                logger.error(err)
                self.status.warnings.append(
                    "{}.{}".format(self.config.service_name, table.name)
                )

    def _get_database(self, schema: str) -> Database:
        return Database(
            name=schema,
            service=EntityReference(id=self.service.id, type=self.config.service_type),
        )

    def _fetch_table_description(self, table_name: str) -> Optional[Dict]:
        try:
            table_details_df = self.spark.sql(f"describe detail {table_name}")
            table_detail = table_details_df.collect()[0]
            return table_detail.asDict()
        except Exception as e:
            logging.error(e)

    def _fetch_view_schema(self, view_name: str) -> Optional[Dict]:
        describe_output = []
        try:
            describe_output = self.spark.sql(f"describe extended {view_name}").collect()
        except Exception as e:
            logger.error(e)
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

    def _check_col_length(self, datatype, col_raw_type):
        if datatype and datatype.upper() in {"CHAR", "VARCHAR", "BINARY", "VARBINARY"}:
            try:
                return col_raw_type.length if col_raw_type.length else 1
            except AttributeError:
                return 1

    def _get_display_data_type(self, row):
        display_data_type = repr(row["data_type"]).lower()
        for original, new in self.array_datatype_replace_map.items():
            display_data_type = display_data_type.replace(original, new)
        return display_data_type

    def _get_col_info(self, row):
        parsed_string = ColumnTypeParser._parse_datatype_string(row["data_type"])
        column = None
        if parsed_string:
            parsed_string["dataLength"] = self._check_col_length(
                parsed_string["dataType"], row["data_type"]
            )
            if row["data_type"] == "array":
                array_data_type_display = self._get_display_data_type(row)
                parsed_string["dataTypeDisplay"] = array_data_type_display
                # Parse Primitive Datatype string
                # if Datatype is Arrya(int) -> Parse int
                parsed_string[
                    "arrayDataType"
                ] = ColumnTypeParser._parse_primitive_datatype_string(
                    array_data_type_display[
                        self.ARRAY_CHILD_START_INDEX : self.ARRAY_CHILD_END_INDEX
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

    def _fetch_columns(self, schema: str, table: str) -> List[Column]:
        raw_columns = []
        field_dict: Dict[str, Any] = {}
        table_name = f"{schema}.{table}"
        try:
            raw_columns = self.spark.sql(f"describe {table_name}").collect()
            for field in self.spark.table(f"{table_name}").schema:
                field_dict[field.name] = field
        except (AnalysisException, ParseException) as e:
            logger.error(e)
            return []
        parsed_columns: [Column] = []
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

    def _is_complex_delta_type(self, delta_type: Any) -> bool:
        return (
            isinstance(delta_type, StructType)
            or isinstance(delta_type, ArrayType)
            or isinstance(delta_type, MapType)
        )
