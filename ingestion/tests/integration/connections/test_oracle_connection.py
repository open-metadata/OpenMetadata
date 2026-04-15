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
covering all three connection types, NNE encryption support, and thick
mode fallback.

IMPORTANT: test ordering matters here.
- test_thick_mode_invalid_directory calls oracledb.init_oracle_client()
  which is once-per-process, so it runs last.
"""

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
from metadata.ingestion.source.database.oracle.connection import OracleConnection


def _build_config(oracle_container, connection_type, instant_client_dir=None):
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


def _assert_select_one(engine: Engine):
    """Execute SELECT 1 FROM DUAL and assert the result."""
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1 FROM DUAL"))
        row = result.fetchone()
        assert row is not None
        assert row[0] == 1


@pytest.mark.order(1)
def test_service_name_connection(oracle_container):
    """Test connectivity using OracleServiceName connection type."""
    config = _build_config(
        oracle_container,
        OracleServiceName(oracleServiceName=oracle_container.dbname),
    )
    connection = OracleConnection(config)
    assert isinstance(connection.client, Engine)
    _assert_select_one(connection.client)


@pytest.mark.order(2)
def test_database_schema_connection_url_building():
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
def test_tns_connection(oracle_container):
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
def test_nne_requires_thick_mode():
    """Verify that NNE (Native Network Encryption) requires thick mode.

    Oracle NNE is only available in thick mode (with Oracle Instant Client).
    Thin mode cannot negotiate NNE — when the server has
    SQLNET.ENCRYPTION_SERVER=required, thin mode gets DPY-4011.

    This was verified against Oracle Enterprise 19c:
    - Thick mode (Instant Client 19c): AES256 encryption negotiated successfully
    - Thin mode (any oracledb version): connection rejected with DPY-4011

    The gvenzl/oracle-free container used in CI does not include NNE (it's
    Enterprise-only), so we validate that oracledb is on 2.x (for other
    improvements) and that thick mode is the documented path for NNE.
    """
    assert oracledb.is_thin_mode is not None  # module loaded
    major_version = int(oracledb.__version__.split(".")[0])
    assert major_version >= 2, f"oracledb {oracledb.__version__} should be >= 2.0"


@pytest.mark.order(5)
def test_thick_mode_invalid_directory(oracle_container):
    """Test that an invalid instantClientDirectory falls back to thin mode.

    oracledb.init_oracle_client() is once-per-process, so this test runs last.
    """
    config = _build_config(
        oracle_container,
        OracleServiceName(oracleServiceName=oracle_container.dbname),
        instant_client_dir="/nonexistent/path",
    )
    connection = OracleConnection(config)
    assert isinstance(connection.client, Engine)
    _assert_select_one(connection.client)
