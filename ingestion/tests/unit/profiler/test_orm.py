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
Validate conversion between OpenMetadata and SQLAlchemy ORM
"""
import uuid

import sqlalchemy

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.orm_profiler.orm.converter import ometa_to_orm


def test_simple_conversion():
    """
    Check that we can convert simple tables
    """

    database = Database(
        id=uuid.uuid4(),
        name="one_db",
        service=EntityReference(
            id=uuid.uuid4(), name="one_service", type="databaseService"
        ),
    )

    table = Table(
        id=uuid.uuid4(),
        name="table1",
        database=EntityReference(id=uuid.uuid4(), name="one_db", type="database"),
        fullyQualifiedName=f"service.one_db.table1",
        columns=[
            Column(name="id", dataType=DataType.BIGINT),
            Column(name="name", dataType=DataType.STRING),
            Column(name="age", dataType=DataType.INT),
            Column(name="last_updated", dataType=DataType.TIMESTAMP),
            Column(name="created_date", dataType=DataType.DATE),
            Column(name="group", dataType=DataType.CHAR),
            Column(name="savings", dataType=DataType.DECIMAL),
        ],
    )

    orm_table = ometa_to_orm(table=table, database=database)

    assert orm_table.__tablename__ == "table1"
    assert orm_table.__table_args__ == {"schema": "one_db"}

    assert isinstance(orm_table.id.type, sqlalchemy.BIGINT)
    assert isinstance(orm_table.name.type, sqlalchemy.String)
    assert isinstance(orm_table.age.type, sqlalchemy.INTEGER)
    assert isinstance(orm_table.last_updated.type, sqlalchemy.TIMESTAMP)
    assert isinstance(orm_table.created_date.type, sqlalchemy.DATE)
    assert isinstance(orm_table.group.type, sqlalchemy.CHAR)
    assert isinstance(orm_table.savings.type, sqlalchemy.DECIMAL)

    print(orm_table.__table__.c)
    for elem in orm_table.__table__.c:
        print(elem)
        print(elem.name)
