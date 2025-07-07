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
Module to manage SSL certificates
"""
import os
import tempfile
import traceback
from functools import singledispatch, singledispatchmethod
from ssl import CERT_REQUIRED, SSLContext
from typing import List, Optional, Union, cast

from pydantic import SecretStr

from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    ConnectionOptions,
)
from metadata.generated.schema.entity.services.connections.dashboard.qlikSenseConnection import (
    QlikSenseConnection,
)
from metadata.generated.schema.entity.services.connections.database.cassandraConnection import (
    CassandraConnection,
)
from metadata.generated.schema.entity.services.connections.database.dorisConnection import (
    DorisConnection,
)
from metadata.generated.schema.entity.services.connections.database.greenplumConnection import (
    GreenplumConnection,
)
from metadata.generated.schema.entity.services.connections.database.mongoDBConnection import (
    MongoDBConnection,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftConnection,
)
from metadata.generated.schema.entity.services.connections.database.salesforceConnection import (
    SalesforceConnection,
)
from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
    KafkaConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.matillionConnection import (
    MatillionConnection,
)
from metadata.generated.schema.security.ssl import verifySSLConfig
from metadata.generated.schema.security.ssl.verifySSLConfig import SslMode
from metadata.ingestion.connections.builders import init_empty_connection_arguments
from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.ingestion.source.connections import get_connection
from metadata.utils.logger import utils_logger

logger = utils_logger()


class SSLManager:
    "SSL Manager to manage SSL certificates for service connections"

    def __init__(
        self, ca=None, key=None, cert=None, *args, **kwargs
    ):  # pylint: disable=keyword-arg-before-vararg
        self.temp_files = []
        self.ca_file_path = None
        self.cert_file_path = None
        self.key_file_path = None
        if ca:
            self.ca_file_path = self.create_temp_file(ca)
        if cert:
            self.cert_file_path = self.create_temp_file(cert)
        if key:
            self.key_file_path = self.create_temp_file(key)
        if args:
            for arg in args:
                if arg:
                    setattr(self, f"{arg}", self.create_temp_file(arg))
        if kwargs:
            for dict_key, value in kwargs.items():
                if value:
                    setattr(self, f"{dict_key}", self.create_temp_file(value))

    def create_temp_file(self, content: SecretStr):
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            temp_file.write(content.get_secret_value().encode())
            temp_file.close()
        self.temp_files.append(temp_file.name)
        return temp_file.name

    def cleanup_temp_files(self):
        for temp_file in self.temp_files:
            try:
                os.remove(temp_file)
            except FileNotFoundError:
                pass
        self.temp_files = []

    @singledispatchmethod
    def setup_ssl(self, connection):
        raise NotImplementedError(f"Connection {type(connection)} type not supported")

    @setup_ssl.register(MysqlConnection)
    @setup_ssl.register(DorisConnection)
    def _(self, connection):
        # Use the temporary file paths for SSL configuration
        connection = cast(Union[MysqlConnection, DorisConnection], connection)
        connection.connectionArguments = (
            connection.connectionArguments or init_empty_connection_arguments()
        )
        ssl_args = connection.connectionArguments.root.get("ssl", {})
        if connection.sslConfig.root.caCertificate:
            ssl_args["ssl_ca"] = self.ca_file_path
        if connection.sslConfig.root.sslCertificate:
            ssl_args["ssl_cert"] = self.cert_file_path
        if connection.sslConfig.root.sslKey:
            ssl_args["ssl_key"] = self.key_file_path
        connection.connectionArguments.root["ssl"] = ssl_args
        return connection

    @setup_ssl.register(MatillionConnection)
    def _(self, connection):
        matillion_connection = cast(MatillionConnection, connection)
        if (
            matillion_connection.connection
            and matillion_connection.connection.sslConfig
        ):
            if matillion_connection.connection.sslConfig.root.caCertificate:
                setattr(
                    matillion_connection.connection.sslConfig.root,
                    "caCertificate",
                    self.ca_file_path,
                )
        return connection

    @setup_ssl.register(PostgresConnection)
    @setup_ssl.register(RedshiftConnection)
    @setup_ssl.register(GreenplumConnection)
    def _(self, connection):
        connection = cast(
            Union[PostgresConnection, RedshiftConnection, GreenplumConnection],
            connection,
        )

        if not connection.connectionArguments:
            connection.connectionArguments = init_empty_connection_arguments()
        connection.connectionArguments.root["sslmode"] = connection.sslMode.value
        if connection.sslMode in (
            verifySSLConfig.SslMode.verify_ca,
            verifySSLConfig.SslMode.verify_full,
        ):
            if self.ca_file_path:
                connection.connectionArguments.root["sslrootcert"] = self.ca_file_path
            else:
                raise ValueError(
                    "CA certificate is required for SSL mode verify-ca or verify-full"
                )
        return connection

    @setup_ssl.register(SalesforceConnection)
    def _(self, connection):
        import requests  # pylint: disable=import-outside-toplevel

        connection: SalesforceConnection = cast(SalesforceConnection, connection)
        connection.connectionArguments = (
            connection.connectionArguments or init_empty_connection_arguments()
        )
        session = requests.Session()
        if self.ca_file_path:
            session.verify = self.ca_file_path
        if self.cert_file_path and self.key_file_path:
            session.cert = (self.cert_file_path, self.key_file_path)
        connection.connectionArguments.root = (
            connection.connectionArguments.root or {}
        )  # to satisfy mypy
        connection.connectionArguments.root["session"] = session
        return connection

    @setup_ssl.register(QlikSenseConnection)
    def _(self, connection):
        return {
            "ca_certs": self.ca_file_path,
            "certfile": self.cert_file_path,
            "keyfile": self.key_file_path,
            "check_hostname": connection.validateHostName,
        }

    @setup_ssl.register(MongoDBConnection)
    def _(self, connection: MongoDBConnection):
        connection.connectionOptions = (
            connection.connectionOptions or ConnectionOptions(root={})
        )
        connection.connectionOptions.root.update(
            {
                "tls": "true",
                "tlsCertificateKeyFile": self.key_file_path,
                "tlsCAFile": self.ca_file_path,
            }
        )
        return connection

    @setup_ssl.register(KafkaConnection)
    def _(self, connection) -> KafkaConnection:
        connection = cast(KafkaConnection, connection)
        if connection.consumerConfigSSL:
            connection.consumerConfig = {
                **connection.consumerConfig,
                "ssl.ca.location": getattr(self, "ca_consumer_config", None),
                "ssl.key.location": getattr(self, "key_consumer_config", None),
                "ssl.certificate.location": getattr(self, "cert_consumer_config", None),
            }
        connection.schemaRegistryConfig["ssl.ca.location"] = self.ca_file_path
        connection.schemaRegistryConfig["ssl.key.location"] = self.key_file_path
        connection.schemaRegistryConfig[
            "ssl.certificate.location"
        ] = self.cert_file_path
        return connection

    @setup_ssl.register(CassandraConnection)
    def _(self, connection):
        connection = cast(CassandraConnection, connection)

        ssl_context = None
        if connection.sslMode != SslMode.disable:
            ssl_context = SSLContext()
            ssl_context.load_verify_locations(cafile=self.ca_file_path)
            ssl_context.verify_mode = CERT_REQUIRED
            ssl_context.load_cert_chain(
                certfile=self.cert_file_path, keyfile=self.key_file_path
            )

        connection.connectionArguments = (
            connection.connectionArguments or init_empty_connection_arguments()
        )
        connection.connectionArguments.root["ssl_context"] = ssl_context
        return connection


@singledispatch
def check_ssl_and_init(
    _, *args, **kwargs  # pylint: disable=unused-argument
) -> Optional[Union[SSLManager, List[SSLManager]]]:
    return None


@check_ssl_and_init.register(MatillionConnection)
def _(connection) -> Union[SSLManager, None]:
    service_connection = cast(MatillionConnection, connection)
    if service_connection.connection:
        ssl: Optional[
            verifySSLConfig.SslConfig
        ] = service_connection.connection.sslConfig
        if ssl and ssl.root.caCertificate:
            ssl_dict: dict[str, Union[CustomSecretStr, None]] = {
                "ca": ssl.root.caCertificate
            }
            return SSLManager(**ssl_dict)
    return None


@check_ssl_and_init.register(cls=SalesforceConnection)
def _(connection) -> Union[SSLManager, None]:
    service_connection = cast(SalesforceConnection, connection)
    ssl: Optional[verifySSLConfig.SslConfig] = service_connection.sslConfig
    if ssl and ssl.root.caCertificate:
        ssl_dict: dict[str, Union[CustomSecretStr, None]] = {
            "ca": ssl.root.caCertificate
        }
        if (ssl.root.sslCertificate) and (ssl.root.sslKey):
            ssl_dict["cert"] = ssl.root.sslCertificate
            ssl_dict["key"] = ssl.root.sslKey
        return SSLManager(**ssl_dict)
    return None


@check_ssl_and_init.register(MysqlConnection)
@check_ssl_and_init.register(DorisConnection)
def _(connection):
    service_connection = cast(Union[MysqlConnection, DorisConnection], connection)
    ssl: Optional[verifySSLConfig.SslConfig] = service_connection.sslConfig
    if ssl and (ssl.root.caCertificate or ssl.root.sslCertificate or ssl.root.sslKey):
        return SSLManager(
            ca=ssl.root.caCertificate,
            cert=ssl.root.sslCertificate,
            key=ssl.root.sslKey,
        )
    return None


@check_ssl_and_init.register(MongoDBConnection)
def _(connection):
    service_connection = cast(Union[MysqlConnection, DorisConnection], connection)
    ssl: Optional[verifySSLConfig.SslConfig] = service_connection.sslConfig
    if ssl and ssl.root.sslCertificate:
        raise ValueError(
            "MongoDB connection does not support SSL certificate. Only CA certificate is supported.\n"
            "More information about configuring MongoDB connection can be found at:\n"
            "https://www.mongodb.com/docs/manual/tutorial/configure-ssl-clients/#mongodb-shell"
        )
    if ssl and (ssl.root.caCertificate or ssl.root.sslKey):
        return SSLManager(
            ca=ssl.root.caCertificate,
            key=ssl.root.sslKey,
        )
    return None


@check_ssl_and_init.register(KafkaConnection)
def _(connection, *args, **kwargs):

    service_connection: KafkaConnection = cast(KafkaConnection, connection)
    ssl_consumer_config: Optional[
        verifySSLConfig.SslConfig
    ] = service_connection.consumerConfigSSL
    ssl_schema_registry: Optional[
        verifySSLConfig.SslConfig
    ] = service_connection.schemaRegistrySSL

    ssl_consumer_config_dict = {}

    if ssl_consumer_config:
        ssl_consumer_config_dict = {
            "ca_consumer_config": ssl_consumer_config.root.caCertificate,
            "cert_consumer_config": ssl_consumer_config.root.sslCertificate,
            "key_consumer_config": ssl_consumer_config.root.sslKey,
        }
    ssl_schema_registry_dict = {}

    if ssl_schema_registry:
        ssl_schema_registry_dict = {
            "ca_schema_registry": ssl_schema_registry.root.caCertificate,
            "cert_schema_registry": ssl_schema_registry.root.sslCertificate,
            "key_schema_registry": ssl_schema_registry.root.sslKey,
        }
    if ssl_consumer_config_dict or ssl_schema_registry_dict:
        return SSLManager(**ssl_consumer_config_dict, **ssl_schema_registry_dict)
    return None


@check_ssl_and_init.register(PostgresConnection)
@check_ssl_and_init.register(RedshiftConnection)
@check_ssl_and_init.register(GreenplumConnection)
def _(connection):
    connection = cast(
        Union[PostgresConnection, RedshiftConnection, GreenplumConnection],
        connection,
    )
    if connection.sslMode:
        return SSLManager(
            ca=connection.sslConfig.root.caCertificate if connection.sslConfig else None
        )
    return None


@check_ssl_and_init.register(CassandraConnection)
def _(connection):
    service_connection = cast(CassandraConnection, connection)
    ssl: Optional[verifySSLConfig.SslConfig] = service_connection.sslConfig
    if ssl and (ssl.root.caCertificate or ssl.root.sslCertificate or ssl.root.sslKey):
        return SSLManager(
            ca=ssl.root.caCertificate, cert=ssl.root.sslCertificate, key=ssl.root.sslKey
        )
    return None


def get_ssl_connection(service_config):
    try:
        # To be cleaned up as part of https://github.com/open-metadata/OpenMetadata/issues/15913
        ssl_manager: SSLManager = check_ssl_and_init(service_config)
        if ssl_manager:
            service_config = ssl_manager.setup_ssl(service_config)
    except Exception:
        logger.debug("Failed to setup SSL for the connection")
        logger.debug(traceback.format_exc())
    return get_connection(service_config)
