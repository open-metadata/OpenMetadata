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
MySQL connection test
"""
from unittest import TestCase

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.ingestion.source.connections import get_connection, get_test_connection_fn


class MySQLConnectionTest(TestCase):
    """
    Validate MySQL connections
    """

    connection = MysqlConnection(
        username="openmetadata_user",
        password="openmetadata_password",
        hostPort="localhost:3306",
        databaseSchema="openmetadata_db",
    )

    def test_get_connection(self):
        engine = get_connection(self.connection)
        self.assertTrue(isinstance(engine, Engine))

    def test_test_connection(self):
        engine = get_connection(self.connection)

        _test_connection_fn = get_test_connection_fn(self.connection)
        _test_connection_fn(engine)
