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
OpenMetadata source URL building tests
"""
from unittest import TestCase

from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftConnection,
)
from metadata.utils.source_connections import get_connection_url


class TestConfig(TestCase):
    def test_mysql_url(self):
        """
        Validate MySQL URL building
        """
        connection = MysqlConnection(
            username="username",
            password="password",
            hostPort="localhost:1234",
        )
        url = get_connection_url(connection)
        assert url == "mysql+pymysql://username:password@localhost:1234"

    def test_redshift_url(self):
        """
        Validate Redshift URL building
        """
        connection = RedshiftConnection(
            username="username",
            password="password",
            hostPort="localhost:1234",
            database="dev",
        )
        url = get_connection_url(connection)
        assert url == "redshift+psycopg2://username:password@localhost:1234/dev"

    def test_redshift_url_without_db(self):
        """
        Validate Redshift without DB URL building
        """
        connection_without_db = RedshiftConnection(
            username="username", password="password", hostPort="localhost:1234"
        )
        url_without_db = get_connection_url(connection_without_db)
        assert url_without_db == "redshift+psycopg2://username:password@localhost:1234"
