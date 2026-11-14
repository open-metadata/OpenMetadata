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

"""Metadata ingestion for Apache Cloudberry."""

from collections.abc import Iterable
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.exc import SQLAlchemyError

from metadata.generated.schema.entity.data.table import (
    PartitionColumnDetails,
    PartitionIntervalTypes,
    TablePartition,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.cloudberryConnection import (
    CloudberryConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import Source as WorkflowSource
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.cloudberry.connection import SYSTEM_SCHEMAS
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.common_pg_mappings import (
    INTERVAL_TYPE_MAP,
    RELKIND_MAP,
    PgMatviewMixin,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

GET_DATABASES = text("""
    SELECT datname
    FROM pg_catalog.pg_database
    WHERE datallowconn AND NOT datistemplate
      AND pg_catalog.has_database_privilege(oid, 'CONNECT')
    ORDER BY datname
""")

# The external table view is restricted; the FDW catalog identifies the same relations.
GET_TABLES = text("""
    SELECT c.relname, c.relkind, COALESCE(w.fdwname = 'gp_exttable_fdw', false) AS is_external
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_catalog.pg_foreign_table f ON f.ftrelid = c.oid
    LEFT JOIN pg_catalog.pg_foreign_server s ON s.oid = f.ftserver
    LEFT JOIN pg_catalog.pg_foreign_data_wrapper w ON w.oid = s.srvfdw
    WHERE n.nspname = :schema AND c.relkind IN ('r', 'p', 'f') AND NOT c.relispartition
""")

GET_PARTITION_KEYS = text("""
    SELECT p.partstrat, a.attname
    FROM pg_catalog.pg_partitioned_table p
    JOIN pg_catalog.pg_class c ON c.oid = p.partrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL unnest(p.partattrs) WITH ORDINALITY AS k(attnum, position)
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
    WHERE n.nspname = :schema AND c.relname = :table AND NOT a.attisdropped
    ORDER BY k.position
""")

GET_VIEW_DEFINITION = text("""
    SELECT pg_catalog.pg_get_viewdef(c.oid)
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = :schema AND c.relname = :table AND c.relkind IN ('v', 'm')
""")

PARTITION_STRATEGIES = {"l": "list", "h": "hash", "r": "range"}


class CloudberrySource(PgMatviewMixin, CommonDbSourceService):
    service_connection: CloudberryConnection

    @classmethod
    def create(cls, config_dict: dict[str, Any], metadata: OpenMetadata, pipeline_name: str | None = None):
        config = WorkflowSource.model_validate(config_dict)
        if config.serviceConnection is None or not isinstance(
            config.serviceConnection.root.config, CloudberryConnection
        ):
            raise InvalidSourceException("Expected a Cloudberry connection")
        return cls(config, metadata)

    def get_database_names_raw(self) -> Iterable[str]:
        if not self.service_connection.ingestAllDatabases:
            yield self.service_connection.database
            return
        yield from self.connection.execute(GET_DATABASES).scalars().all()

    def get_database_names(self) -> Iterable[str]:
        if not self.service_connection.ingestAllDatabases:
            yield self.service_connection.database
            return
        for database in self._get_filtered_database_names():
            try:
                self.set_inspector(database)
                _ = self.inspector
            except (SQLAlchemyError, OSError):
                logger.warning("Could not connect to Cloudberry database %s", database, exc_info=True)
                continue
            yield database

    def get_raw_database_schema_names(self) -> Iterable[str]:
        return (
            name
            for name in super().get_raw_database_schema_names()
            if name not in SYSTEM_SCHEMAS and not name.startswith("pg_")
        )

    def query_table_names_and_types(self, schema_name: str) -> Iterable[TableNameAndType]:
        for name, kind, external in self.connection.execute(GET_TABLES, {"schema": schema_name}):
            yield TableNameAndType(name=name, type_=TableType.External if external else RELKIND_MAP[kind])

    def get_table_partition_details(
        self, table_name: str, schema_name: str, inspector: Inspector
    ) -> tuple[bool, TablePartition | None]:
        keys = self.connection.execute(GET_PARTITION_KEYS, {"schema": schema_name, "table": table_name}).all()
        if not keys:
            return False, None
        columns = [
            PartitionColumnDetails(
                columnName=column,
                intervalType=INTERVAL_TYPE_MAP.get(
                    PARTITION_STRATEGIES.get(strategy, ""), PartitionIntervalTypes.COLUMN_VALUE
                ),
            )
            for strategy, column in keys
        ]
        return True, TablePartition(columns=columns)

    def get_schema_definition(
        self, table_type: TableType, table_name: str, schema_name: str, inspector: Inspector
    ) -> str | None:
        if table_type not in (TableType.View, TableType.MaterializedView):
            return super().get_schema_definition(table_type, table_name, schema_name, inspector)
        # Qualify user relations in the deparsed SQL for lineage across schemas.
        with self.engine.connect().execution_options(isolation_level="READ COMMITTED") as conn, conn.begin():
            conn.exec_driver_sql("SET LOCAL search_path = pg_catalog")
            return conn.execute(GET_VIEW_DEFINITION, {"schema": schema_name, "table": table_name}).scalar_one_or_none()
