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
MySQL connection test
"""
import sys

import pytest
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.ingestion.source.connections import get_connection, get_test_connection_fn

if sys.version_info < (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)


def test_test_connection(metadata, mysql_container):
    """
    Test connection function requires:
    - ometa
    - connection object, i.e., the engine
    - the service connection
    """
    service_connection = MysqlConnection(
        username=mysql_container.username,
        authType=BasicAuth(password=mysql_container.password),
        hostPort=f"localhost:{mysql_container.get_exposed_port(3306)}",
    )

    engine = get_connection(service_connection)
    assert isinstance(engine, Engine)

    _test_connection_fn = get_test_connection_fn(service_connection)
    _test_connection_fn(metadata)
