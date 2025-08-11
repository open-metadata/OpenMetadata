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

"""
OpenMetadata source URL building tests
"""
from unittest import TestCase

from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection,
    MssqlScheme,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftConnection,
)
from metadata.ingestion.connections.builders import get_connection_url_common


class TestConfig(TestCase):
    def test_mysql_url(self):
        """
        Validate MySQL URL building
        """
        connection = MysqlConnection(
            username="username",
            authType=BasicAuth(password="password"),
            hostPort="localhost:1234",
        )
        url = get_connection_url_common(connection)
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
        url = get_connection_url_common(connection)
        assert url == "redshift+psycopg2://username:password@localhost:1234/dev"

    def test_mssql_url(self):
        """
        Validate URL building for MSSQL
        """
        from metadata.ingestion.source.database.mssql.connection import (
            get_connection_url,
        )

        expected_url = "mssql+pytds://sa:password@james\\bond:1433/master"
        mssql_conn_obj = MssqlConnection(
            username="sa",
            password="password",
            hostPort="james\\bond:1433",
            scheme=MssqlScheme.mssql_pytds,
            database="master",
        )

        assert expected_url == get_connection_url(mssql_conn_obj)
