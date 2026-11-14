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
"""Doris source module"""

import re
import traceback
from collections.abc import Iterable
from typing import cast

from pydoris.sqlalchemy import datatype
from pydoris.sqlalchemy.dialect import DorisDialect
from sqlalchemy import sql
from sqlalchemy.dialects.mysql.reflection import MySQLTableDefinitionParser
from sqlalchemy.engine import Row
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.sql.compiler import IdentifierPreparer

from metadata.generated.schema.entity.data.table import (
    Column,
    DataType,
    PartitionColumnDetails,
    PartitionIntervalTypes,
    TableConstraint,
    TablePartition,
    TableType,
)
from metadata.generated.schema.entity.services.connections.database.dorisConnection import (
    DorisConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_helpers import (
    column_from_parsed,
    parse_complex_column_type,
)
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.doris.queries import (
    DORIS_GET_PARTITIONS,
    DORIS_GET_TABLE_NAMES,
    DORIS_SHOW_CREATE_TABLE,
    DORIS_SHOW_FULL_COLUMNS,
)
from metadata.ingestion.source.database.doris.utils import (
    get_table_comment,
    get_table_names_and_type,
)
from metadata.ingestion.source.database.mysql.utils import parse_column
from metadata.utils.logger import ingestion_logger
from metadata.utils.lru_cache import LRUCache
from metadata.utils.ssl_manager import SSLManager, check_ssl_and_init

MySQLTableDefinitionParser._parse_column = (  # pylint: disable=protected-access
    parse_column
)

RELKIND_MAP = {
    "Doris": TableType.Regular,
    "View": TableType.View,
    "MEMORY": TableType.View,
    "OLAP": TableType.MaterializedView,
    "Iceberg": TableType.Iceberg,
    "ICEBERG": TableType.Iceberg,
}

# Engine of an OLAP table in information_schema.tables. SHOW CREATE TABLE refuses a materialized view.
OLAP_ENGINE = "Doris"

# A RANGE partition column is an integer, a DATE or a DATETIME
TIME_PARTITION_DATA_TYPES = {DataType.DATE.value, DataType.DATETIME.value}

# SHOW CREATE TABLE prints the partition clause on a line of its own: PARTITION BY RANGE(`dt`),
# PARTITION BY LIST (`region`, `city`), AUTO PARTITION BY RANGE (date_trunc(`ts`, 'day'))
PARTITION_CLAUSE = re.compile(r"^(?:AUTO )?PARTITION BY (RANGE|LIST) ?\((.+)\)$", re.MULTILINE)
DATE_TRUNC_UNIT = re.compile(r"date_trunc\(.*'(\w+)'", re.IGNORECASE)
DYNAMIC_PARTITION_UNIT = re.compile(r'^"dynamic_partition\.time_unit" = "(\w+)"', re.MULTILINE)

DorisDialect.get_table_names_and_type = get_table_names_and_type
DorisDialect.get_table_comment = get_table_comment

logger = ingestion_logger()


def _qualified_identifier(
    preparer: IdentifierPreparer,
    *identifiers: str | None,
) -> str:
    """Build a safely quoted Doris identifier from individual name parts."""
    return ".".join(preparer.quote_identifier(identifier) for identifier in identifiers if identifier is not None)


def extract_number(data):
    """
    extract data type length for CHAR, VARCHAR, DECIMAL, such as CHAR(1), return ['1'],
    DECIMAL[9,0] return ['9', '0']
    """
    result = re.findall(r"\((.*?)\)", data)
    # doris view column may be VARCHAR(*), check data length if not digit then return 1
    if result:
        result = [i.strip() if i.strip().isdigit() else 1 for i in result[0].split(",")]
        return result  # noqa: RET504
    return []


def extract_child(data):
    """
    extract_child for ARRAY and Struct, such as ARRAY<INT(11)>, then return INT(11)
    """
    result = re.findall(r"(?<=<).+(?=>)", data)
    return result[0]


def _parse_type(_type):
    """
    parse raw type to system_data_type like CHAR(1) -> CHAR, STRUCT<s_id:int(11),s_name:text> -> STRUCT,
    DECIMALV3(9, 0) -> DECIMAL, DATEV2 -> DATE
    """
    parse_type = _type.split("(")[0].split("<")[0]
    if parse_type[-2] == "v":
        system_data_type = parse_type.split("v")[0].upper()
    else:
        system_data_type = parse_type.upper()
    return system_data_type


def _get_column(ordinal, field, _type, null, default, comment):
    _type = _type.lower()
    system_data_type = _parse_type(_type)
    data_type = datatype.parse_sqltype(_type)
    if system_data_type in ["VARCHAR", "CHAR"]:
        data_type.length = extract_number(_type)[0]
    if system_data_type == "DECIMAL":
        number = extract_number(_type)
        if len(number) == 2:
            data_type.precision = number[0]
            data_type.scale = number[1]
    arr_data_type = None
    children = None
    if system_data_type == "ARRAY":
        element_type = extract_child(_type) or "string"
        arr_data_type = _parse_type(element_type)
        if arr_data_type == "STRUCT":
            element_parsed = parse_complex_column_type(element_type)
            children = element_parsed.get("children") if element_parsed else None
    elif system_data_type == "STRUCT":
        struct_parsed = parse_complex_column_type(_type)
        children = struct_parsed.get("children") if struct_parsed else None
    return {
        "name": field,
        "default": default,
        "nullable": True if null == "YES" else None,
        "type": _type,
        "data_type": data_type,
        "display_type": _type.lower(),
        "system_data_type": system_data_type,
        "comment": comment,
        "ordinalPosition": ordinal,
        "arr_data_type": arr_data_type,
        "children": children,
    }


class DorisSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Mysql Source
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        self.ssl_manager = None
        service_connection = config.serviceConnection.root.config
        self.ssl_manager: SSLManager = check_ssl_and_init(service_connection)
        if self.ssl_manager:
            service_connection = self.ssl_manager.setup_ssl(service_connection)
        super().__init__(config, metadata)
        # One entry per schema in progress: each of the `threads` workers ingests its own schema
        self.partitions_cache: LRUCache[dict[str, Row]] = LRUCache(capacity=self.source_config.threads or 1)

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: str | None = None):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        if config.serviceConnection is None:
            raise InvalidSourceException("Missing service connection")
        connection = cast(DorisConnection, config.serviceConnection.root.config)  # noqa: TC006
        if not isinstance(connection, DorisConnection):
            raise InvalidSourceException(f"Expected DorisConnection, but got {connection}")
        return cls(config, metadata)

    def query_table_names_and_types(self, schema_name: str) -> Iterable[TableNameAndType]:
        """
        Connect to the source database to get the table
        name and type. By default, use the inspector method
        to get the names and pass the Regular type.

        This is useful for sources where we need fine-grained
        logic on how to handle table types, e.g., external, foreign,...
        """
        tables = [
            TableNameAndType(name=name, type_=RELKIND_MAP.get(engine, TableType.Regular))
            for name, engine in self.connection.execute(sql.text(DORIS_GET_TABLE_NAMES), {"schema": schema_name}) or []
        ]
        return tables  # noqa: RET504

    @staticmethod
    def get_table_description(schema_name: str, table_name: str, inspector: Inspector) -> str:
        description = None
        try:
            table_info: dict = inspector.get_table_comment(table_name, schema_name)
        # Catch any exception without breaking the ingestion
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Table description error for table [{schema_name}.{table_name}]: {exc}")
        else:
            description = table_info.get("text")

        return description[0]

    def _get_columns(self, table_name, schema=None):
        """
        Overriding the dialect method to add raw_data_type in response
        """

        table_columns = []
        primary_columns = []
        preparer = self.engine.dialect.identifier_preparer
        qualified_table_name = _qualified_identifier(preparer, schema, table_name)
        # row schema: Field, Type, Collation, Null, Key, Default, Extra, Privileges, Comment
        for i, row in enumerate(
            self.connection.execute(sql.text(DORIS_SHOW_FULL_COLUMNS.format(table_name=qualified_table_name)))
        ):
            table_columns.append(_get_column(i, row[0], row[1], row[3], row[5], row[8]))
            if row[4] == "YES":
                primary_columns.append(row[0])

        return table_columns, primary_columns

    def get_columns_and_constraints(  # pylint: disable=too-many-locals
        self,
        schema_name: str,
        table_name: str,
        db_name: str,
        inspector: Inspector,
        table_type: str = None,  # noqa: RUF013
    ) -> tuple[list[Column] | None, list[TableConstraint] | None, list[dict] | None]:
        """
        :param schema_name:
        :param table_name:
        :param db_name:
        :param inspector:
        :return:
        """
        table_constraints = []
        table_columns = []
        columns, primary_columns = self._get_columns(table_name, schema_name)
        for column in columns:
            try:
                children = None
                if column.get("children"):
                    children = [column_from_parsed(ordinal, child) for ordinal, child in enumerate(column["children"])]
                self.process_additional_table_constraints(column=column, table_constraints=table_constraints)

                col_constraint = self._get_column_constraints(column, primary_columns, [])
                col_data_length = self._check_col_length(column["system_data_type"], column["data_type"])
                if col_data_length is None:
                    col_data_length = 1
                if column["system_data_type"] is None:
                    logger.warning(f"Unknown type {repr(column['type'])}: {column['name']}")  # noqa: RUF010
                om_column = Column(
                    name=column["name"] if column["name"] else " ",
                    description=column.get("comment"),
                    dataType=column["system_data_type"],
                    dataTypeDisplay=column.get("type"),
                    dataLength=col_data_length,
                    constraint=col_constraint,
                    children=children,
                    arrayDataType=column["arr_data_type"],
                    ordinalPosition=column.get("ordinalPosition"),
                )
                if column["system_data_type"] == "DECIMAL":
                    om_column.precision = column["data_type"].precision
                    om_column.scale = column["data_type"].scale

                om_column.tags = self.get_column_tag_labels(table_name=table_name, column=column)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Unexpected exception processing column [{column}]: {exc}")
                continue
            table_columns.append(om_column)
        return table_columns, [], []

    def _get_schema_partitions(self, schema_name: str) -> dict[str, Row]:
        """Partition method and columns of every table and view of the schema, read once per schema"""
        try:
            # Read once rather than checking for membership first: an eviction by another
            # worker thread between the two calls would raise here
            return self.partitions_cache.get(schema_name)
        except KeyError:
            try:
                partitions = {
                    row.TABLE_NAME: row
                    for row in self.connection.execute(sql.text(DORIS_GET_PARTITIONS), {"schema": schema_name})
                }
            except Exception as exc:
                # Ingest the schema's tables without partition details rather than fail each of them
                logger.debug(traceback.format_exc())
                logger.warning("Could not read the partitions of schema [%s]: %s", schema_name, exc)
                partitions = {}
            self.partitions_cache.put(schema_name, partitions)
            return partitions

    def _get_create_table(self, schema_name: str, table_name: str) -> str:
        preparer = self.engine.dialect.identifier_preparer
        qualified_table_name = _qualified_identifier(preparer, schema_name, table_name)
        query = DORIS_SHOW_CREATE_TABLE.format(table_name=qualified_table_name)
        # row schema: Table, Create Table
        return self.connection.execute(sql.text(query)).one()[1]

    def get_table_partition_details(
        self,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
    ) -> tuple[bool, TablePartition | None]:
        """
        Partitioning from information_schema.partitions, read once per schema. The DDL is read for an
        OLAP table that is RANGE partitioned or has no partition row: it gives the unit of an
        AUTO PARTITION BY RANGE (date_trunc(...)) or of a dynamic partition, and the partition columns
        of a table without partition rows.
        """
        table = self._get_schema_partitions(schema_name).get(table_name)
        if table is None:
            return False, None
        method = table.PARTITION_METHOD
        if method == "UNPARTITIONED" or (method is None and table.ENGINE != OLAP_ENGINE):
            # A view, or a materialized view without partitions: its DDL does not say RANGE or LIST
            return False, None

        interval = None
        if table.ENGINE == OLAP_ENGINE and method != "LIST":
            create_table = self._get_create_table(schema_name, table_name)
            clause = PARTITION_CLAUSE.search(create_table)
            if clause is None:
                # An unpartitioned table: before Doris 2.1.7 and 3.0.2, information_schema.partitions has no rows
                return False, None
            method, expression = clause.groups()
            column_names = re.findall(r"`([^`]+)`", expression)
            unit = DATE_TRUNC_UNIT.search(expression) or DYNAMIC_PARTITION_UNIT.search(create_table)
            interval = unit.group(1).upper() if unit else None
        else:
            column_names = table.PARTITION_EXPRESSION.split(", ")

        if method == "LIST":
            return True, TablePartition(
                columns=[
                    PartitionColumnDetails(
                        columnName=column_name,
                        intervalType=PartitionIntervalTypes.COLUMN_VALUE,
                        interval=None,
                    )
                    for column_name in column_names
                ]
            )
        columns, _ = self._get_columns(table_name, schema_name)
        column_types = {column["name"]: column["system_data_type"] for column in columns}
        return True, TablePartition(
            columns=[
                PartitionColumnDetails(
                    columnName=column_name,
                    intervalType=PartitionIntervalTypes.TIME_UNIT,
                    interval=interval,
                )
                if column_types[column_name] in TIME_PARTITION_DATA_TYPES
                else PartitionColumnDetails(
                    columnName=column_name,
                    intervalType=PartitionIntervalTypes.INTEGER_RANGE,
                    interval=None,
                )
                for column_name in column_names
            ]
        )
