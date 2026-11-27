"""
PyMySQL top-level SSL options combined with sslConfig for the MySQL family
"""

import ssl
from pathlib import Path
from unittest.mock import patch

import pytest
from pymysql.connections import Connection as PyMySQLConnection
from sqlalchemy import create_engine

from metadata.generated.schema.entity.services.connections.database.dorisConnection import (
    DorisConnection,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.starrocksConnection import (
    StarRocksConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.connections.builders import get_connection_args_common
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.doris.metadata import DorisSource
from metadata.ingestion.source.database.starrocks.metadata import StarRocksSource
from metadata.utils.secrets.secrets_manager_factory import SecretsManagerFactory
from metadata.utils.secure_tempfile import remove_secret_temp_file, write_secret_temp_file
from metadata.utils.ssl_manager import check_ssl_and_init

MYSQL_FAMILY = [MysqlConnection, DorisConnection, StarRocksConnection]


@pytest.mark.parametrize("connection_cls", MYSQL_FAMILY)
@pytest.mark.parametrize("use_top_level_client_cert", [False, True])
def test_pymysql_uses_configured_ca_with_top_level_ssl_options(connection_cls, use_top_level_client_cert):
    arguments = {"ssl_verify_cert": True, "ssl_verify_identity": True, "connect_timeout": 5}
    if use_top_level_client_cert:
        arguments.update({"ssl_cert": "client.pem", "ssl_key": "client.key", "ssl_key_password": "password"})
    connection = connection_cls(
        hostPort="localhost:3306",
        username="user",
        sslConfig={"caCertificate": "caCertificateData"},
        connectionArguments=arguments,
    )
    manager = check_ssl_and_init(connection)
    try:
        updated = manager.setup_ssl(connection)
        with (
            patch.object(ssl.SSLContext, "load_verify_locations") as load_ca,
            patch.object(ssl.SSLContext, "load_cert_chain") as load_client,
        ):
            client = PyMySQLConnection(
                host="localhost", user="user", defer_connect=True, **get_connection_args_common(updated)
            )

        load_ca.assert_called_once_with(manager.ca_file_path, None, None)
        assert client.ctx.verify_mode == ssl.CERT_REQUIRED
        assert client.ctx.check_hostname
        assert client.connect_timeout == 5
        if use_top_level_client_cert:
            load_client.assert_called_once_with("client.pem", keyfile="client.key", password="password")
        else:
            load_client.assert_not_called()
    finally:
        manager.cleanup_temp_files()


@pytest.mark.parametrize(
    ("arguments", "verify", "hostname", "override_ca"),
    [
        ({"ssl_verify_cert": False}, True, True, False),
        ({"ssl_verify_cert": True}, True, False, False),
        ({"ssl_verify_cert": "false"}, False, False, False),
        ({"ssl_cert": "client.pem", "ssl_verify_cert": False}, False, False, False),
        ({"ssl_ca": "override.pem", "ssl_verify_cert": True, "ssl_verify_identity": True}, True, True, True),
    ],
)
def test_pymysql_preserves_explicit_ssl_options(arguments, verify, hostname, override_ca):
    connection = MysqlConnection(
        hostPort="localhost:3306",
        username="user",
        sslConfig={"caCertificate": "caCertificateData"},
        connectionArguments=arguments,
    )
    manager = check_ssl_and_init(connection)
    try:
        updated = manager.setup_ssl(connection)
        with (
            patch.object(ssl.SSLContext, "load_verify_locations") as load_ca,
            patch.object(ssl.SSLContext, "load_cert_chain"),
        ):
            client = PyMySQLConnection(
                host="localhost", user="user", defer_connect=True, **get_connection_args_common(updated)
            )
        load_ca.assert_called_once_with("override.pem" if override_ca else manager.ca_file_path, None, None)
        assert client.ctx.verify_mode == (ssl.CERT_REQUIRED if verify else ssl.CERT_NONE)
        assert client.ctx.check_hostname is hostname
    finally:
        manager.cleanup_temp_files()


@pytest.mark.parametrize("connection_cls", MYSQL_FAMILY)
def test_ssl_setup_preserves_overrides_when_input_is_reused(connection_cls):
    arguments = {
        "ssl": {"check_hostname": False},
        "ssl_ca": "override.pem",
        "ssl_cert": "override-cert.pem",
        "ssl_key": "override-key.pem",
    }
    connection = connection_cls(
        hostPort="localhost:3306",
        username="user",
        sslConfig={"caCertificate": "caCertificateData", "sslCertificate": "certData", "sslKey": "keyData"},
        connectionArguments=arguments,
    )
    manager = check_ssl_and_init(connection)
    try:
        first = manager.setup_ssl(connection)
        second = manager.setup_ssl(connection)
        expected = {
            "check_hostname": False,
            "ca": "override.pem",
            "cert": "override-cert.pem",
            "key": "override-key.pem",
        }
        assert first.connectionArguments.root["ssl"] == expected
        assert second.connectionArguments.root["ssl"] == expected
        assert connection.connectionArguments.root == arguments
    finally:
        manager.cleanup_temp_files()


@pytest.mark.parametrize("use_top_level_client_cert", [False, True])
def test_pymysql_resolves_top_level_key_password_before_nesting(use_top_level_client_cert):
    ssl_config = {"caCertificate": "caCertificateData"}
    arguments = {"ssl_key_password": "secret:dbkey"}
    if use_top_level_client_cert:
        arguments.update({"ssl_cert": "client.pem", "ssl_key": "client.key"})
    else:
        ssl_config.update({"sslCertificate": "sslCertificateData", "sslKey": "sslKeyData"})
    connection = MysqlConnection(
        hostPort="localhost:3306",
        username="user",
        sslConfig=ssl_config,
        connectionArguments=arguments,
    )
    manager = check_ssl_and_init(connection)
    try:
        with (
            patch.object(SecretsManagerFactory, "get_secrets_manager") as get_secrets_manager,
            patch.object(ssl.SSLContext, "load_verify_locations"),
            patch.object(ssl.SSLContext, "load_cert_chain") as load_client,
        ):
            get_secrets_manager.return_value.get_string_value.return_value = "resolved-password"
            updated = manager.setup_ssl(connection)
            PyMySQLConnection(host="localhost", user="user", defer_connect=True, **get_connection_args_common(updated))
        load_client.assert_called_once_with(
            "client.pem" if use_top_level_client_cert else manager.cert_file_path,
            keyfile="client.key" if use_top_level_client_cert else manager.key_file_path,
            password="resolved-password",
        )
    finally:
        manager.cleanup_temp_files()


def test_ssl_setup_does_not_resolve_unrelated_connection_secrets_twice():
    connection = MysqlConnection(
        hostPort="localhost:3306",
        username="user",
        sslConfig={"caCertificate": "caCertificateData"},
        connectionArguments={"ssl_verify_cert": True, "init_command": "secret:statement"},
    )
    manager = check_ssl_and_init(connection)
    try:
        with patch.object(SecretsManagerFactory, "get_secrets_manager") as get_secrets_manager:
            get_secrets_manager.return_value.get_string_value.side_effect = {
                "statement": "secret:literal",
                "literal": "wrong value",
            }.get
            updated = manager.setup_ssl(connection)
            assert get_connection_args_common(updated)["init_command"] == "secret:literal"
    finally:
        manager.cleanup_temp_files()


@pytest.mark.parametrize("source_cls", [DorisSource, StarRocksSource])
def test_mysql_family_source_initializes_ssl_once(source_cls):
    connection_type = {DorisSource: "Doris", StarRocksSource: "StarRocks"}[source_cls]
    config = WorkflowSource.model_validate(
        {
            "type": connection_type.lower(),
            "serviceName": "test",
            "serviceConnection": {
                "config": {
                    "type": connection_type,
                    "hostPort": "localhost:3306",
                    "username": "user",
                    "sslConfig": {"caCertificate": "caCertificateData"},
                    "connectionArguments": {"ssl_ca": "override.pem", "ssl_verify_cert": True},
                }
            },
            "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
        }
    )
    created_paths = []

    def create_temp_file(content):
        path = write_secret_temp_file(content)
        created_paths.append(path)
        return path

    source = None
    try:
        with (
            patch("metadata.utils.ssl_manager.write_secret_temp_file", side_effect=create_temp_file),
            patch("metadata.ingestion.source.database.common_db_source.create_connection", return_value=None),
            patch(
                "metadata.ingestion.source.database.common_db_source.get_connection",
                return_value=create_engine("sqlite://"),
            ),
            patch.object(CommonDbSourceService, "test_connection"),
        ):
            source = source_cls(config, None)
        assert len(created_paths) == 1
        assert Path(created_paths[0]).exists()
        with patch.object(ssl.SSLContext, "load_verify_locations") as load_ca:
            client = PyMySQLConnection(
                host="localhost",
                user="user",
                defer_connect=True,
                **get_connection_args_common(source.service_connection),
            )
        load_ca.assert_called_once_with("override.pem", None, None)
        assert client.ctx.verify_mode == ssl.CERT_REQUIRED
        source.close()
        source = None
        assert not Path(created_paths[0]).exists()
    finally:
        if source:
            source.close()
        for path in created_paths:
            remove_secret_temp_file(path)
