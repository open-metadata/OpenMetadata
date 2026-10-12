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
"""MSSQL table-diff connection parameters.

data-diff is pyodbc-only, so every MSSQL service - whatever SQLAlchemy scheme it
uses for metadata ingestion - has to resolve to an ODBC driver. Only FreeTDS
negotiates NTLM for a `DOMAIN\\user` login; msodbcsql sends it as a SQL login name
and SQL Server answers 18456. See issue #32582.
"""

import uuid

import pytest

from metadata.data_quality.validations.runtime_param_setter.base_diff_params_setter import (
    BaseTableParameter,
)
from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    ConnectionOptions,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection as MssqlConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlScheme,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.database.mssql.connection import (
    DEFAULT_ODBC_DRIVER,
    FREETDS_ODBC_DRIVER,
    MssqlConnection,
    _odbc_driver_for_data_diff,
)


def _config(scheme: MssqlScheme, **kwargs) -> MssqlConnectionConfig:
    return MssqlConnectionConfig(
        scheme=scheme,
        username="NB\\svcaccount",
        password="secret",
        hostPort="sqlserver.corp.local:1433",
        database="DM_Master",
        **kwargs,
    )


class TestOdbcDriverDerivation:
    """The ODBC driver must be derived from the scheme, not read off `driver`."""

    def test_pymssql_maps_to_freetds(self):
        """pymssql is a FreeTDS binding, so FreeTDS is its ODBC equivalent.

        This is the case that motivated the issue: a domain account authenticates
        under pymssql and must keep authenticating under data-diff.
        """
        assert _odbc_driver_for_data_diff(_config(MssqlScheme.mssql_pymssql)) == FREETDS_ODBC_DRIVER

    def test_pymssql_ignores_the_driver_field(self):
        """`driver` is documented as pyodbc-only and defaults to msodbcsql.

        Forwarding it verbatim would be a no-op for exactly the configuration that
        is broken, so a pymssql service must ignore whatever it holds.
        """
        config = _config(MssqlScheme.mssql_pymssql)
        assert config.driver == DEFAULT_ODBC_DRIVER  # schema default, never set by a pymssql user
        assert _odbc_driver_for_data_diff(config) == FREETDS_ODBC_DRIVER

    def test_pyodbc_honours_the_configured_driver(self):
        config = _config(MssqlScheme.mssql_pyodbc, driver="FreeTDS")
        assert _odbc_driver_for_data_diff(config) == "FreeTDS"

    def test_pyodbc_falls_back_to_the_default_driver(self):
        config = _config(MssqlScheme.mssql_pyodbc)
        config.driver = None
        assert _odbc_driver_for_data_diff(config) == DEFAULT_ODBC_DRIVER

    def test_pytds_keeps_the_default_driver(self):
        """pytds is SQL-auth-only, so msodbcsql matches its capability exactly.

        Routing it to FreeTDS would silently widen what the diff can authenticate
        beyond what metadata ingestion can.
        """
        assert _odbc_driver_for_data_diff(_config(MssqlScheme.mssql_pytds)) == DEFAULT_ODBC_DRIVER


class TestMssqlConnectionDict:
    def test_carries_credentials_and_derived_driver(self):
        connection_dict = MssqlConnection(_config(MssqlScheme.mssql_pymssql)).get_connection_dict()

        assert connection_dict["driver"] == MssqlScheme.mssql_pymssql.value
        assert connection_dict["host"] == "sqlserver.corp.local"
        assert connection_dict["port"] == 1433
        assert connection_dict["database"] == "DM_Master"
        assert connection_dict["odbc_driver"] == FREETDS_ODBC_DRIVER

    def test_username_is_passed_through_verbatim(self):
        """The dict path bypasses URI parsing, so the backslash needs no encoding.

        This is what makes the connection dict strictly better than the rendered
        URL that #31124 / #31134 had to patch.
        """
        connection_dict = MssqlConnection(_config(MssqlScheme.mssql_pymssql)).get_connection_dict()
        assert connection_dict["user"] == "NB\\svcaccount"
        assert connection_dict["password"] == "secret"

    def test_carries_connection_options(self):
        """connectionOptions rode along as URL query params and reached pyodbc.

        The dict path replaces that URL, so it has to carry them too or extra ODBC
        keywords (Encrypt, Authentication, ...) silently stop applying to diffs.
        """
        config = _config(MssqlScheme.mssql_pymssql)
        config.connectionOptions = ConnectionOptions(root={"Encrypt": "no", "Connection Timeout": "60"})

        connection_dict = MssqlConnection(config).get_connection_dict()

        assert connection_dict["Encrypt"] == "no"
        assert connection_dict["Connection Timeout"] == "60"

    def test_connection_options_cannot_override_the_derived_driver(self):
        """The derivation is authoritative - it is what makes domain auth work."""
        config = _config(MssqlScheme.mssql_pymssql)
        config.connectionOptions = ConnectionOptions(root={"odbc_driver": "ODBC Driver 18 for SQL Server"})

        assert MssqlConnection(config).get_connection_dict()["odbc_driver"] == FREETDS_ODBC_DRIVER

    def test_defaults_the_port_when_host_has_none(self):
        config = _config(MssqlScheme.mssql_pytds)
        config.hostPort = "sqlserver.corp.local"
        assert MssqlConnection(config).get_connection_dict()["port"] == 1433

    def test_missing_host_port_fails_with_a_clear_error(self):
        """`hostPort` is optional in the schema, so None is reachable.

        An empty host is worse than no dict: ODBC treats a blank server as the
        local machine, so the diff would connect somewhere unintended instead of
        failing. Rendering a URL instead cannot work either - it dies with a bare
        `TypeError: can only concatenate str (not "NoneType")`. Neither is a
        message anyone can act on, so name the missing field.
        """
        config = _config(MssqlScheme.mssql_pymssql)
        config.hostPort = None

        with pytest.raises(SourceConnectionException, match="hostPort"):
            MssqlConnection(config).get_connection_dict()

    def test_non_numeric_port_fails_with_a_clear_error(self):
        """`int(port)` on a typo'd port would raise ValueError - a swallowed one.

        Defaulting to 1433 instead would be just as quiet, and would connect to a
        port the user never asked for.
        """
        config = _config(MssqlScheme.mssql_pymssql)
        config.hostPort = "sqlserver.corp.local:not-a-port"

        with pytest.raises(SourceConnectionException, match="non-numeric port"):
            MssqlConnection(config).get_connection_dict()

    @pytest.mark.parametrize("host_port", [None, "sqlserver.corp.local:not-a-port"])
    def test_bad_host_port_is_not_swallowed_into_a_url_fallback(self, host_port):
        """BaseTableParameter._get_service_connection_config catches ValueError.

        Raising one here would be silently downgraded to the URL path, losing both
        the message and the derived driver, so go through that method rather than
        `get_connection_dict` directly and prove the error actually surfaces.
        """
        config = _config(MssqlScheme.mssql_pymssql)
        config.hostPort = host_port

        with pytest.raises(SourceConnectionException):
            BaseTableParameter._get_service_connection_config(config)


class TestMssqlTableParameter:
    """data-diff needs the *table's* database and schema, not the service's."""

    @pytest.fixture
    def db_service(self) -> DatabaseService:
        return DatabaseService(
            id=uuid.uuid4(),
            name="mssql_service",
            serviceType=DatabaseServiceType.Mssql,
            connection=DatabaseConnection(config=_config(MssqlScheme.mssql_pymssql)),
        )

    def test_stamps_database_and_schema_without_mutating_the_service_dict(self, db_service, monkeypatch):
        from metadata.ingestion.source.database.mssql.data_diff.data_diff import (
            MssqlTableParameter,
        )

        service_level_dict = {
            "driver": "mssql+pymssql",
            "host": "sqlserver.corp.local",
            "port": 1433,
            "user": "NB\\svcaccount",
            "password": "secret",
            "database": "DM_Master",
            "odbc_driver": FREETDS_ODBC_DRIVER,
        }
        param_setter = MssqlTableParameter()
        monkeypatch.setattr(
            param_setter,
            "_get_service_connection_config",
            lambda *_args, **_kwargs: service_level_dict,
        )

        first = param_setter.get_data_diff_url(db_service, "mssql_service.DM_Master.dbo.DIM_ACCOUNT")
        second = param_setter.get_data_diff_url(db_service, "mssql_service.Other_DB.staging.DIM_ACCOUNT")

        assert first["database"] == "DM_Master"
        assert first["schema"] == "dbo"
        assert second["database"] == "Other_DB"
        assert second["schema"] == "staging"

        # Neither call may leak into the other, or into the service-level dict.
        assert first is not service_level_dict
        assert first is not second
        assert "schema" not in service_level_dict

    def test_preserves_the_derived_driver_and_scheme(self, db_service, monkeypatch):
        """The base setter strips `mssql+pymssql` to the `mssql` data-diff scheme.

        `odbc_driver` must survive that untouched - it is the whole point.
        """
        from metadata.ingestion.source.database.mssql.data_diff.data_diff import (
            MssqlTableParameter,
        )

        param_setter = MssqlTableParameter()
        monkeypatch.setattr(
            param_setter,
            "_get_service_connection_config",
            lambda *_args, **_kwargs: {
                "driver": "mssql+pymssql",
                "host": "sqlserver.corp.local",
                "port": 1433,
                "user": "NB\\svcaccount",
                "database": "DM_Master",
                "odbc_driver": FREETDS_ODBC_DRIVER,
            },
        )

        result = param_setter.get_data_diff_url(db_service, "mssql_service.DM_Master.dbo.DIM_ACCOUNT")

        assert result["driver"] == "mssql"
        assert result["odbc_driver"] == FREETDS_ODBC_DRIVER
        assert result["user"] == "NB\\svcaccount"
