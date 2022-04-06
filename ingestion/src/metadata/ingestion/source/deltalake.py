import logging
import uuid
from collections import Iterable
from typing import Any, Dict, List, Optional

from pyspark.sql import SparkSession
from pyspark.sql.catalog import Table
from pyspark.sql.types import ArrayType, MapType, StructField, StructType
from pyspark.sql.utils import AnalysisException, ParseException

from metadata.config.common import FQDN_SEPARATOR, ConfigModel
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataServerConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import IncludeFilterPattern
from metadata.ingestion.api.source import Source
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.source.sql_source import SQLSourceStatus
from metadata.utils.helpers import get_database_service_or_create

logger: logging.Logger = logging.getLogger(__name__)


class DeltaLakeSourceConfig(ConfigModel):
    database: str = "delta"
    platform_name: str = "deltalake"
    schema_filter_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()
    table_filter_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()
    service_name: str
    service_type: str = DatabaseServiceType.DeltaLake.value

    def get_service_name(self) -> str:
        return self.service_name


class DeltaLakeSource(Source):
    spark: SparkSession = None

    def __init__(
        self,
        config: DeltaLakeSourceConfig,
        metadata_config: OpenMetadataServerConfig,
    ):
        super().__init__()
        self.config = config
        self.metadata_config = metadata_config
        self.service = get_database_service_or_create(
            config=config,
            metadata_config=metadata_config,
            service_name=config.service_name,
        )
        self.status = SQLSourceStatus()

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataServerConfig):
        config = DeltaLakeSourceConfig.parse_obj(config_dict)
        return cls(config, metadata_config)

    def next_record(self) -> Iterable[OMetaDatabaseAndTable]:
        schemas = self.spark.catalog.listDatabases()
        for schema in schemas:
            if not self.config.schema_filter_pattern.included(schema):
                self.status.filter(schema, "Schema pattern not allowed")
                continue
            yield from self.fetch_tables(schema)

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
                fqn = f"{self.config.service_name}{FQDN_SEPARATOR}{self.config.database}{FQDN_SEPARATOR}{schema}{FQDN_SEPARATOR}{table_name}"
                if table.tableType and table.tableType.lower() != "view":
                    table_description = self._fetch_table_description(table_name)
                    table_entity = Table(
                        id=uuid.uuid4(),
                        name=table_name,
                        tableType=table.tableType,
                        description=table_description,
                        fullyQualifiedName=fqn,
                        columns=table_columns,
                    )
                else:
                    view_definition = self._fetch_view_schema(table_name)
                    table_entity = Table(
                        id=uuid.uuid4(),
                        name=table_name,
                        tableType=table.tableType,
                        description=" ",
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
        return view_detail

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
        row_order = 0
        for row in raw_columns:
            col_name = row["col_name"]
            if col_name == "" or "#" in col_name:
                partition_cols = True
                continue
            if not partition_cols:
                column = Column(
                    name=row["col_name"],
                    description=row["comment"] if row["comment"] else None,
                    data_type=row["data_type"],
                    ordinal_position=row_order,
                )
                parsed_columns.append(column)
                row_order += 1

        return parsed_columns

    def _is_complex_delta_type(self, delta_type: Any) -> bool:
        return (
            isinstance(delta_type, StructType)
            or isinstance(delta_type, ArrayType)
            or isinstance(delta_type, MapType)
        )
