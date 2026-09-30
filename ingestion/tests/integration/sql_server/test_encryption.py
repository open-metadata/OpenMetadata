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
"""What each driver actually does with the encryption switches.

The claim worth pinning is the uncomfortable one the connector now documents and
warns about: on mssql+pytds and mssql+pymssql, turning Encrypt Connection on
without a CA certificate does not encrypt anything. Only the server can settle
that, so it is asked - sys.dm_exec_connections.encrypt_option reports whether the
session carrying the question is encrypted.

mssql+pyodbc is the one scheme that can enforce encryption without a CA
certificate, and it is asserted here too - but only where Microsoft's ODBC driver
is installed, which the CI runners no more do than a plain dev machine (the
workflows install unixodbc-dev, the driver manager, not a driver). It skips
rather than fails there; tests/unit/test_ssl_manager.py covers the part that
holds without a driver, namely the switches reaching the connection arguments.
"""

import logging

import pytest

from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection as MssqlConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlScheme,
)
from metadata.ingestion.source.database.mssql.connection import MssqlConnection
from metadata.utils.ssl_manager import check_ssl_and_init

ENCRYPT_OPTION = "SELECT encrypt_option FROM sys.dm_exec_connections WHERE session_id = @@SPID"

# Neither driver takes an encrypt switch: pytds enables TLS only when it is given
# a CA certificate, and pymssql leaves the decision to FreeTDS entirely.
DRIVERS_WITHOUT_AN_ENCRYPT_SWITCH = [MssqlScheme.mssql_pytds, MssqlScheme.mssql_pymssql]


def _encryption_reported_by_the_server(mssql_container, scheme: MssqlScheme, **kwargs) -> str:
    """Connect the way the source does and ask the server what it got."""
    connection = MssqlConnectionConfig(
        type="Mssql",
        scheme=scheme,
        username=mssql_container.username,
        password=mssql_container.password,
        hostPort=f"localhost:{mssql_container.get_exposed_port(mssql_container.port)}",
        database="master",
        **kwargs,
    )
    # The same two steps CommonDbSourceService runs before it builds its engine.
    ssl_manager = check_ssl_and_init(connection)
    if ssl_manager:
        connection = ssl_manager.setup_ssl(connection)

    engine = MssqlConnection(connection).client
    try:
        with engine.connect() as session:
            return session.exec_driver_sql(ENCRYPT_OPTION).scalar()
    finally:
        engine.dispose()
        if ssl_manager:
            ssl_manager.cleanup_temp_files()


@pytest.mark.parametrize("scheme", DRIVERS_WITHOUT_AN_ENCRYPT_SWITCH, ids=lambda scheme: scheme.value)
def test_a_connection_is_unencrypted_when_encryption_is_off(mssql_container, scheme):
    """The baseline the next test is only meaningful against."""
    assert _encryption_reported_by_the_server(mssql_container, scheme, encrypt=False) == "FALSE"


@pytest.mark.parametrize("scheme", DRIVERS_WITHOUT_AN_ENCRYPT_SWITCH, ids=lambda scheme: scheme.value)
def test_encrypt_without_a_ca_certificate_is_not_honoured_but_is_announced(mssql_container, scheme, caplog):
    """Asking these drivers to encrypt, and giving them nothing to verify the
    server with, leaves the session in the clear. The connector cannot make the
    driver encrypt, so the whole of its duty is to say so rather than let the
    configuration claim something the wire does not do."""
    with caplog.at_level(logging.WARNING):
        encryption = _encryption_reported_by_the_server(
            mssql_container, scheme, encrypt=True, trustServerCertificate=True
        )

    assert encryption == "FALSE"
    assert "NOT be encrypted" in caplog.text


def _the_driver_this_test_asks_for() -> str:
    """The schema's own default, read rather than repeated, since that is what the
    connection below will ask the driver manager for."""
    return MssqlConnectionConfig.model_fields["driver"].default


def _that_driver_is_missing() -> bool:
    """Any other ODBC driver being installed is not enough: unixODBC will simply
    fail to open the one named, so the test has to look for that name."""
    try:
        import pyodbc
    except ImportError:
        return True
    return _the_driver_this_test_asks_for() not in pyodbc.drivers()


@pytest.mark.skipif(
    _that_driver_is_missing(),
    reason=f"needs {_the_driver_this_test_asks_for()}, which neither CI nor a plain dev machine installs",
)
def test_pyodbc_encrypts_when_asked_to(mssql_container):
    """The counterpart to the drivers above: ODBC takes both switches natively,
    so it is the only scheme that can encrypt against a server whose certificate
    OpenMetadata was given nothing to verify."""
    encryption = _encryption_reported_by_the_server(
        mssql_container,
        MssqlScheme.mssql_pyodbc,
        encrypt=True,
        trustServerCertificate=True,
    )

    assert encryption == "TRUE"
