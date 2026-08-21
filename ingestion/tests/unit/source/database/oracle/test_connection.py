#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import pytest

from metadata.generated.schema.entity.services.connections.database.oracleConnection import (
    OracleConnection as OracleConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.oracleConnection import (
    OracleScheme,
    OracleServiceName,
)
from metadata.ingestion.source.database.oracle.connection import OracleConnection


@pytest.mark.parametrize(
    "scheme",
    [None, OracleScheme.oracle_oracledb, OracleScheme.oracle_cx_oracle],
)
def test_connection_url_uses_native_oracledb_dialect(scheme):
    connection_args = {
        "username": "admin",
        "password": "password",
        "hostPort": "localhost:1521",
        "oracleConnectionType": OracleServiceName(oracleServiceName="my_service"),
    }
    if scheme is not None:
        connection_args["scheme"] = scheme

    connection = OracleConnectionConfig(**connection_args)

    assert (
        OracleConnection.get_connection_url(connection)
        == "oracle+oracledb://admin:password@localhost:1521/?service_name=my_service"
    )
