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
"""Vertica table-diff connection parameters and data-diff wire integration."""

import json
import logging
import uuid
from unittest.mock import MagicMock, patch

import data_diff
import pytest
from vertica_python.vertica.connection import _AddressList
from vertica_python.vertica.log import VerticaLogging

from metadata.data_quality.validations.models import (
    TableDiffRuntimeParameters,
    TableParameter,
)
from metadata.data_quality.validations.runtime_param_setter.base_diff_params_setter import (
    BaseTableParameter,
    ServiceSpecPatch,
    SupportsConnectionDict,
)
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    ConnectionArguments,
    ConnectionOptions,
)
from metadata.generated.schema.entity.services.connections.database.verticaConnection import (
    VerticaConnection as VerticaConnectionConfig,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.database.vertica.connection import (
    DEFAULT_VERTICA_PORT,
    VerticaConnection,
)
from metadata.ingestion.source.database.vertica.data_diff.data_diff import (
    VerticaTableParameter,
)


def _config(**kwargs) -> VerticaConnectionConfig:
    defaults = {
        "username": "dbadmin",
        "password": "secret",
        "hostPort": "vertica.corp.local:5433",
        "database": "vmart",
    }
    defaults.update(kwargs)
    return VerticaConnectionConfig(**defaults)


class TestVerticaConnectionDict:
    def test_satisfies_supports_connection_dict_protocol(self):
        assert isinstance(VerticaConnection(_config()), SupportsConnectionDict)

    def test_standard_host_and_port(self):
        connection_dict = VerticaConnection(_config()).get_connection_dict()

        assert connection_dict == {
            "driver": "vertica",
            "host": "vertica.corp.local",
            "port": 5433,
            "user": "dbadmin",
            "password": "secret",
            "database": "vmart",
        }
        assert json.dumps(connection_dict)

    def test_defaults_port_when_host_has_no_port(self):
        connection_dict = VerticaConnection(_config(hostPort="vertica.corp.local")).get_connection_dict()

        assert connection_dict["host"] == "vertica.corp.local"
        assert connection_dict["port"] == DEFAULT_VERTICA_PORT

    @pytest.mark.parametrize(
        "host_port, expected_host, expected_port",
        [
            ("[::1]:5433", "::1", 5433),
            ("[::1]", "::1", DEFAULT_VERTICA_PORT),
            ("[2001:db8::1]:5434", "2001:db8::1", 5434),
        ],
    )
    def test_parses_ipv6_host_port(self, host_port: str, expected_host: str, expected_port: int):
        connection_dict = VerticaConnection(_config(hostPort=host_port)).get_connection_dict()

        assert connection_dict["host"] == expected_host
        assert connection_dict["port"] == expected_port

    @pytest.mark.parametrize(
        "bad_host_port",
        [
            None,
            "",
            "   ",
            ":5433",
            "vertica.corp.local:",
            "vertica.corp.local:not-a-port",
            "vertica.corp.local:0",
            "vertica.corp.local:-1",
            "vertica.corp.local:65536",
            "vertica.corp.local:²",
            "[::1",
            "[]:5433",
            "[   ]:5433",
            "[::1 ]:5433",
            "[::1]:",
            "[::1]:99999",
            "[::1]extra",
            "vertica.local :5433",
            "vertica .local",
            "::1",
            "user:topsecret@vertica.corp.local:5433",
        ],
    )
    def test_invalid_host_port_raises_source_connection_exception_without_leaking_secrets(self, bad_host_port):
        config = _config()
        config.hostPort = bad_host_port  # type: ignore[assignment]

        with pytest.raises(SourceConnectionException) as exc_info:
            VerticaConnection(config).get_connection_dict()

        assert "topsecret" not in str(exc_info.value)
        assert "secret" not in str(exc_info.value)

    @pytest.mark.parametrize(
        "bad_host_port",
        [None, "", "vertica.corp.local:not-a-port", "vertica.corp.local:0", "vertica.corp.local:70000"],
    )
    def test_bad_host_port_is_not_swallowed_by_base_table_parameter(self, bad_host_port):
        """BaseTableParameter._get_service_connection_config catches ValueError; SourceConnectionException must propagate."""
        config = _config()
        config.hostPort = bad_host_port  # type: ignore[assignment]

        with pytest.raises(SourceConnectionException):
            BaseTableParameter._get_service_connection_config(config)

    def test_special_characters_in_credentials_preserved_verbatim(self):
        username = "svc:user/a?b#c%d+e@corp f"
        password = "p:a/s?s#w%0+r@d !"
        connection_dict = VerticaConnection(_config(username=username, password=password)).get_connection_dict()

        assert connection_dict["user"] == username
        assert connection_dict["password"] == password

    def test_omits_password_and_database_when_none_and_keeps_oauth_args(self):
        config = _config(
            password=None,
            database=None,
            connectionOptions=ConnectionOptions(
                root={
                    "password": "spoofed_password",
                    "database": "spoofed_db",
                    "dsn": "vertica://evil:spoofed@evil.example:5433/evil_db?ssl=false",
                }
            ),
            connectionArguments=ConnectionArguments(
                root={
                    "oauth_access_token": "eyJhbGciOiJSUzI1NiJ9.token",
                    "kerberos_service_name": "vertica",
                    "password": "spoofed_arg_password",
                    "database": "spoofed_arg_db",
                    "dsn": "vertica://evil2:spoofed2@evil2.example:5433/evil_db2",
                }
            ),
        )

        connection_dict = VerticaConnection(config).get_connection_dict()

        assert "password" not in connection_dict
        assert "database" not in connection_dict
        assert "dsn" not in connection_dict
        assert connection_dict["oauth_access_token"] == "eyJhbGciOiJSUzI1NiJ9.token"
        assert connection_dict["kerberos_service_name"] == "vertica"

    @pytest.mark.parametrize(
        "option_key",
        [
            "ssl",
            "connection_load_balance",
            "use_prepared_statements",
            "disable_copy_local",
            "binary_transfer",
            "request_complex_types",
            "autocommit",
        ],
    )
    @pytest.mark.parametrize(
        "raw_value, expected",
        [
            ("true", True),
            ("TRUE", True),
            ("on", True),
            ("1", True),
            ("false", False),
            ("FALSE", False),
            ("off", False),
            ("0", False),
        ],
    )
    def test_coerces_boolean_connection_options(self, option_key: str, raw_value: str, expected: bool):
        config = _config(connectionOptions=ConnectionOptions(root={option_key: raw_value}))

        connection_dict = VerticaConnection(config).get_connection_dict()

        assert connection_dict[option_key] is expected

    def test_coerces_numeric_connection_options_and_preserves_native_arguments(self):
        config = _config(
            connectionOptions=ConnectionOptions(
                root={
                    "ssl": "true",
                    "connection_load_balance": "false",
                    "connection_timeout": "30.5",
                    "log_level": "20",
                    "tlsmode": "require",
                }
            ),
            connectionArguments=ConnectionArguments(
                root={
                    "backup_server_node": ["node2.corp.local", "node3.corp.local", "::1"],
                    "tlsmode": "verify-full",
                    "tls_cafile": "/etc/ssl/vertica-ca.pem",
                    "tls_certfile": "/etc/ssl/client.crt",
                    "tls_keyfile": "/etc/ssl/client.key",
                }
            ),
        )

        connection_dict = VerticaConnection(config).get_connection_dict()

        assert connection_dict["ssl"] is True
        assert connection_dict["connection_load_balance"] is False
        assert connection_dict["connection_timeout"] == 30.5
        assert isinstance(connection_dict["connection_timeout"], float)
        assert connection_dict["log_level"] == 20
        assert isinstance(connection_dict["log_level"], int)
        assert connection_dict["backup_server_node"] == ["node2.corp.local", "node3.corp.local", "::1"]
        assert connection_dict["tlsmode"] == "verify-full"
        assert connection_dict["tls_cafile"] == "/etc/ssl/vertica-ca.pem"
        assert connection_dict["tls_certfile"] == "/etc/ssl/client.crt"
        assert connection_dict["tls_keyfile"] == "/etc/ssl/client.key"
        assert json.dumps(connection_dict)

    @pytest.mark.parametrize(
        "raw_level, expected_level",
        [
            ("DEBUG", "DEBUG"),
            ("INFO", "INFO"),
            ("warning", "WARNING"),
            ("20", 20),
            (20, 20),
        ],
    )
    def test_accepts_valid_log_levels_for_vertica_logging(self, raw_level: int | str, expected_level: int | str):
        if isinstance(raw_level, str):
            config = _config(connectionOptions=ConnectionOptions(root={"log_level": raw_level}))
        else:
            config = _config(connectionArguments=ConnectionArguments(root={"log_level": raw_level}))

        connection_dict = VerticaConnection(config).get_connection_dict()

        assert connection_dict["log_level"] == expected_level
        VerticaLogging.setup_logging(f"test_vertica_level_{uuid.uuid4()}", "", connection_dict["log_level"])

    def test_preserves_explicit_log_path_none(self):
        config = _config(
            connectionOptions=ConnectionOptions(root={"log_path": "/tmp/vertica.log"}),
            connectionArguments=ConnectionArguments(root={"log_level": 20, "log_path": None}),
        )

        connection_dict = VerticaConnection(config).get_connection_dict()

        assert "log_path" in connection_dict
        assert connection_dict["log_path"] is None
        assert connection_dict["log_level"] == 20
        assert json.loads(json.dumps(connection_dict))["log_path"] is None

    @pytest.mark.parametrize(
        "bad_options",
        [
            {"ssl": "maybe"},
            {"ssl": ""},
            {"connection_load_balance": "yes"},
            {"connection_timeout": "not-a-float"},
            {"connection_timeout": "-5"},
            {"connection_timeout": "nan"},
            {"connection_timeout": "inf"},
            {"log_level": "VERBOSE"},
            {"log_level": "-1"},
        ],
    )
    def test_invalid_typed_option_raises_source_connection_exception(self, bad_options: dict[str, str]):
        config = _config(connectionOptions=ConnectionOptions(root=bad_options))

        with pytest.raises(SourceConnectionException):
            BaseTableParameter._get_service_connection_config(config)

    @pytest.mark.parametrize(
        "bad_args",
        [
            {"ssl": 123},
            {"connection_timeout": True},
            {"connection_timeout": float("inf")},
            {"log_level": True},
            {"log_level": -1},
            {"log_level": "VERBOSE"},
            {"backup_server_node": "node2.corp.local"},
            {"backup_server_node": ["node2.corp.local:5433"]},
            {"backup_server_node": [("node3.corp.local", 5433)]},
            {"backup_server_node": [["node3.corp.local", 5433]]},
            {"backup_server_node": [""]},
            {"backup_server_node": ["node2 .corp.local"]},
            {"backup_server_node": ["[::1]"]},
            {"backup_server_node": [123]},
            {"custom_obj": object()},
        ],
    )
    def test_invalid_argument_values_raise_source_connection_exception_without_leaking_password(
        self, bad_args: dict[str, object]
    ):
        config = _config(
            password="super_secret_password",
            connectionArguments=ConnectionArguments(root=bad_args),
        )

        with pytest.raises(SourceConnectionException) as exc_info:
            VerticaConnection(config).get_connection_dict()

        assert "super_secret_password" not in str(exc_info.value)

    def test_invalid_secret_float_option_does_not_leak_cause_or_secret(self):
        config = _config(
            connectionOptions=ConnectionOptions(root={"connection_timeout": "secret:/vertica/timeout"}),
        )
        mock_manager = MagicMock()
        mock_manager.get_string_value.return_value = "resolved_secret_not_a_float"
        mock_factory = MagicMock()
        mock_factory.get_secrets_manager.return_value = mock_manager

        with (
            patch(
                "metadata.utils.secrets.secrets_manager_factory.SecretsManagerFactory",
                return_value=mock_factory,
            ),
            pytest.raises(SourceConnectionException) as exc_info,
        ):
            VerticaConnection(config).get_connection_dict()

        assert exc_info.value.__cause__ is None
        assert "resolved_secret_not_a_float" not in str(exc_info.value)
        assert "resolved_secret_not_a_float" not in repr(exc_info.value)

    def test_core_keys_cannot_be_spoofed_by_options_or_arguments(self):
        config = _config(
            connectionOptions=ConnectionOptions(
                root={
                    "driver": "postgresql",
                    "host": "evil.example",
                    "port": "9999",
                    "user": "attacker",
                    "password": "wrong",
                    "database": "evil_db",
                    "dsn": "vertica://attacker:wrong@evil.example:9999/evil_db?ssl=false",
                }
            ),
            connectionArguments=ConnectionArguments(
                root={
                    "driver": "mysql",
                    "host": "evil2.example",
                    "port": 1111,
                    "user": "attacker2",
                    "password": "wrong2",
                    "database": "evil_db2",
                    "dsn": "vertica://attacker2:wrong2@evil2.example:1111/evil_db2",
                }
            ),
        )

        connection_dict = VerticaConnection(config).get_connection_dict()

        assert "dsn" not in connection_dict
        assert connection_dict["driver"] == "vertica"
        assert connection_dict["host"] == "vertica.corp.local"
        assert connection_dict["port"] == 5433
        assert connection_dict["user"] == "dbadmin"
        assert connection_dict["password"] == "secret"
        assert connection_dict["database"] == "vmart"

    def test_resolves_secrets_manager_refs_without_mutating_caller_config(self):
        config = _config(
            connectionOptions=ConnectionOptions(root={"tlsmode": "secret:/vertica/tlsmode"}),
            connectionArguments=ConnectionArguments(root={"oauth_access_token": "secret:/vertica/oauth"}),
        )
        secrets_by_id = {
            "/vertica/tlsmode": "verify-full",
            "/vertica/oauth": "resolved-oauth-token",
        }
        mock_manager = MagicMock()
        mock_manager.get_string_value.side_effect = secrets_by_id.__getitem__
        mock_factory = MagicMock()
        mock_factory.get_secrets_manager.return_value = mock_manager

        with patch(
            "metadata.utils.secrets.secrets_manager_factory.SecretsManagerFactory",
            return_value=mock_factory,
        ):
            connection_dict = VerticaConnection(config).get_connection_dict()

        assert connection_dict["tlsmode"] == "verify-full"
        assert connection_dict["oauth_access_token"] == "resolved-oauth-token"
        assert config.connectionOptions is not None
        assert config.connectionArguments is not None
        assert config.connectionOptions.root["tlsmode"] == "secret:/vertica/tlsmode"
        assert config.connectionArguments.root["oauth_access_token"] == "secret:/vertica/oauth"


class TestVerticaTableParameter:
    @pytest.fixture
    def db_service(self) -> DatabaseService:
        return DatabaseService(
            id=uuid.uuid4(),
            name="vertica_service",
            serviceType=DatabaseServiceType.Vertica,
            connection=DatabaseConnection(config=_config(database=None)),
        )

    def test_service_spec_registers_vertica_connection_and_data_diff(self):
        spec_patch = ServiceSpecPatch(ServiceType.Database, "vertica")

        assert spec_patch.get_connection_class() is VerticaConnection
        assert spec_patch.get_data_diff_class() is VerticaTableParameter

    def test_stamps_per_table_database_on_fresh_copy(self, db_service: DatabaseService):
        param_setter = VerticaTableParameter()
        base_config = param_setter.get_service_connection_config(db_service)
        assert isinstance(base_config, dict)
        assert "database" not in base_config

        table1_conf = param_setter.get_data_diff_url(
            db_service, "vertica_service.db_alpha.public.orders", override_url=base_config
        )
        table2_conf = param_setter.get_data_diff_url(
            db_service, "vertica_service.db_beta.analytics.orders", override_url=table1_conf
        )

        assert isinstance(table1_conf, dict)
        assert isinstance(table2_conf, dict)
        assert table1_conf["database"] == "db_alpha"
        assert table2_conf["database"] == "db_beta"
        assert "database" not in base_config
        assert table1_conf is not base_config
        assert table2_conf is not table1_conf

    def test_handles_string_override_url(self, db_service: DatabaseService):
        param_setter = VerticaTableParameter()

        result = param_setter.get_data_diff_url(
            db_service,
            "vertica_service.db_beta.public.orders",
            override_url="vertica+vertica_python://dbadmin:secret@vertica.corp.local:5433/db_alpha",
        )

        assert result == "vertica://dbadmin:secret@vertica.corp.local:5433/db_beta"


class TestVerticaDataDiffWireIntegration:
    def test_data_diff_connect_passes_typed_dict_after_runtime_params_json_round_trip(self):
        config = _config(
            username="svc:user@corp#1",
            password="p@ss/w?rd#1",
            database=None,
            connectionOptions=ConnectionOptions(
                root={
                    "ssl": "true",
                    "connection_load_balance": "false",
                    "connection_timeout": "30",
                    "log_level": "warning",
                }
            ),
            connectionArguments=ConnectionArguments(
                root={
                    "tlsmode": "verify-full",
                    "tls_cafile": "/etc/ssl/vertica-ca.pem",
                    "backup_server_node": ["node2.corp.local", "::1"],
                    "log_path": None,
                }
            ),
        )
        db_service = DatabaseService(
            id=uuid.uuid4(),
            name="vertica_service",
            serviceType=DatabaseServiceType.Vertica,
            connection=DatabaseConnection(config=config),
        )

        conn_dict = VerticaTableParameter().get_data_diff_url(db_service, "vertica_service.analytics_db.public.orders")
        assert isinstance(conn_dict, dict)

        table_param = TableParameter(
            serviceUrl=conn_dict,
            path="public.orders",
            fullyQualifiedName="vertica_service.analytics_db.public.orders",
            columns=[Column(name="id", dataType=DataType.INT)],
            database_service_type=DatabaseServiceType.Vertica,
            privateKey=None,
            passPhrase=None,
            key_columns=["id"],
            extra_columns=[],
        )
        runtime_params = TableDiffRuntimeParameters(
            table1=table_param,
            table2=table_param,
            keyColumns=["id"],
            extraColumns=[],
            whereClause=None,
            table_profile_config=None,
        )
        round_tripped = TableDiffRuntimeParameters.model_validate_json(runtime_params.model_dump_json())
        wire_conf = round_tripped.table1.data_diff_service_url
        assert isinstance(wire_conf, dict)

        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = [(1,)]
        mock_connection = MagicMock()
        mock_connection.cursor.return_value = mock_cursor

        with patch("vertica_python.connect", return_value=mock_connection) as mock_connect:
            db = data_diff.connect(wire_conf, thread_count=2, shared=False)
            try:
                assert db.query("SELECT 1", int) == 1
            finally:
                db.close()

        assert mock_connect.called
        connect_kwargs = mock_connect.call_args.kwargs
        assert "driver" not in connect_kwargs
        assert "dsn" not in connect_kwargs
        assert connect_kwargs["host"] == "vertica.corp.local"
        assert connect_kwargs["port"] == 5433
        assert connect_kwargs["user"] == "svc:user@corp#1"
        assert connect_kwargs["password"] == "p@ss/w?rd#1"
        assert connect_kwargs["database"] == "analytics_db"
        assert connect_kwargs["ssl"] is True
        assert connect_kwargs["connection_load_balance"] is False
        assert connect_kwargs["connection_timeout"] == 30.0
        assert connect_kwargs["log_level"] == "WARNING"
        assert connect_kwargs["log_path"] is None
        assert connect_kwargs["tlsmode"] == "verify-full"
        assert connect_kwargs["tls_cafile"] == "/etc/ssl/vertica-ca.pem"
        assert connect_kwargs["backup_server_node"] == ["node2.corp.local", "::1"]
        assert connect_kwargs["AUTOCOMMIT"] is False

        # Prove vertica-python accepts the post-JSON-round-trip address list and logging config.
        address_list = _AddressList(
            connect_kwargs["host"],
            connect_kwargs["port"],
            connect_kwargs["backup_server_node"],
            logging.getLogger("test_vertica_wire"),
        )
        assert len(address_list.address_deque) == 3
        VerticaLogging.setup_logging(f"test_vertica_wire_{uuid.uuid4()}", "", connect_kwargs["log_level"])

        executed_sql = [call.args[0] for call in mock_cursor.execute.call_args_list]
        assert "SET TIME ZONE TO 'UTC'" in executed_sql
        assert "SELECT 1" in executed_sql
