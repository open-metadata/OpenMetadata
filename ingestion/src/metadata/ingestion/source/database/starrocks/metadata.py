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
"""StarRocks source module"""
import re
import traceback
from typing import Dict, Iterable, List, Optional, Tuple, cast

from sqlalchemy import sql
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.sql import sqltypes

from metadata.generated.schema.entity.data.table import (
    Column,
    PartitionColumnDetails,
    PartitionIntervalTypes,
    TableConstraint,
    TablePartition,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.starrocksConnection import (
    StarRocksConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.starrocks.queries import (
    STARROCKS_GET_TABLE_NAMES,
    STARROCKS_PARTITION_DETAILS,
    STARROCKS_SHOW_FULL_COLUMNS,
)
from metadata.ingestion.source.database.starrocks.utils import (
    get_table_comment,
    get_table_names_and_type,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_manager import SSLManager, check_ssl_and_init

RELKIND_MAP = {
    "TABLE": TableType.Regular,
    "MVIEW": TableType.MaterializedView,
    "VIEW": TableType.View,
    "MYSQL": TableType.External,
    "ELASTICSEARCH": TableType.External,
    "HIVE": TableType.External,
    "JDBC": TableType.External,
    "ICEBERG": TableType.External,
    "HUDI": TableType.External,
}

# StarRocks system schemas to exclude by default
STARROCKS_SYSTEM_SCHEMAS = {"information_schema", "_statistics_", "sys"}

logger = ingestion_logger()


def extract_number(data):
    result = re.findall(r"\((.*?)\)", data)
    if result:
        return [i.strip() for i in result[0].split(",")]
    return []


def extract_child(data):
    result = re.findall(r"(?<=<).+(?=>)", data)
    return result[0] if result else ""


def _parse_type(_type):
    """Return the uppercase type name to ensure it matches the type_mapping keys"""
    parse_type = _type.split("(")[0].split("<")[0]
    if parse_type[-2:].lower() in ["v2", "v3"]:
        return parse_type[:-2].upper()
    return parse_type.upper()


# Handle ARRAY missing parameters and NullType invocation issues
def _get_sqlalchemy_type(type_str):
    """Return the corresponding sqlalchemy.sql.sqltypes instance based on the type string"""
    base_type = _parse_type(type_str)
    params = extract_number(type_str)

    # Map StarRocks types to sqlalchemy.sql.sqltypes attributes (using classes instead of instances)
    type_mapping = {
        "VARCHAR": sqltypes.VARCHAR,
        "CHAR": sqltypes.CHAR,
        "INT": sqltypes.INT,
        "BIGINT": sqltypes.BIGINT,
        "FLOAT": sqltypes.FLOAT,
        "DOUBLE": sqltypes.FLOAT,
        "DECIMAL": sqltypes.DECIMAL,
        "DATE": sqltypes.DATE,
        "DATETIME": sqltypes.DATETIME,
        "TIMESTAMP": sqltypes.TIMESTAMP,
        "BOOLEAN": sqltypes.BOOLEAN,
        "ARRAY": sqltypes.ARRAY,
        "JSON": sqltypes.JSON,
        "STRING": sqltypes.TEXT,
        "BINARY": sqltypes.BINARY,
        "VARBINARY": sqltypes.VARBINARY,
        "TEXT": sqltypes.TEXT,
        "UNKNOWN": sqltypes.NullType,
    }

    # Get the corresponding sqltypes class (use NullType as default)
    sql_type_cls = type_mapping.get(base_type, sqltypes.NullType)

    # Handle types with parameters
    try:
        # For ARRAY type, force passing item_type (use String as default if no element type)
        if base_type == "ARRAY":
            child_type = extract_child(type_str) or "string"
            child_sql_type = _get_sqlalchemy_type(child_type)
            return sql_type_cls(item_type=child_sql_type)

        # Length-based types (VARCHAR/CHAR, etc.)
        elif base_type in ["VARCHAR", "CHAR", "VARBINARY", "BINARY"] and params:
            return sql_type_cls(length=int(params[0]))

        # DECIMAL type (precision + scale)
        elif base_type == "DECIMAL" and len(params) >= 2:
            return sql_type_cls(precision=int(params[0]), scale=int(params[1]))

    except (ValueError, TypeError) as exc:
        logger.warning(
            f"Failed to parse type parameters ({type_str}): {str(exc)}, using default type"
        )

    # Return type instance (NullType has no parameters, call directly)
    return sql_type_cls()


def _get_column(ordinal, field, _type, null, default, comment):
    _type = _type.lower()
    system_data_type = _parse_type(_type)

    # Use the fixed type generation function
    data_type = _get_sqlalchemy_type(_type)

    # Supplement type attributes (compatible with original logic, ensure parameters are integers)
    if system_data_type in ["VARCHAR", "CHAR"]:
        num_list = extract_number(_type)
        data_type.length = int(num_list[0]) if num_list and num_list[0].isdigit() else 1
    if system_data_type == "DECIMAL":
        num_list = extract_number(_type)
        if len(num_list) == 2:
            data_type.precision = int(num_list[0]) if num_list[0].isdigit() else None
            data_type.scale = int(num_list[1]) if num_list[1].isdigit() else None

    arr_data_type = None
    children = None
    if system_data_type == "ARRAY":
        arr_data_type = _parse_type(extract_child(_type) or "string")
    if system_data_type == "STRUCT":
        children = []
        child_str = extract_child(_type)
        for key_, child in enumerate(child_str.split(",")) if child_str else []:
            name_type = [item.strip() for item in child.split(":")]
            if len(name_type) != 2:
                continue
            children.append(
                _get_column(key_, name_type[0], name_type[1], "YES", None, None)
            )

    return {
        "name": field,
        "default": default,
        "nullable": True if null == "YES" else None,
        "type": _type,
        "data_type": data_type,  # sqlalchemy.sql.sqltypes instance
        "display_type": _type.lower(),
        "system_data_type": system_data_type,
        "comment": comment,
        "ordinalPosition": ordinal,
        "arr_data_type": arr_data_type,
        "children": children,
    }


class StarRocksSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from StarRocks Source
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        self.ssl_manager = None
        service_connection = config.serviceConnection.root.config
        self.ssl_manager: SSLManager = check_ssl_and_init(service_connection)
        if self.ssl_manager:
            service_connection = self.ssl_manager.setup_ssl(service_connection)
        super().__init__(config, metadata)

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        """Create a StarRocksSource instance (factory method)"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        if not config.serviceConnection:
            raise InvalidSourceException("Missing service connection configuration")

        service_connection = cast(
            StarRocksConnection, config.serviceConnection.root.config
        )
        if not isinstance(service_connection, StarRocksConnection):
            raise InvalidSourceException(
                f"Expected connection type to be StarRocksConnection, actual type: {type(service_connection)}"
            )

        return cls(config, metadata)

    def get_raw_database_schema_names(self) -> Iterable[str]:
        """
        Get schema names from StarRocks, excluding system schemas.
        """
        if self.service_connection.__dict__.get("databaseSchema"):
            yield self.service_connection.databaseSchema
        else:
            for schema_name in self.inspector.get_schema_names():
                if schema_name.lower() not in STARROCKS_SYSTEM_SCHEMAS:
                    yield schema_name

    def query_table_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        tables = []
        result = (
            self.connection.execute(
                sql.text(STARROCKS_GET_TABLE_NAMES), {"schema": schema_name}
            )
            or []
        )

        for name, engine in result:
            table_type = RELKIND_MAP.get(engine, TableType.Regular)
            if engine != "VIEW":
                tables.append(TableNameAndType(name=name, type_=table_type))

        return tables

    def query_view_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        tables = []
        # Execute query to get results
        result = (
            self.connection.execute(
                sql.text(STARROCKS_GET_TABLE_NAMES), {"schema": schema_name}
            )
            or []
        )

        for name, engine in result:  # name and engine are valid within the loop
            # Calculate table_type
            table_type = RELKIND_MAP.get(engine, TableType.External)
            # Add to result list if it's a VIEW
            if engine == "VIEW":
                tables.append(TableNameAndType(name=name, type_=table_type))

        return tables

    @staticmethod
    def get_table_description(
        schema_name: str, table_name: str, inspector: Inspector
    ) -> Optional[str]:
        description = None
        try:
            table_info: dict = inspector.get_table_comment(table_name, schema_name)
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Table description error for table [{schema_name}.{table_name}]: {exc}"
            )
        else:
            description = table_info.get("text")

        if description is None:
            return None
        if isinstance(description, (list, tuple)) and len(description) > 0:
            return description[0]
        return description

    def _get_columns(self, table_name, schema=None):
        """Get column information and primary key columns of the specified table"""
        table_columns = []
        primary_columns = []
        if not self.engine:
            logger.error(
                "SQLAlchemy engine not initialized, cannot query column information"
            )
            return table_columns, primary_columns

        with self.engine.connect() as conn:
            try:
                # Use format with positional parameters (matching {0} in the template)
                query_str = STARROCKS_SHOW_FULL_COLUMNS.format(schema, table_name)
                query = sql.text(query_str)
                result = conn.execute(query)

                # Parse by column name (avoid compatibility issues with fixed-position unpacking)
                col_names = result.keys()
                row_dicts = [dict(zip(col_names, row)) for row in result]

                for ordinal, row in enumerate(row_dicts):
                    field_name = row.get("Field")
                    field_type = row.get("Type", "")
                    is_null = row.get("Null", "NO")
                    key_type = row.get("Key", "")
                    default_val = row.get("Default")
                    comment = row.get("Comment", "")

                    if not field_name:
                        logger.warning(
                            f"Skipping empty column name (table: {schema}.{table_name})"
                        )
                        continue

                    # Generate column information dictionary
                    table_columns.append(
                        _get_column(
                            ordinal=ordinal,
                            field=field_name,
                            _type=field_type,
                            null=is_null,
                            default=default_val,
                            comment=comment,
                        )
                    )
                    # Record primary key columns
                    if key_type == "PRI":
                        primary_columns.append(field_name)
                        logger.debug(
                            f"Primary key column of table {schema}.{table_name}: {field_name}"
                        )

            except Exception as exc:
                logger.error(
                    f"Failed to get column information (table: {schema}.{table_name}): {str(exc)}",
                    exc_info=True,
                )

        return table_columns, primary_columns

    def get_columns_and_constraints(
        self,
        schema_name: str,
        table_name: str,
        db_name: str,
        inspector: Inspector,
        table_type: str = None,
    ) -> Tuple[
        Optional[List[Column]], Optional[List[TableConstraint]], Optional[List[Dict]]
    ]:
        """Get column information and constraints (compatible with OpenMetadata schema)"""
        table_columns = []
        table_constraints = []

        # Get column information and primary keys
        columns, primary_columns = self._get_columns(table_name, schema_name)

        for column in columns:
            try:
                # Handle nested columns (e.g., STRUCT type)
                child_columns = None
                if column.get("children"):
                    child_columns = [
                        Column(
                            name=child["name"] or "unknown_column",
                            description=child.get("comment"),
                            dataType=child["system_data_type"],
                            dataTypeDisplay=child["display_type"],
                            dataLength=self._check_col_length(
                                child["system_data_type"], child["data_type"]
                            ),
                            ordinalPosition=child.get("ordinalPosition"),
                            children=child.get("children"),
                            arrayDataType=child.get("arr_data_type"),
                        )
                        for child in column["children"]
                    ]

                # Get column constraints (primary key/non-null, etc.)
                col_constraint = self._get_column_constraints(
                    column, primary_columns, []
                )
                # Check column length
                col_data_length = self._check_col_length(
                    column["system_data_type"], column["data_type"]
                )
                if col_data_length is None:
                    col_data_length = 1  # Default length (avoid null values)

                # Handle warning for unknown types
                if not column["system_data_type"]:
                    logger.warning(
                        f"Table {schema_name}.{table_name} has a column with unknown type: {column['name']} (original type: {column['type']})"
                    )

                # Build OpenMetadata Column instance
                om_column = Column(
                    name=column["name"] or "unknown_column",
                    description=column.get("comment"),
                    dataType=column["system_data_type"],
                    dataTypeDisplay=column.get("type"),
                    dataLength=col_data_length,
                    constraint=col_constraint,
                    children=child_columns,
                    arrayDataType=column["arr_data_type"],
                    ordinalPosition=column.get("ordinalPosition"),
                )
                # Supplement precision and scale for DECIMAL type
                if column["system_data_type"] == "DECIMAL":
                    om_column.precision = (
                        int(column["data_type"].precision)
                        if (
                            column["data_type"].precision
                            and str(column["data_type"].precision).isdigit()
                        )
                        else None
                    )
                    om_column.scale = (
                        int(column["data_type"].scale)
                        if (
                            column["data_type"].scale
                            and str(column["data_type"].scale).isdigit()
                        )
                        else None
                    )

                # Add column tags (e.g., sensitive data tags)
                om_column.tags = self.get_column_tag_labels(
                    table_name=table_name, column=column
                )
                table_columns.append(om_column)

            except Exception as exc:
                logger.debug(
                    f"Detailed stack trace for failed column processing: {traceback.format_exc()}"
                )
                logger.warning(
                    f"Failed to process column [{column.get('name')}] in table {schema_name}.{table_name}: {str(exc)}"
                )
                continue

        return table_columns, table_constraints, []

    def get_table_partition_details(
        self,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
    ) -> Tuple[bool, Optional[TablePartition]]:
        """Get partition information of the table"""
        if not self.engine:
            logger.error(
                "SQLAlchemy engine not initialized, cannot query partition information"
            )
            return False, None

        with self.engine.connect() as conn:
            try:
                # Execute partition query (adapt to positional parameters of the template)
                query_str = STARROCKS_PARTITION_DETAILS.format(schema_name, table_name)
                query = sql.text(query_str)
                result_row = conn.execute(query).first()

                if (
                    result_row
                    and hasattr(result_row, "PartitionKey")
                    and result_row.PartitionKey.strip()
                ):
                    # Parse partition keys (support multiple partition keys)
                    partition_keys = [
                        key.strip() for key in result_row.PartitionKey.split(",")
                    ]
                    partition_details = TablePartition(
                        columns=[
                            PartitionColumnDetails(
                                columnName=key,
                                intervalType=PartitionIntervalTypes.TIME_UNIT,  # Default to time partition (adjustable based on actual scenario)
                            )
                            for key in partition_keys
                        ]
                    )
                    logger.debug(
                        f"Partition keys of table {schema_name}.{table_name}: {partition_keys}"
                    )
                    return True, partition_details

            except Exception as exc:
                logger.error(
                    f"Failed to get partition information (table: {schema_name}.{table_name}): {str(exc)}",
                    exc_info=True,
                )

        return False, None

    def _check_col_length(
        self, system_data_type: str, data_type: sqltypes.TypeEngine
    ) -> Optional[int]:
        """Check column length (compatible with sqlalchemy.sql.sqltypes types)"""
        if not isinstance(data_type, sqltypes.TypeEngine):
            logger.warning(
                f"Not a SQLAlchemy TypeEngine instance, cannot get length: {type(data_type)}"
            )
            return None

        # Return length only for types with length attribute
        if isinstance(
            data_type,
            (sqltypes.VARCHAR, sqltypes.CHAR, sqltypes.VARBINARY, sqltypes.BINARY),
        ):
            return data_type.length if data_type.length is not None else None
        return None

    def close(self):
        """Close the SQLAlchemy engine (release resources)"""
        if self.engine:
            self.engine.dispose()
            logger.debug("StarRocks SQLAlchemy engine closed successfully")
        super().close()
