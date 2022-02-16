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
import sqlalchemy
from metadata.generated.schema.entity.data.database import Database
from sqlalchemy.orm import DeclarativeMeta, declarative_base

from metadata.generated.schema.entity.data.table import Column, DataType, Table

Base = declarative_base()

_TYPE_MAP = {
    DataType.NUMBER: sqlalchemy.Integer,
    DataType.NUMERIC: sqlalchemy.Numeric,
}


def build_orm_col(idx: int, col: Column) -> sqlalchemy.Column:
    """
    Cook the ORM column from our metadata instance
    information.

    The first parsed column will be used arbitrarily
    as the PK, as SQLAlchemy forces us to specify
    at least one PK.

    As this is only used for INSERT/UPDATE/DELETE,
    there is no impact for our read-only purposes.
    """
    return sqlalchemy.Column(
        name=str(col.name.__root__),
        type_=_TYPE_MAP.get(col.dataType),
        primary_key=True if idx == 0 else False,
    )


def build_table_name(table: Table, database: Database) -> str:
    """
    Let's use the Table information to build the table
    name, which will be based on its db name.
    """

    return f"{database.name.__root__}.{table.name.__root__}"


def ometa_to_orm(table: Table, database: Database) -> DeclarativeMeta:
    """
    Given an OpenMetadata instance, prepare
    the SQLAlchemy DeclarativeMeta class
    to run queries on top of it.

    We are building the class dynamically using
    `type` and passing SQLAlchemy `Base` class
    as the bases tuple for inheritance.
    """

    cols = {
        str(col.name.__root__): build_orm_col(idx, col)
        for idx, col in enumerate(table.columns)
    }

    # Type takes positional arguments in the form of (name, bases, dict)
    return type(
        table.fullyQualifiedName.replace(".", "_"),  # Output class name
        (Base,),  # SQLAlchemy declarative base
        {
            "__tablename__": build_table_name(table, database),
            **cols,
        },
    )
