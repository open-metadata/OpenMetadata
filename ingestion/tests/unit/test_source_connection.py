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
from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
    HiveScheme,
    HiveSQLConnection,
)
from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection,
    TrinoScheme,
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
        databricks_conn_obj = HiveSQLConnection(
            scheme=HiveScheme.hive, hostPort="localhost:10000", database="default"
        )
        assert expected_result == get_connection_url(databricks_conn_obj)

    def test_hive_url_auth(self):
        expected_result = "hive://localhost:10000/default;auth=CUSTOM"
        databricks_conn_obj = HiveSQLConnection(
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
