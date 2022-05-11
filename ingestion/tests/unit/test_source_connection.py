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


from unittest import TestCase

from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
    DatabricksScheme,
)
from metadata.generated.schema.entity.services.connections.database.druidConnection import (
    DruidConnection,
    DruidScheme,
)
from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
    HiveConnection,
    HiveScheme,
)
from metadata.generated.schema.entity.services.connections.database.pinotDBConnection import (
    PinotDBConnection,
    PinotDBScheme,
)
from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection,
    TrinoScheme,
)
from metadata.generated.schema.entity.services.connections.database.verticaConnection import (
    VerticaConnection,
    VerticaScheme,
)
from metadata.utils.source_connections import get_connection_args, get_connection_url


class SouceConnectionTest(TestCase):
    def test_databricks_url_without_db(self):
        expected_result = (
            "databricks+connector://token:KlivDTACWXKmZVfN1qIM@1.1.1.1:443"
        )
        databricks_conn_obj = DatabricksConnection(
            scheme=DatabricksScheme.databricks_connector,
            hostPort="1.1.1.1:443",
            token="KlivDTACWXKmZVfN1qIM",
        )
        assert expected_result == get_connection_url(databricks_conn_obj)

    def test_databricks_url_with_db(self):
        expected_result = (
            "databricks+connector://token:KlivDTACWXKmZVfN1qIM@1.1.1.1:443/default"
        )
        databricks_conn_obj = DatabricksConnection(
            scheme=DatabricksScheme.databricks_connector,
            hostPort="1.1.1.1:443",
            token="KlivDTACWXKmZVfN1qIM",
            database="default",
        )
        assert expected_result == get_connection_url(databricks_conn_obj)

    def test_hive_url(self):
        expected_result = "hive://localhost:10000/default"
        databricks_conn_obj = HiveConnection(
            scheme=HiveScheme.hive, hostPort="localhost:10000", database="default"
        )
        assert expected_result == get_connection_url(databricks_conn_obj)

    def test_hive_url_auth(self):
        expected_result = "hive://localhost:10000/default;auth=CUSTOM"
        databricks_conn_obj = HiveConnection(
            scheme=HiveScheme.hive,
            hostPort="localhost:10000",
            database="default",
            authOptions="auth=CUSTOM",
        )
        assert expected_result == get_connection_url(databricks_conn_obj)

    def test_trino_url_without_params(self):
        expected_url = "trino://username:pass@localhost:443/catalog"
        trino_conn_obj = TrinoConnection(
            scheme=TrinoScheme.trino,
            hostPort="localhost:443",
            username="username",
            password="pass",
            catalog="catalog",
        )
        assert expected_url == get_connection_url(trino_conn_obj)

    def test_trino_conn_arguments(self):
        # connection arguments without connectionArguments and without proxies
        expected_args = {}
        trino_conn_obj = TrinoConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            catalog="tpcds",
            database="tiny",
            connectionArguments=None,
            scheme=TrinoScheme.trino,
        )
        assert expected_args == get_connection_args(trino_conn_obj)

        # connection arguments with connectionArguments and without proxies
        expected_args = {"user": "user-to-be-impersonated"}
        trino_conn_obj = TrinoConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            catalog="tpcds",
            database="tiny",
            connectionArguments={"user": "user-to-be-impersonated"},
            scheme=TrinoScheme.trino,
        )
        assert expected_args == get_connection_args(trino_conn_obj)

        # connection arguments without connectionArguments and with proxies
        expected_args = {}
        trino_conn_obj = TrinoConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            catalog="tpcds",
            database="tiny",
            connectionArguments=None,
            proxies={"http": "foo.bar:3128", "http://host.name": "foo.bar:4012"},
            scheme=TrinoScheme.trino,
        )
        conn_args = get_connection_args(trino_conn_obj)
        assert "http_session" in conn_args
        conn_args.pop("http_session")
        assert expected_args == conn_args

        # connection arguments with connectionArguments and with proxies
        expected_args = {"user": "user-to-be-impersonated"}
        trino_conn_obj = TrinoConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            catalog="tpcds",
            database="tiny",
            connectionArguments={"user": "user-to-be-impersonated"},
            proxies={"http": "foo.bar:3128", "http://host.name": "foo.bar:4012"},
            scheme=TrinoScheme.trino,
        )
        conn_args = get_connection_args(trino_conn_obj)
        assert "http_session" in conn_args
        conn_args.pop("http_session")
        assert expected_args == conn_args

    def test_trino_url_with_params(self):
        expected_url = "trino://username:pass@localhost:443/catalog?param=value"
        trino_conn_obj = TrinoConnection(
            scheme=TrinoScheme.trino,
            hostPort="localhost:443",
            username="username",
            password="pass",
            catalog="catalog",
            params={"param": "value"},
        )
        assert expected_url == get_connection_url(trino_conn_obj)

    def test_trino_with_proxies(self):
        test_proxies = {"http": "http_proxy", "https": "https_proxy"}
        trino_conn_obj = TrinoConnection(
            scheme=TrinoScheme.trino,
            hostPort="localhost:443",
            username="username",
            password="pass",
            catalog="catalog",
            proxies=test_proxies,
        )
        assert (
            test_proxies
            == get_connection_args(trino_conn_obj).get("http_session").proxies
        )

    def test_vertica_url(self):
        expected_url = (
            "vertica+vertica_python://username:password@localhost:5443/database"
        )
        vertica_conn_obj = VerticaConnection(
            scheme=VerticaScheme.vertica_vertica_python,
            hostPort="localhost:5443",
            username="username",
            password="password",
            database="database",
        )
        assert expected_url == get_connection_url(vertica_conn_obj)

    def test_druid_url(self):
        expected_url = "druid://localhost:8082/druid/v2/sql"
        druid_conn_obj = DruidConnection(
            scheme=DruidScheme.druid, hostPort="localhost:8082"
        )
        assert expected_url == get_connection_url(druid_conn_obj)

    def test_pinotdb_url(self):
        expected_url = (
            "pinot://localhost:8099/query/sql?controller=http://localhost:9000/"
        )
        pinot_conn_obj = PinotDBConnection(
            scheme=PinotDBScheme.pinot,
            hostPort="localhost:8099",
            pinotControllerHost="http://localhost:9000/",
        )
        assert expected_url == get_connection_url(pinot_conn_obj)
