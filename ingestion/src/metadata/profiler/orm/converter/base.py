#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Converter logic to transform an OpenMetadata Table Entity
to an SQLAlchemy ORM class.
"""
from typing import Optional, cast

import sqlalchemy
from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeMeta, declarative_base

from metadata.generated.schema.entity.data.database import Database, databaseService
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Column, Table
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.orm.converter.converter_registry import converter_registry

Base = declarative_base()


SQA_RESERVED_ATTRIBUTES = ["metadata"]


def check_snowflake_case_sensitive(table_service_type, table_or_col) -> Optional[bool]:
    """Check whether column or table name are not uppercase for snowflake table.
    If so, then force quoting, If not return None to let engine backend handle the logic.

    Args:
        table_or_col: a table or a column name
    Return:
        None or True
    """
    if table_service_type == databaseService.DatabaseServiceType.Snowflake:
        return True if not str(table_or_col).isupper() else None

    return None


def check_if_should_quote_column_name(table_service_type) -> Optional[bool]:
    """Check whether column name should be quoted when passed into the sql command build up.
    This is important when a column name is the same as a reserve word and causes a sql error.

    Args:
        table_service_type: the main sql engine to determine if we should always quote.
    Return: True or False
    """

    if table_service_type in {
        databaseService.DatabaseServiceType.Hive,
        databaseService.DatabaseServiceType.Impala,
    }:
        return True

    return None


def build_orm_col(
    idx: int, col: Column, table_service_type, *, _quote=None
) -> sqlalchemy.Column:
    """
    Cook the ORM column from our metadata instance
    information.

    The first parsed column will be used arbitrarily
    as the PK, as SQLAlchemy forces us to specify
    at least one PK.

    As this is only used for INSERT/UPDATE/DELETE,
    there is no impact for our read-only purposes.
    """
    if _quote is not None:
        quote = _quote
    else:
        quote = check_if_should_quote_column_name(
            table_service_type
        ) or check_snowflake_case_sensitive(table_service_type, col.name.root)

    return sqlalchemy.Column(
        name=str(col.name.root),
        type_=converter_registry[table_service_type]().map_types(
            col, table_service_type
        ),
        primary_key=not bool(idx),  # The first col seen is used as PK
        quote=quote,
        key=str(
            col.name.root
        ).lower(),  # Add lowercase column name as key for snowflake case sensitive columns
    )


def ometa_to_sqa_orm(
    table: Table, metadata: OpenMetadata, sqa_metadata_obj: Optional[MetaData] = None
) -> DeclarativeMeta:
    """
    Given an OpenMetadata instance, prepare
    the SQLAlchemy DeclarativeMeta class
    to run queries on top of it.

    We are building the class dynamically using
    `type` and passing SQLAlchemy `Base` class
    as the bases tuple for inheritance.
    """
    table.serviceType = cast(
        databaseService.DatabaseServiceType, table.serviceType
    )  # satisfy mypy
    cols = {
        (
            col.name.root + "_"
            if col.name.root in SQA_RESERVED_ATTRIBUTES
            else col.name.root
        ): build_orm_col(idx, col, table.serviceType)
        for idx, col in enumerate(table.columns)
    }

    orm_database_name = get_orm_database(table, metadata)
    orm_schema_name = get_orm_schema(table, metadata)
    orm_name = f"{orm_database_name}_{orm_schema_name}_{table.name.root}".replace(
        ".", "_"
    )

    # Type takes positional arguments in the form of (name, bases, dict)
    orm = type(
        orm_name,  # Output class name
        (Base,),  # SQLAlchemy declarative base
        {
            "__tablename__": str(table.name.root),
            "__table_args__": {
                # SQLite does not support schemas
                "schema": orm_schema_name
                if table.serviceType != databaseService.DatabaseServiceType.SQLite
                else None,
                "extend_existing": True,  # Recreates the table ORM object if it already exists. Useful for testing
                "quote": check_snowflake_case_sensitive(
                    table.serviceType, table.name.root
                ),
            },
            **cols,
            "metadata": sqa_metadata_obj or Base.metadata,
        },
    )

    if not isinstance(orm, DeclarativeMeta):
        raise ValueError("OMeta to ORM did not create a DeclarativeMeta")

    return orm


def get_orm_schema(table: Table, metadata: OpenMetadata) -> str:
    """
    Build a fully qualified schema name depending on the
    service type. For example:
    - MySQL -> schema.table
    - Trino -> catalog.schema.table
    - Snowflake -> database.schema.table

    The logic depends on if the service supports databases
    or not.
    :param table: Table being profiled
    :param metadata: OMeta client
    :return: qualified schema name
    """

    schema: DatabaseSchema = metadata.get_by_id(
        entity=DatabaseSchema, entity_id=table.databaseSchema.id
    )

    return str(schema.name.root)


def get_orm_database(table: Table, metadata: OpenMetadata) -> str:
    """get database name from database service

    Args:
        table (Table): table entity
        metadata (OpenMetadata): metadata connection to OM server instance

    Returns:
        str
    """

    database: Database = metadata.get_by_id(
        entity=Database, entity_id=table.database.id
    )

    return str(database.name.root)
