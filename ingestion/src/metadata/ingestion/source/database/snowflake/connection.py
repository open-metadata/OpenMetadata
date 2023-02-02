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
Source connection handler
"""
from urllib.parse import quote_plus

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from pydantic import SecretStr
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
    init_empty_connection_arguments,
)
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def get_connection_url(connection: SnowflakeConnection) -> str:
    """
    Set the connection URL
    """
    url = f"{connection.scheme.value}://"

    if connection.username:
        url += f"{quote_plus(connection.username)}"
        if not connection.password:
            connection.password = SecretStr("")
        url += (
            f":{quote_plus(connection.password.get_secret_value())}"
            if connection
            else ""
        )
        url += "@"

    url += connection.account
    url += f"/{connection.database}" if connection.database else ""

    options = get_connection_options_dict(connection)
    if options:
        if not connection.database:
            url += "/"
        params = "&".join(
            f"{key}={quote_plus(value)}" for (key, value) in options.items() if value
        )
        url = f"{url}?{params}"
    options = {
        "account": connection.account,
        "warehouse": connection.warehouse,
        "role": connection.role,
    }
    params = "&".join(f"{key}={value}" for (key, value) in options.items() if value)
    if params:
        url = f"{url}?{params}"
    return url


def get_connection(connection: SnowflakeConnection) -> Engine:
    """
    Create connection
    """
    if connection.privateKey:

        snowflake_private_key_passphrase = (
            connection.snowflakePrivatekeyPassphrase.get_secret_value()
            if connection.snowflakePrivatekeyPassphrase
            else ""
        )

        if not snowflake_private_key_passphrase:
            logger.warning(
                "Snowflake Private Key Passphrase not found, replacing it with empty string"
            )
        p_key = serialization.load_pem_private_key(
            bytes(connection.privateKey.get_secret_value(), "utf-8"),
            password=snowflake_private_key_passphrase.encode(),
            backend=default_backend(),
        )
        pkb = p_key.private_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )

        if connection.privateKey:
            if not connection.connectionArguments:
                connection.connectionArguments = init_empty_connection_arguments()
            connection.connectionArguments.__root__["private_key"] = pkb

    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(engine: Engine) -> None:
    """
    Test connection
    """
    test_connection_db_common(engine)
