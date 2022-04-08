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
from metadata.utils.source_connections import get_connection_url


class DatabricksConnectionTest(TestCase):
    def test_connection_url_without_db(self):
        expected_result = (
            "databricks+connector://token:KlivDTACWXKmZVfN1qIM@1.1.1.1:443"
        )
        databricks_conn_obj = DatabricksConnection(
            scheme=DatabricksScheme.databricks_connector,
            hostPort="1.1.1.1:443",
            token="KlivDTACWXKmZVfN1qIM",
        )
        assert expected_result == get_connection_url(databricks_conn_obj)

    def test_connection_url_with_db(self):
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
