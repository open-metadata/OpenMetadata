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
Build and document all supported Engines
"""
import logging
from functools import singledispatch
from typing import Union

from sqlalchemy import create_engine
from sqlalchemy.engine.base import Engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm.session import Session

from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    ConnectionOptions,
)
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.generated.schema.entity.services.connections.database.deltaLakeConnection import (
    DeltaLakeConnection,
)
from metadata.generated.schema.entity.services.connections.database.dynamoDBConnection import (
    DynamoDBConnection,
)
from metadata.generated.schema.entity.services.connections.database.glueConnection import (
    GlueConnection,
)
from metadata.generated.schema.entity.services.connections.database.salesforceConnection import (
    SalesforceConnection,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.utils.connection_clients import (
    DeltaLakeClient,
    DynamoClient,
    GlueClient,
    KafkaClient,
    SalesforceClient,
)
from metadata.utils.credentials import set_google_credentials
from metadata.utils.source_connections import get_connection_args, get_connection_url
from metadata.utils.timeout import timeout

logger = logging.getLogger("Utils")


class SourceConnectionException(Exception):
    """
    Raised when we cannot connect to the source
    """


def create_generic_connection(connection, verbose: bool = False):
    """
    Generic Engine creation from connection object
    :param connection: JSON Schema connection model
    :param verbose: debugger or not
    :return: SQAlchemy Engine
    """
    options = connection.connectionOptions
    if not options:
        options = ConnectionOptions()

    engine = create_engine(
        get_connection_url(connection),
        **options.dict(),
        connect_args=get_connection_args(connection),
        echo=verbose,
    )

    return engine


@singledispatch
def get_connection(
    connection, verbose: bool = False
) -> Union[Engine, DynamoClient, GlueClient, SalesforceClient]:
    """
    Given an SQL configuration, build the SQLAlchemy Engine
    """
    return create_generic_connection(connection, verbose)


@get_connection.register
def _(connection: DatabricksConnection, verbose: bool = False):
    args = connection.connectionArguments
    if not args:
        connection.connectionArguments = dict()
        connection.connectionArguments["http_path"] = connection.httpPath
    return create_generic_connection(connection, verbose)


@get_connection.register
def _(connection: SnowflakeConnection, verbose: bool = False):
    if connection.privateKey:

        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives import serialization

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
            bytes(connection.privateKey, "utf-8"),
            password=snowflake_private_key_passphrase.encode(),
            backend=default_backend(),
        )
        pkb = p_key.private_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )

        if connection.privateKey:
            connection.connectionArguments = dict()
            connection.connectionArguments["private_key"] = pkb

    return create_generic_connection(connection, verbose)


@get_connection.register
def _(connection: BigQueryConnection, verbose: bool = False):
    """
    Prepare the engine and the GCS credentials
    :param connection: BigQuery connection
    :param verbose: debugger or not
    :return: Engine
    """
    set_google_credentials(gcs_credentials=connection.credentials)
    return create_generic_connection(connection, verbose)


@get_connection.register
def _(connection: DynamoDBConnection, verbose: bool = False):
    from metadata.utils.aws_client import AWSClient

    dynomo_connection = AWSClient(connection.awsConfig).get_dynomo_client()
    return dynomo_connection


@get_connection.register
def _(connection: GlueConnection, verbose: bool = False):
    from metadata.utils.aws_client import AWSClient

    glue_connection = AWSClient(connection.awsConfig).get_glue_client()
    return glue_connection


@get_connection.register
def _(connection: SalesforceConnection, verbose: bool = False):
    from simple_salesforce import Salesforce

    salesforce_connection = SalesforceClient(
        Salesforce(
            connection.username,
            password=connection.password.get_secret_value(),
            security_token=connection.securityToken,
        )
    )
    return salesforce_connection


def create_and_bind_session(engine: Engine) -> Session:
    """
    Given an engine, create a session bound
    to it to make our operations.
    """
    session = sessionmaker()
    session.configure(bind=engine)
    return session()


@timeout(seconds=120)
@singledispatch
def test_connection(connection: Engine) -> None:
    """
    Test that we can connect to the source using the given engine
    :param engine: Engine to test
    :return: None or raise an exception if we cannot connect
    """
    try:
        with connection.connect() as _:
            pass
    except OperationalError as err:
        raise SourceConnectionException(
            f"Connection error for {connection} - {err}. Check the connection details."
        )
    except Exception as err:
        raise SourceConnectionException(
            f"Unknown error connecting with {connection} - {err}."
        )


@test_connection.register
def _(connection: DynamoClient) -> None:
    """
    Test that we can connect to the source using the given aws resource
    :param engine: boto service resource to test
    :return: None or raise an exception if we cannot connect
    """
    from botocore.client import ClientError

    try:
        connection.client.tables.all()
    except ClientError as err:
        raise SourceConnectionException(
            f"Connection error for {connection} - {err}. Check the connection details."
        )
    except Exception as err:
        raise SourceConnectionException(
            f"Unknown error connecting with {connection} - {err}."
        )


@test_connection.register
def _(connection: GlueClient) -> None:
    """
    Test that we can connect to the source using the given aws resource
    :param engine: boto cliet to test
    :return: None or raise an exception if we cannot connect
    """
    from botocore.client import ClientError

    try:
        connection.client.list_workflows()
    except ClientError as err:
        raise SourceConnectionException(
            f"Connection error for {connection} - {err}. Check the connection details."
        )
    except Exception as err:
        raise SourceConnectionException(
            f"Unknown error connecting with {connection} - {err}."
        )


@test_connection.register
def _(connection: SalesforceClient) -> None:
    from simple_salesforce.exceptions import SalesforceAuthenticationFailed

    try:
        connection.client.describe()
    except SalesforceAuthenticationFailed as err:
        raise SourceConnectionException(
            f"Connection error for {connection} - {err}. Check the connection details."
        )
    except Exception as err:
        raise SourceConnectionException(
            f"Unknown error connecting with {connection} - {err}."
        )


@get_connection.register
def _(connection: DeltaLakeConnection, verbose: bool = False):
    import pyspark
    from delta import configure_spark_with_delta_pip

    builder = (
        pyspark.sql.SparkSession.builder.appName(connection.appName)
        .enableHiveSupport()
        .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
        .config(
            "spark.sql.catalog.spark_catalog",
            "org.apache.spark.sql.delta.catalog.DeltaCatalog",
        )
    )
    if connection.metastoreHostPort:
        builder.config(
            "hive.metastore.uris",
            f"thrift://{connection.metastoreHostPort}",
        )
    elif connection.metastoreFilePath:
        builder.config("spark.sql.warehouse.dir", f"{connection.metastoreFilePath}")

    deltalake_connection = DeltaLakeClient(
        configure_spark_with_delta_pip(builder).getOrCreate()
    )
    return deltalake_connection


@test_connection.register
def _(connection: KafkaClient) -> None:
    from confluent_kafka.admin import AdminClient

    try:
        if isinstance(connection.client, AdminClient):
            return connection.client.list_topics().topics
        else:
            return connection.client.get_subjects()
    except Exception as err:
        raise SourceConnectionException(
            f"Unknown error connecting with {connection} - {err}."
        )


@test_connection.register
def _(connection: DeltaLakeClient) -> None:
    try:
        connection.client.catalog.listDatabases()
    except Exception as err:
        raise SourceConnectionException(
            f"Unknown error connecting with {connection} - {err}."
        )
