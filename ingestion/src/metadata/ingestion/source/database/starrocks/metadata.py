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
    get_view_definition,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_manager import SSLManager, check_ssl_and_init

RELKIND_MAP = {
    "BASE TABLE": TableType.Regular,
    "VIEW": TableType.View,
    "MATERIALIZED VIEW": TableType.MaterializedView,
    "SYSTEM VIEW": TableType.View,
}

logger = ingestion_logger()


def extract_number(data):
    """
    Extract data type length for CHAR, VARCHAR, DECIMAL, such as CHAR(1), return ['1'],
    DECIMAL(9,0) return ['9', '0']
    """
    result = re.findall(r"\((.*?)\)", data)
    if result:
        result = [
            int(i.strip()) if i.strip().isdigit() else 1 for i in result[0].split(",")
        ]
        return result
    return []


def extract_child(data):
    """
    Extract child type for ARRAY and Struct, such as ARRAY<INT(11)>, return INT(11)
    """
    result = re.findall(r"(?<=<).+(?=>)", data)
    if result:
        return result[0]
    return ""


def _parse_type(_type):
    """
    Parse raw type to system_data_type like CHAR(1) -> CHAR, STRUCT<s_id:int(11),s_name:text> -> STRUCT,
    DECIMALV3(9, 0) -> DECIMAL, DATEV2 -> DATE
    """
    parse_type = _type.split("(")[0].split("<")[0]
    if len(parse_type) > 2 and parse_type[-2].lower() == "v":
        system_data_type = parse_type.rsplit("v", 1)[0].upper()
    else:
        system_data_type = parse_type.upper()
    return system_data_type


def _get_column(ordinal, field, _type, null, default, comment):
    _type = _type.lower() if _type else ""
    system_data_type = _parse_type(_type)
    data_length = None
    precision = None
    scale = None

    if system_data_type in ["VARCHAR", "CHAR"]:
        numbers = extract_number(_type)
        if numbers:
            data_length = numbers[0]

    if system_data_type == "DECIMAL":
        numbers = extract_number(_type)
        if len(numbers) >= 1:
            precision = numbers[0]
        if len(numbers) >= 2:
            scale = numbers[1]

    arr_data_type = None
    children = None
    if system_data_type == "ARRAY":
        child_type = extract_child(_type)
        if child_type:
            arr_data_type = _parse_type(child_type)

    if system_data_type == "STRUCT":
        children = []
        child_content = extract_child(_type)
        if child_content:
            for key_, child in enumerate(child_content.split(",")):
                name_type = child.split(":")
                if len(name_type) == 2:
                    children.append(
                        _get_column(
                            key_,
                            name_type[0].strip(),
                            name_type[1].strip(),
                            "YES",
                            None,
                            None,
                        )
                    )

    return {
        "name": field,
        "default": default,
        "nullable": True if null == "YES" else False,
        "type": _type,
        "data_length": data_length,
        "precision": precision,
        "scale": scale,
        "display_type": _type.lower() if _type else "",
        "system_data_type": system_data_type,
        "comment": comment,
        "ordinalPosition": ordinal,
        "arr_data_type": arr_data_type,
        "children": children,
    }


class StarRocksSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from StarRocks
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        self.ssl_manager = None
        service_connection = config.serviceConnection.root.config
        self.ssl_manager: SSLManager = check_ssl_and_init(service_connection)
        if self.ssl_manager:
            service_connection = self.ssl_manager.setup_ssl(service_connection)
        super().__init__(config, metadata)

        try:
            from starrocks.sqlalchemy.dialect import (
                StarRocksDialect,  # pylint: disable=import-outside-toplevel
            )

            StarRocksDialect.get_table_names_and_type = get_table_names_and_type
            StarRocksDialect.get_table_comment = get_table_comment
            StarRocksDialect.get_view_definition = get_view_definition
        except ImportError:
            logger.warning("starrocks package not found. Some features may not work.")

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        if config.serviceConnection is None:
            raise InvalidSourceException("Missing service connection")
        connection = cast(StarRocksConnection, config.serviceConnection.root.config)
        if not isinstance(connection, StarRocksConnection):
            raise InvalidSourceException(
                f"Expected StarRocksConnection, but got {connection}"
            )
        return cls(config, metadata)

    def query_table_names_and_types(
        self, schema_name: str
    ) -> Iterable[TableNameAndType]:
        """
        Get the table name and type from the database.
        """
        tables = [
            TableNameAndType(
                name=name, type_=RELKIND_MAP.get(table_type, TableType.Regular)
            )
            for name, table_type in self.connection.execute(
                sql.text(STARROCKS_GET_TABLE_NAMES), {"schema": schema_name}
            )
            or []
        ]
        return tables

    @staticmethod
    def get_table_description(
        schema_name: str, table_name: str, inspector: Inspector
    ) -> str:
        description = None
        try:
            table_info: dict = inspector.get_table_comment(table_name, schema_name)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Table description error for table [{schema_name}.{table_name}]: {exc}"
            )
        else:
            text_info = table_info.get("text")
            if text_info:
                if isinstance(text_info, tuple):
                    description = text_info[0] if text_info else None
                else:
                    description = text_info
        return description

    def _get_columns(self, table_name, schema=None):
        """
        Get columns from SHOW FULL COLUMNS command
        """
        table_columns = []
        primary_columns = []
        try:
            for i, row in enumerate(
                self.connection.execute(
                    sql.text(STARROCKS_SHOW_FULL_COLUMNS.format(schema, table_name))
                )
            ):
                table_columns.append(
                    _get_column(
                        i,
                        row[0],
                        row[1],
                        row[3],
                        row[5],
                        row[8] if len(row) > 8 else None,
                    )
                )
                if len(row) > 4 and row[4] == "YES":
                    primary_columns.append(row[0])
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error getting columns for [{schema}.{table_name}]: {exc}")

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
        """
        Get columns and constraints for a table
        """
        table_constraints = []
        table_columns = []
        columns, primary_columns = self._get_columns(table_name, schema_name)

        for column in columns:
            try:
                children = None
                if column.get("children"):
                    children = [
                        Column(
                            name=child["name"] if child["name"] else " ",
                            description=child.get("comment"),
                            dataType=child["system_data_type"],
                            dataTypeDisplay=child["display_type"],
                            dataLength=child.get("data_length", 1),
                            constraint=None,
                            children=child.get("children"),
                            arrayDataType=child.get("arr_data_type"),
                            ordinalPosition=child.get("ordinalPosition"),
                        )
                        for child in column["children"]
                    ]

                self.process_additional_table_constraints(
                    column=column, table_constraints=table_constraints
                )

                col_constraint = self._get_column_constraints(
                    column, primary_columns, []
                )
                col_data_length = column.get("data_length")
                if col_data_length is None:
                    col_data_length = 1

                if column["system_data_type"] is None:
                    logger.warning(
                        f"Unknown type {repr(column['type'])}: {column['name']}"
                    )

                om_column = Column(
                    name=column["name"] if column["name"] else " ",
                    description=column.get("comment"),
                    dataType=column["system_data_type"],
                    dataTypeDisplay=column.get("type"),
                    dataLength=col_data_length,
                    constraint=col_constraint,
                    children=children,
                    arrayDataType=column.get("arr_data_type"),
                    ordinalPosition=column.get("ordinalPosition"),
                )

                if column["system_data_type"] == "DECIMAL":
                    om_column.precision = column.get("precision")
                    om_column.scale = column.get("scale")

                om_column.tags = self.get_column_tag_labels(
                    table_name=table_name, column=column
                )

            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Unexpected exception processing column [{column}]: {exc}"
                )
                continue

            table_columns.append(om_column)

        return table_columns, [], []

    def get_table_partition_details(
        self,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
    ) -> Tuple[bool, Optional[TablePartition]]:
        """
        Check if the table is a partitioned table and return the partition details
        """
        try:
            result = self.engine.execute(
                sql.text(STARROCKS_PARTITION_DETAILS.format(schema_name, table_name))
            ).all()

            if result and len(result) > 0:
                first_row = result[0]
                partition_key = getattr(first_row, "PartitionKey", None)
                if partition_key and partition_key != "":
                    partition_details = TablePartition(
                        columns=[
                            PartitionColumnDetails(
                                columnName=pk.strip(),
                                intervalType=PartitionIntervalTypes.TIME_UNIT,
                                interval=None,
                            )
                            for pk in partition_key.split(",")
                        ]
                    )
                    return True, partition_details
            return False, None
        except Exception:
            return False, None
