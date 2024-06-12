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


"""
Module to manage SSL certificates
"""
import os
import tempfile
import traceback
from functools import singledispatch, singledispatchmethod
from typing import Optional, Union, cast

from pydantic import SecretStr

from metadata.generated.schema.entity.services.connections.dashboard.qlikSenseConnection import (
    QlikSenseConnection,
)
from metadata.generated.schema.entity.services.connections.database.dorisConnection import (
    DorisConnection,
)
from metadata.generated.schema.entity.services.connections.database.greenplumConnection import (
    GreenplumConnection,
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
from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
    KafkaConnection,
)
from metadata.generated.schema.security.ssl import verifySSLConfig
from metadata.ingestion.connections.builders import init_empty_connection_arguments
from metadata.ingestion.source.connections import get_connection
from metadata.utils.logger import utils_logger

logger = utils_logger()


class SSLManager:
    "SSL Manager to manage SSL certificates for service connections"

    def __init__(self, ca=None, key=None, cert=None):
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
        ssl_args = connection.connectionArguments.__root__.get("ssl", {})
        if connection.sslConfig.__root__.caCertificate:
            ssl_args["ssl_ca"] = self.ca_file_path
        if connection.sslConfig.__root__.sslCertificate:
            ssl_args["ssl_cert"] = self.cert_file_path
        if connection.sslConfig.__root__.sslKey:
            ssl_args["ssl_key"] = self.key_file_path
        connection.connectionArguments.__root__["ssl"] = ssl_args
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
        connection.connectionArguments.__root__["sslmode"] = connection.sslMode.value
        if connection.sslMode in (
            verifySSLConfig.SslMode.verify_ca,
            verifySSLConfig.SslMode.verify_full,
        ):
            if self.ca_file_path:
                connection.connectionArguments.__root__[
                    "sslrootcert"
                ] = self.ca_file_path
            else:
                raise ValueError(
                    "CA certificate is required for SSL mode verify-ca or verify-full"
                )
        return connection

    @setup_ssl.register(QlikSenseConnection)
    def _(self, connection):
        return {
            "ca_certs": self.ca_file_path,
            "certfile": self.cert_file_path,
            "keyfile": self.key_file_path,
            "check_hostname": connection.validateHostName,
        }

    @setup_ssl.register(KafkaConnection)
    def _(self, connection):
        connection = cast(KafkaConnection, connection)
        connection.schemaRegistryConfig["ssl.ca.location"] = self.ca_file_path
        connection.schemaRegistryConfig["ssl.key.location"] = self.key_file_path
        connection.schemaRegistryConfig[
            "ssl.certificate.location"
        ] = self.cert_file_path
        return connection


@singledispatch
def check_ssl_and_init(_):
    return None


@check_ssl_and_init.register(MysqlConnection)
@check_ssl_and_init.register(DorisConnection)
def _(connection):
    service_connection = cast(Union[MysqlConnection, DorisConnection], connection)
    ssl: Optional[verifySSLConfig.SslConfig] = service_connection.sslConfig
    if ssl and (
        ssl.__root__.caCertificate or ssl.__root__.sslCertificate or ssl.__root__.sslKey
    ):
        return SSLManager(
            ca=ssl.__root__.caCertificate,
            cert=ssl.__root__.sslCertificate,
            key=ssl.__root__.sslKey,
        )
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
            ca=connection.sslConfig.__root__.caCertificate
            if connection.sslConfig
            else None
        )
    return None


def get_ssl_connection(service_config):
    try:
        ssl_manager: SSLManager = check_ssl_and_init(service_config)
        if ssl_manager:
            service_config = ssl_manager.setup_ssl(service_config)
    except Exception:
        logger.debug("Failed to setup SSL for the connection")
        logger.debug(traceback.format_exc())
    return get_connection(service_config)
