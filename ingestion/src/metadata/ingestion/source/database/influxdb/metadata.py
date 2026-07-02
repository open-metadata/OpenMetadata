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
InfluxDB 3 source module.

Maps InfluxDB 3 concepts to OpenMetadata entities:

    InfluxDB instance  → OpenMetadata Database
    InfluxDB database  → OpenMetadata Schema
    InfluxDB table     → OpenMetadata Table

Uses the InfluxDB 3 HTTP SQL API (/api/v3/query_sql) for metadata
introspection. There is no SQLAlchemy dialect for InfluxDB 3, so this
source extends CommonNoSQLSource with native client calls.
"""

from typing import Iterable, List, Optional, Tuple

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    DataType,
    TableConstraint,
    TableData,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.influxdbConnection import (
    InfluxdbConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import EntityName, FullyQualifiedEntityName
from metadata.ingestion.api.models import Either
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_nosql_source import (
    CommonNoSQLSource,
    SAMPLE_SIZE,
    TableNameAndType,
)
from metadata.utils import fqn
from metadata.utils.constants import DEFAULT_DATABASE
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

_INFLUX_TO_OM_TYPE = {
    "Int64": DataType.BIGINT,
    "Int32": DataType.INT,
    "UInt64": DataType.BIGINT,
    "UInt32": DataType.INT,
    "Float64": DataType.DOUBLE,
    "Float32": DataType.FLOAT,
    "Utf8": DataType.VARCHAR,
    "LargeUtf8": DataType.VARCHAR,
    "Bool": DataType.BOOLEAN,
    "Boolean": DataType.BOOLEAN,
    "Dictionary(Int32, Utf8)": DataType.VARCHAR,
    "Timestamp(Nanosecond, None)": DataType.TIMESTAMP,
    "Timestamp(Nanosecond, Some(\"UTC\"))": DataType.TIMESTAMP,
}


class InfluxDBSource(CommonNoSQLSource):
    source_config: DatabaseServiceMetadataPipeline
    config: WorkflowSource
    connection_obj: "InfluxDBClient"  # set by base class via get_connection()

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ) -> "InfluxDBSource":
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: InfluxdbConnection = config.serviceConnection.root.config
        if not isinstance(connection, InfluxdbConnection):
            raise ValueError(
                f"Expected InfluxdbConnection, but got {type(connection).__name__}"
            )
        return cls(config, metadata)

    def get_database_names(self) -> Iterable[str]:
        database_name = (
            getattr(self.service_connection, "databaseName", None)
            or DEFAULT_DATABASE
        )
        yield database_name

    def get_schema_name_list(self) -> List[str]:
        databases = self.connection_obj.list_databases()
        config_db = getattr(self.service_connection, "databaseName", None)
        if config_db:
            databases = [db for db in databases if db == config_db]
        logger.info(
            "InfluxDB instance has %d database(s): %s",
            len(databases),
            databases,
        )
        return databases

    def query_table_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        try:
            tables = self.connection_obj.list_tables(schema_name)
            for table in tables:
                yield TableNameAndType(name=table)
        except Exception:
            logger.warning(
                "Failed to list tables for InfluxDB database '%s'", schema_name
            )

    def get_table_columns(
        self, schema_name: str, table_name: str
    ) -> List[Column]:
        columns_info = self.connection_obj.get_columns(schema_name, table_name)

        columns = [
            Column(
                name="time",
                dataType=DataType.TIMESTAMP,
                description="InfluxDB timestamp",
            )
        ]

        for col_info in columns_info:
            col_name = col_info.get("column_name", "")
            if col_name.lower() == "time":
                continue
            influx_type = col_info.get("data_type", "Utf8")
            om_type = _INFLUX_TO_OM_TYPE.get(influx_type, DataType.VARCHAR)
            columns.append(
                Column(
                    name=col_name,
                    dataType=om_type,
                    description=f"InfluxDB type: {influx_type}",
                    dataLength=1 if om_type == DataType.VARCHAR else None,
                )
            )

        return columns

    def get_table_constraints(
        self, db_name: str, schema_name: str, table_name: str
    ) -> Optional[List[TableConstraint]]:
        return None

    def yield_table(
        self, table_name_and_type: Tuple[str, TableType]
    ) -> Iterable[Either[CreateTableRequest]]:
        yield from super().yield_table(table_name_and_type)

        table_name, _ = table_name_and_type
        schema_name = self.context.get().database_schema
        try:
            self._ingest_sample_data(schema_name, table_name)
        except Exception:
            logger.warning(
                "Failed to ingest sample data for '%s.%s'",
                schema_name,
                table_name,
            )

    def _ingest_sample_data(self, schema_name: str, table_name: str) -> None:
        from metadata.generated.schema.entity.data.table import Table

        columns, rows = self.connection_obj.fetch_sample_rows(
            schema_name, table_name, limit=SAMPLE_SIZE
        )
        if not columns:
            return

        table_fqn = fqn.build(
            self.metadata,
            entity_type=Table,
            service_name=self.context.get().database_service,
            database_name=self.context.get().database,
            schema_name=schema_name,
            table_name=table_name,
        )
        table_entity = self.metadata.get_by_name(entity=Table, fqn=table_fqn)
        if table_entity is None:
            return

        table_data = TableData(
            columns=[ColumnName(col) for col in columns],
            rows=rows,
        )
        self.metadata.ingest_table_sample_data(table_entity, table_data)
        logger.info(
            "Ingested %d sample rows for '%s'", len(rows), table_fqn
        )

    def test_connection(self) -> None:
        if not self.connection_obj.test_connection():
            raise ConnectionError("InfluxDB 3 is not ready")
        logger.info("InfluxDB 3 connection test passed")

    def close(self):
        self.connection_obj.close()
