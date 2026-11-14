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
from sqlalchemy import sql
from sqlalchemy.dialects.mysql.reflection import MySQLTableDefinitionParser
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.sql.compiler import IdentifierPreparer

from metadata.generated.schema.entity.data.table import (
    Column,
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
    DORIS_GET_MATERIALIZED_VIEW_NAMES,
    DORIS_PARTITION_DETAILS,
    DORIS_SHOW_CREATE_MATERIALIZED_VIEW,
    DORIS_SHOW_CREATE_TABLE,
    DORIS_SHOW_FULL_COLUMNS,
)
from metadata.ingestion.source.database.mysql.utils import parse_column
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_manager import SSLManager, check_ssl_and_init

MySQLTableDefinitionParser._parse_column = (  # pylint: disable=protected-access
    parse_column
)

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
        The base tables of the schema, as the generic source lists them; views are listed apart by
        query_view_names_and_types. Doris reports an async materialized view as a base table, so
        mv_infos() tells the materialized views apart.
        """
        materialized_views = {
            name
            for (name,) in self.connection.execute(sql.text(DORIS_GET_MATERIALIZED_VIEW_NAMES), {"schema": schema_name})
        }
        return [
            TableNameAndType(name=table.name, type_=TableType.MaterializedView)
            if table.name in materialized_views
            else table
            for table in super().query_table_names_and_types(schema_name)
        ]

    def _get_create_statement(self, show_create: str, schema_name: str, table_name: str) -> str:
        """The DDL, second column of SHOW CREATE TABLE and of SHOW CREATE MATERIALIZED VIEW"""
        preparer = self.engine.dialect.identifier_preparer
        qualified_table_name = _qualified_identifier(preparer, schema_name, table_name)
        return self.connection.execute(sql.text(show_create.format(table_name=qualified_table_name))).one()[1]

    def get_schema_definition(
        self,
        table_type: TableType,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
    ) -> str | None:
        """
        The definition of a materialized view, and with includeDDL the DDL of a table, as Doris prints
        them: SHOW CREATE TABLE refuses an async materialized view, and the DDL SQLAlchemy rebuilds
        from reflection has no key model, partitioning, distribution or properties.
        """
        if table_type == TableType.MaterializedView:
            show_create = DORIS_SHOW_CREATE_MATERIALIZED_VIEW
        elif table_type == TableType.Regular and self.source_config.includeDDL:
            show_create = DORIS_SHOW_CREATE_TABLE
        else:
            return super().get_schema_definition(table_type, table_name, schema_name, inspector)
        try:
            return self._get_create_statement(show_create, schema_name, table_name).strip()
        except Exception as exc:
            # Same as the generic source: the table is ingested without a definition
            logger.debug(traceback.format_exc())
            logger.debug("Failed to fetch schema definition for %s: %s", table_name, exc)
        return None

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

    def get_table_partition_details(
        self,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
    ) -> tuple[bool, TablePartition | None]:
        """
        check if the table is partitioned table and return the partition details
        """
        try:
            preparer = self.engine.dialect.identifier_preparer
            qualified_table_name = _qualified_identifier(
                preparer,
                schema_name,
                table_name,
            )
            with self.engine.connect() as conn:
                result = conn.execute(sql.text(DORIS_PARTITION_DETAILS.format(table_name=qualified_table_name))).all()

            if result and result[0].PartitionKey != "":
                partition_details = TablePartition(
                    columns=[
                        PartitionColumnDetails(
                            columnName=partition_key,
                            intervalType=PartitionIntervalTypes.TIME_UNIT,
                            interval=None,
                        )
                        for partition_key in result[0].PartitionKey.split(", ")
                    ]
                )

                return True, partition_details
            return False, None  # noqa: TRY300
        except Exception:
            return False, None
