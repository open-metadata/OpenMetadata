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

from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
    HiveScheme,
    HiveSQLConnection,
)
from metadata.utils.source_connections import get_connection_url


class HiveConnectionTest(TestCase):
    def test_connection_url(self):
        expected_result = "hive://localhost:10000/default"
        databricks_conn_obj = HiveSQLConnection(
            scheme=HiveScheme.hive, hostPort="localhost:10000", database="default"
        )
        assert expected_result == get_connection_url(databricks_conn_obj)
