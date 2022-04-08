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

from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection,
    TrinoScheme,
)
from metadata.utils.source_connections import get_connection_args, get_connection_url


class TrinoConnectionTest(TestCase):
    def test_connection_url_without_params(self):
        expected_url = "trino://username:pass@localhost:443/catalog"
        trino_conn_obj = TrinoConnection(
            scheme=TrinoScheme.trino,
            hostPort="localhost:443",
            username="username",
            password="pass",
            catalog="catalog",
        )
        assert expected_url == get_connection_url(trino_conn_obj)

    def test_connection_url_with_params(self):
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

    def test_connection_with_proxies(self):
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
