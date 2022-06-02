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
import json
import logging
import traceback
from functools import singledispatch
from typing import Union

import requests
from sqlalchemy import create_engine, func
from sqlalchemy.engine.base import Engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm.session import Session

from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    ConnectionArguments,
    ConnectionOptions,
)
from metadata.generated.schema.entity.services.connections.dashboard.metabaseConnection import (
    MetabaseConnection,
)
from metadata.generated.schema.entity.services.connections.dashboard.redashConnection import (
    RedashConnection,
)
from metadata.generated.schema.entity.services.connections.dashboard.supersetConnection import (
    SupersetConnection,
)
from metadata.generated.schema.entity.services.connections.dashboard.tableauConnection import (
    TableauConnection,
)
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.entity.services.connections.database.clickhouseConnection import (
    ClickhouseConnection,
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
from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
    KafkaConnection,
)
from metadata.orm_profiler.orm.functions.conn_test import ConnTestFn
from metadata.utils.connection_clients import (
    DeltaLakeClient,
    DynamoClient,
    GlueClient,
    KafkaClient,
    MetabaseClient,
    RedashClient,
    SalesforceClient,
    SupersetClient,
    TableauClient,
)
from metadata.utils.credentials import set_google_credentials
from metadata.utils.source_connections import get_connection_args, get_connection_url
from metadata.utils.timeout import timeout

logger = logging.getLogger("Utils")


class SourceConnectionException(Exception):
    """
    Raised when we cannot connect to the source
    """


def create_generic_connection(connection, verbose: bool = False) -> Engine:
    """
    Generic Engine creation from connection object
    :param connection: JSON Schema connection model
    :param verbose: debugger or not
    :return: SQAlchemy Engine
    """
    options = connection.connectionOptions or ConnectionOptions()

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
) -> Union[Engine, DynamoClient, GlueClient, SalesforceClient, KafkaClient]:
    """
    Given an SQL configuration, build the SQLAlchemy Engine
    """
    return create_generic_connection(connection, verbose)


@get_connection.register
def _(connection: ClickhouseConnection, verbose: bool = False):
    engine = create_engine(
        get_connection_url(connection),
        connect_args=get_connection_args(connection),
        echo=verbose,
    )

    return engine


@get_connection.register
def _(connection: DatabricksConnection, verbose: bool = False):
    if connection.httpPath:
        if not connection.connectionArguments:
            connection.connectionArguments = ConnectionArguments()
        connection.connectionArguments.http_path = connection.httpPath
    return create_generic_connection(connection, verbose)


@get_connection.register
def _(connection: SnowflakeConnection, verbose: bool = False) -> Engine:
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
def _(connection: BigQueryConnection, verbose: bool = False) -> Engine:
    """
    Prepare the engine and the GCS credentials
    :param connection: BigQuery connection
    :param verbose: debugger or not
    :return: Engine
    """
    set_google_credentials(gcs_credentials=connection.credentials)
    return create_generic_connection(connection, verbose)


@get_connection.register
def _(connection: DynamoDBConnection, verbose: bool = False) -> DynamoClient:
    from metadata.utils.aws_client import AWSClient

    dynomo_connection = AWSClient(connection.awsConfig).get_dynomo_client()
    return dynomo_connection


@get_connection.register
def _(connection: GlueConnection, verbose: bool = False) -> GlueClient:
    from metadata.utils.aws_client import AWSClient

    glue_connection = AWSClient(connection.awsConfig).get_glue_client()
    return glue_connection


@get_connection.register
def _(connection: SalesforceConnection, verbose: bool = False) -> SalesforceClient:
    from simple_salesforce import Salesforce

    salesforce_connection = SalesforceClient(
        Salesforce(
            connection.username,
            password=connection.password.get_secret_value(),
            security_token=connection.securityToken,
        )
    )
    return salesforce_connection


@get_connection.register
def _(connection: DeltaLakeConnection, verbose: bool = False) -> DeltaLakeClient:
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


@get_connection.register
def _(connection: KafkaConnection, verbose: bool = False) -> KafkaClient:
    """
    Prepare Kafka Admin Client and Schema Registry Client
    """
    from confluent_kafka.admin import AdminClient, ConfigResource
    from confluent_kafka.avro import AvroConsumer
    from confluent_kafka.schema_registry.schema_registry_client import (
        Schema,
        SchemaRegistryClient,
    )

    admin_client_config = connection.consumerConfig
    admin_client_config["bootstrap.servers"] = connection.bootstrapServers
    admin_client = AdminClient(admin_client_config)

    schema_registry_client = None
    consumer_client = None
    if connection.schemaRegistryURL:
        connection.schemaRegistryConfig["url"] = connection.schemaRegistryURL
        schema_registry_client = SchemaRegistryClient(connection.schemaRegistryConfig)
        admin_client_config["schema.registry.url"] = connection.schemaRegistryURL
        admin_client_config["group.id"] = "openmetadata-consumer-1"
        admin_client_config["auto.offset.reset"] = "earliest"
        admin_client_config["enable.auto.commit"] = False
        consumer_client = AvroConsumer(admin_client_config)

    return KafkaClient(
        admin_client=admin_client,
        schema_registry_client=schema_registry_client,
        consumer_client=consumer_client,
    )


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
def test_connection(connection) -> None:
    """
    Default implementation is the engine to test.

    Test that we can connect to the source using the given engine
    :param connection: Engine to test
    :return: None or raise an exception if we cannot connect
    """
    try:
        with connection.connect() as conn:
            conn.execute(ConnTestFn())
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


@test_connection.register
def _(connection: KafkaClient) -> None:
    """
    Test AdminClient.

    If exists, test the Schema Registry client as well.
    """
    try:
        _ = connection.admin_client.list_topics().topics
        if connection.schema_registry_client:
            _ = connection.schema_registry_client.get_subjects()
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


@get_connection.register
def _(connection: MetabaseConnection, verbose: bool = False):
    try:
        params = dict()
        params["username"] = connection.username
        params["password"] = connection.password.get_secret_value()

        HEADERS = {"Content-Type": "application/json", "Accept": "*/*"}

        resp = requests.post(
            connection.hostPort + "/api/session/",
            data=json.dumps(params),
            headers=HEADERS,
        )

        session_id = resp.json()["id"]
        metabase_session = {"X-Metabase-Session": session_id}
        conn = {"connection": connection, "metabase_session": metabase_session}
        return MetabaseClient(conn)

    except Exception as err:
        logger.error(f"Failed to connect with error :  {err}")
        logger.debug(traceback.format_exc())


@test_connection.register
def _(connection: MetabaseClient) -> None:
    try:
        requests.get(
            connection.client["connection"].hostPort + "/api/dashboard",
            headers=connection.client["metabase_session"],
        )
    except Exception as err:
        raise SourceConnectionException(
            f"Unknown error connecting with {connection} - {err}."
        )


@get_connection.register
def _(connection: RedashConnection, verbose: bool = False):

    from redash_toolbelt import Redash

    try:
        redash = Redash(connection.hostPort, connection.apiKey)
        redash_client = RedashClient(redash)
        return redash_client

    except Exception as err:
        logger.error(f"Failed to connect with error :  {err}")
        logger.error(err)


@test_connection.register
def _(connection: RedashClient) -> None:
    try:
        connection.client.dashboards()
    except Exception as err:
        raise SourceConnectionException(
            f"Unknown error connecting with {connection} - {err}."
        )


@get_connection.register
def _(connection: SupersetConnection, verbose: bool = False):
    from metadata.ingestion.ometa.superset_rest import SupersetAPIClient

    superset_connection = SupersetAPIClient(connection)
    superset_client = SupersetClient(superset_connection)
    return superset_client


@test_connection.register
def _(connection: SupersetClient) -> None:
    try:
        connection.client.fetch_menu()
    except Exception as err:
        raise SourceConnectionException(
            f"Unknown error connecting with {connection} - {err}."
        )


@get_connection.register
def _(connection: TableauConnection, verbose: bool = False):

    from tableau_api_lib import TableauServerConnection

    tableau_server_config = {
        f"{connection.env}": {
            "server": connection.hostPort,
            "api_version": connection.apiVersion,
            "site_name": connection.siteName,
            "site_url": connection.siteName,
        }
    }
    if connection.username and connection.password:
        tableau_server_config[connection.env]["username"] = connection.username
        tableau_server_config[connection.env][
            "password"
        ] = connection.password.get_secret_value()
    elif connection.personalAccessTokenName and connection.personalAccessTokenSecret:
        tableau_server_config[connection.env][
            "personal_access_token_name"
        ] = connection.personalAccessTokenName
        tableau_server_config[connection.env][
            "personal_access_token_secret"
        ] = connection.personalAccessTokenSecret
    try:
        conn = TableauServerConnection(
            config_json=tableau_server_config,
            env=connection.env,
        )
        conn.sign_in().json()
        return TableauClient(conn)
    except Exception as err:  # pylint: disable=broad-except
        logger.error("%s: %s", repr(err), err)


@test_connection.register
def _(connection: TableauClient) -> None:
    from tableau_api_lib.utils.querying import get_workbooks_dataframe

    try:
        connection.client.server_info()

    except Exception as err:
        raise SourceConnectionException(
            f"Unknown error connecting with {connection} - {err}."
        )
