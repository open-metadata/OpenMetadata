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
Hive source methods.
"""

import traceback
from typing import List, Optional, Tuple, Union

from pydantic import ValidationError
from pyhive.sqlalchemy_hive import HiveDialect
from sqlalchemy import text
from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.entity.data.table import (
    PartitionColumnDetails,
    PartitionIntervalTypes,
    TablePartition,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
    HiveConnection,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.hive.connection import get_metastore_connection
from metadata.ingestion.source.database.hive.utils import (
    get_columns,
    get_table_comment,
    get_table_names,
    get_table_names_older_versions,
    get_view_definition,
    get_view_names,
    get_view_names_older_versions,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

HiveDialect.get_columns = get_columns
HiveDialect.get_table_comment = get_table_comment


HIVE_VERSION_WITH_VIEW_SUPPORT = "2.2.0"


class HiveSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Hive Source
    """

    service_connection: HiveConnection

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config = WorkflowSource.model_validate(config_dict)
        connection: HiveConnection = config.serviceConnection.root.config
        if not isinstance(connection, HiveConnection):
            raise InvalidSourceException(
                f"Expected HiveConnection, but got {connection}"
            )
        return cls(config, metadata)

    def _parse_version(self, version: str) -> Tuple:
        if "-" in version:
            version = version.replace("-", ".")
        return tuple(map(int, (version.split(".")[:3])))

    def _get_validated_metastore_connection(
        self,
    ) -> Optional[Union[PostgresConnection, MysqlConnection]]:
        """
        Validate and return the metastore connection if it exists.
        Handles cases where the connection may be a raw dict that needs validation.
        """
        metastore_conn = self.service_connection.metastoreConnection

        if not metastore_conn:
            return None

        if isinstance(metastore_conn, (PostgresConnection, MysqlConnection)):
            return metastore_conn

        if isinstance(metastore_conn, dict) and len(metastore_conn) > 0:
            try:
                return PostgresConnection.model_validate(metastore_conn)
            except ValidationError:
                try:
                    return MysqlConnection.model_validate(metastore_conn)
                except ValidationError:
                    logger.warning("Invalid metastore connection configuration")
                    return None

        return None

    def prepare(self):
        """
        Based on the version of hive update the get_table_names method
        Fetching views in hive server with query "SHOW VIEWS" was possible
        only after hive 2.2.0 version
        """
        metastore_conn = self._get_validated_metastore_connection()

        if not metastore_conn:
            with self.engine.connect() as conn:
                result = conn.execute(text("SELECT VERSION()")).fetchone()._asdict()

            version = result.get("_c0", "").split()
            if version and self._parse_version(version[0]) >= self._parse_version(
                HIVE_VERSION_WITH_VIEW_SUPPORT
            ):
                HiveDialect.get_table_names = get_table_names
                HiveDialect.get_view_names = get_view_names
                HiveDialect.get_view_definition = get_view_definition
            else:
                HiveDialect.get_table_names = get_table_names_older_versions
                HiveDialect.get_view_names = get_view_names_older_versions
        else:
            self.engine = get_metastore_connection(metastore_conn)
        self._connection_map = {}  # Lazy init as well
        self._inspector_map = {}

    def get_schema_definition(  # pylint: disable=unused-argument
        self, table_type: str, table_name: str, schema_name: str, inspector: Inspector
    ) -> Optional[str]:
        """
        Get the DDL statement or View Definition for a table
        """
        schema_definition = None
        try:
            if self.source_config.includeDDL or table_type in (
                TableType.View,
                TableType.MaterializedView,
            ):
                schema_definition = inspector.get_view_definition(
                    table_name, schema_name
                )
            schema_definition = (
                str(schema_definition).strip()
                if schema_definition is not None
                else None
            )
            return schema_definition

        except NotImplementedError:
            logger.warning("Schema definition not implemented")

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch schema definition for {table_name}: {exc}")
        return None

    def _build_metastore_partition_query(self, drivername: str) -> str:
        def quote_identifier(name: str) -> str:
            return f'"{name}"' if drivername == "hive+postgres" else name

        return (
            f"SELECT pk.{quote_identifier('PKEY_NAME')}"
            f" FROM {quote_identifier('PARTITION_KEYS')} pk"
            f" JOIN {quote_identifier('TBLS')} tbl ON pk.{quote_identifier('TBL_ID')} = tbl.{quote_identifier('TBL_ID')}"
            f" JOIN {quote_identifier('DBS')} db ON tbl.{quote_identifier('DB_ID')} = db.{quote_identifier('DB_ID')}"
            f" WHERE db.{quote_identifier('NAME')} = :schema AND tbl.{quote_identifier('TBL_NAME')} = :table_name"
            f" ORDER BY pk.{quote_identifier('INTEGER_IDX')}"
        )

    def _get_partition_keys_from_metastore(
        self, table_name: str, schema_name: str, drivername: str
    ) -> List[str]:
        query = self._build_metastore_partition_query(drivername)
        result = self.connection.execute(
            text(query),
            {"table_name": table_name, "schema": schema_name},
        )
        return [row[0] for row in result if row and row[0]]

    def _get_partition_keys_from_describe(
        self, table_name: str, schema_name: str
    ) -> List[str]:
        partition_keys: List[str] = []
        in_partition_section = False
        identifier_preparer = self.engine.dialect.identifier_preparer
        quoted_schema_name = identifier_preparer.quote_identifier(schema_name)
        quoted_table_name = identifier_preparer.quote_identifier(table_name)
        rows = self.connection.execute(
            text(f"DESCRIBE FORMATTED {quoted_schema_name}.{quoted_table_name}")
        )
        for row in rows:
            col_name = row[0].strip() if row[0] else ""
            if col_name == "# Partition Information":
                in_partition_section = True
                continue
            if in_partition_section:
                if not col_name or col_name.startswith("# Detailed"):
                    break
                if col_name.startswith("#"):
                    continue
                partition_keys.append(col_name)

        if partition_keys:
            return partition_keys

        try:
            partitions = self.connection.execute(
                text(f"SHOW PARTITIONS {quoted_schema_name}.{quoted_table_name}")
            )
        except Exception:
            return []
        first_partition = next((row[0] for row in partitions if row and row[0]), None)
        if not first_partition:
            return []

        # Example: dt=2024-01-01/region=us -> ["dt", "region"]
        keys: List[str] = []
        for part in str(first_partition).split("/"):
            if "=" in part:
                key, _ = part.split("=", 1)
                if key:
                    keys.append(key)
        return keys

    def get_table_partition_details(  # pylint: disable=unused-argument
        self,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
    ) -> Tuple[bool, Optional[TablePartition]]:
        """
        Extract partition key columns for a table.

        For ``hive+mysql`` and ``hive+postgres`` connections, this reads the
        partition key metadata directly from the Hive metastore tables.
        For other Hive drivers, it falls back to parsing
        ``DESCRIBE FORMATTED`` output.

        Returns ``(is_partitioned, TablePartition)`` where ``TablePartition``
        lists all partition key columns with ``COLUMN_VALUE`` interval type.
        """
        try:
            drivername = getattr(getattr(self.engine, "url", None), "drivername", "")
            if drivername in {"hive+mysql", "hive+postgres"}:
                partition_keys = self._get_partition_keys_from_metastore(
                    table_name, schema_name, drivername
                )
            else:
                partition_keys = self._get_partition_keys_from_describe(
                    table_name, schema_name
                )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to get partition details for {schema_name}.{table_name}: {exc}"
            )
            return False, None

        if not partition_keys:
            return False, None

        return True, TablePartition(
            columns=[
                PartitionColumnDetails(
                    columnName=key,
                    intervalType=PartitionIntervalTypes.COLUMN_VALUE,
                    interval=None,
                )
                for key in partition_keys
            ]
        )
