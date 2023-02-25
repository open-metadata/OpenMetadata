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
Confest for profiler tests
"""

from uuid import UUID

from pytest import fixture
from sqlalchemy import create_engine

from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.ingestion.connections.session import create_and_bind_session


def metadata_connection_object():
    return OpenMetadataConnection(hostPort="http://localhost:8585/api")


def session():
    engine = create_engine("sqlite+pysqlite:///:memory:", echo=True, future=True)
    session = create_and_bind_session(engine)

    yield session

    session.close()


@fixture
def base_table():
    return Table(
        id=UUID("12345678123456781234567812345678"),
        name="table",
        fullyQualifiedName="my.awesome.table",
        columns=[
            Column(
                name="foo",
                dataType=DataType.STRING,
            ),
            Column(
                name="bar",
                dataType=DataType.NUMERIC,
            ),
        ],
    )
