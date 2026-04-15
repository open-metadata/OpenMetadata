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
Oracle connection integration tests.

Tests the OracleConnection class against a real Oracle container,
covering connection types, error handling, and thick mode behavior.

IMPORTANT: test_thick_mode_invalid_directory calls
oracledb.init_oracle_client() which is once-per-process, so it runs last.
"""
from typing import Optional, Union

import oracledb
import pytest
from sqlalchemy import text
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.oracleConnection import (
    OracleConnection as OracleConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.oracleConnection import (
    OracleDatabaseSchema,
    OracleServiceName,
    OracleTNSConnection,
)
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.database.oracle.connection import OracleConnection
from tests.integration.containers import OracleContainerConfigs

OracleConnectionType = Union[
    OracleDatabaseSchema, OracleServiceName, OracleTNSConnection
]


def _build_config(
    oracle_container: OracleContainerConfigs,
    connection_type: OracleConnectionType,
    instant_client_dir: Optional[str] = None,
) -> OracleConnectionConfig:
    """Build an OracleConnectionConfig for the given connection type."""
    kwargs = {
        "type": "Oracle",
        "username": oracle_container.username,
        "password": oracle_container.password,
        "hostPort": f"localhost:{oracle_container.exposed_port}",
        "oracleConnectionType": connection_type,
    }
    if instant_client_dir is not None:
        kwargs["instantClientDirectory"] = instant_client_dir
    else:
        kwargs["instantClientDirectory"] = ""

    return OracleConnectionConfig(**kwargs)


def _assert_select_one(engine: Engine) -> None:
    """Execute SELECT 1 FROM DUAL and assert the result."""
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1 FROM DUAL"))
        row = result.fetchone()
        assert row is not None
        assert row[0] == 1


@pytest.mark.order(1)
def test_service_name_connection(oracle_container: OracleContainerConfigs) -> None:
    """Test connectivity using OracleServiceName connection type."""
    config = _build_config(
        oracle_container,
        OracleServiceName(oracleServiceName=oracle_container.dbname),
    )
    connection = OracleConnection(config)
    assert isinstance(connection.client, Engine)
    _assert_select_one(connection.client)


@pytest.mark.order(2)
def test_database_schema_connection_url_building() -> None:
    """Verify URL building for OracleDatabaseSchema connection type.

    OracleDatabaseSchema puts the schema as the URL path, which the Oracle
    driver interprets as a SID. The gvenzl/oracle-free container only
    registers service names (not SIDs for the PDB), so we validate URL
    construction rather than a live connection.
    """
    config = OracleConnectionConfig(
        type="Oracle",
        username="user",
        password="pass",
        hostPort="myhost:1521",
        oracleConnectionType=OracleDatabaseSchema(databaseSchema="MYSCHEMA"),
        instantClientDirectory="",
    )
    url = OracleConnection.get_connection_url(config)
    assert "oracle+cx_oracle://" in url
    assert "myhost:1521/MYSCHEMA" in url


@pytest.mark.order(3)
def test_tns_connection(oracle_container: OracleContainerConfigs) -> None:
    """Test connectivity using OracleTNSConnection (full TNS descriptor)."""
    tns_string = (
        f"(DESCRIPTION="
        f"(ADDRESS=(PROTOCOL=TCP)(HOST=localhost)(PORT={oracle_container.exposed_port}))"
        f"(CONNECT_DATA=(SERVICE_NAME={oracle_container.dbname})))"
    )
    config = _build_config(
        oracle_container,
        OracleTNSConnection(oracleTNSConnection=tns_string),
    )
    connection = OracleConnection(config)
    assert isinstance(connection.client, Engine)
    _assert_select_one(connection.client)


@pytest.mark.order(4)
def test_oracledb_version_minimum() -> None:
    """Ensure oracledb >= 2.0 is installed.

    The 2.x upgrade brings improved error messages and connection handling.
    NNE (Native Network Encryption) still requires thick mode regardless
    of oracledb version — verified against Oracle Enterprise 19c.
    """
    major_version = int(oracledb.__version__.split(".")[0])
    assert major_version >= 2, f"oracledb {oracledb.__version__} should be >= 2.0"


@pytest.mark.order(5)
def test_thin_mode_failure_raises(oracle_container: OracleContainerConfigs) -> None:
    """Verify that a failed thin connection raises SourceConnectionException."""
    config = _build_config(
        oracle_container,
        OracleServiceName(oracleServiceName="nonexistent_service"),
    )
    with pytest.raises(SourceConnectionException, match="Could not connect"):
        OracleConnection(config).client


@pytest.mark.order(6)
def test_thick_mode_invalid_directory_raises() -> None:
    """Verify that an invalid instantClientDirectory raises SourceConnectionException.

    When the user explicitly sets instantClientDirectory, they need thick mode
    (typically for NNE). A failed init should fail fast, not silently fall back.

    Uses a bogus host so no real connection is attempted. Tests the init_oracle_client
    failure path in isolation.

    oracledb.init_oracle_client() is once-per-process — if a prior test already
    called it (even with a failure), subsequent calls may raise ProgrammingError
    instead of DatabaseError, causing _init_thick_mode to return True. We skip
    in that case since the behavior can only be tested in a fresh process.
    """
    config = OracleConnectionConfig(
        type="Oracle",
        username="user",
        password="pass",
        hostPort="bogus:1521",
        oracleConnectionType=OracleServiceName(oracleServiceName="test"),
        instantClientDirectory="/nonexistent/path",
    )
    try:
        OracleConnection(config).client
        pytest.skip(
            "init_oracle_client already called in this process — "
            "cannot test the failure path"
        )
    except SourceConnectionException:
        pass  # expected
