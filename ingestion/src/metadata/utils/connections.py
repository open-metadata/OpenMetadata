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
import os
import traceback
from distutils.command.config import config
from functools import singledispatch
from typing import Union

import pkg_resources
import requests
from sqlalchemy import create_engine
from sqlalchemy.engine.base import Engine
from sqlalchemy.event import listen
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm.session import Session

from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    ConnectionArguments,
)
from metadata.generated.schema.entity.services.connections.dashboard.lookerConnection import (
    LookerConnection,
)
from metadata.generated.schema.entity.services.connections.dashboard.metabaseConnection import (
    MetabaseConnection,
)
from metadata.generated.schema.entity.services.connections.dashboard.modeConnection import (
    ModeConnection,
)
from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    PowerBIConnection,
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
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
    GCSConfig,
    S3Config,
)
from metadata.generated.schema.entity.services.connections.database.deltaLakeConnection import (
    DeltaLakeConnection,
)
from metadata.generated.schema.entity.services.connections.database.dynamoDBConnection import (
    DynamoDBConnection,
)
from metadata.generated.schema.entity.services.connections.database.glueConnection import (
    GlueConnection as GlueDBConnection,
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
from metadata.generated.schema.entity.services.connections.mlmodel.mlflowConnection import (
    MlflowConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.airbyteConnection import (
    AirbyteConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.airflowConnection import (
    AirflowConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.backendConnection import (
    BackendConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.glueConnection import (
    GlueConnection as GluePipelineConnection,
)
from metadata.orm_profiler.orm.functions.conn_test import ConnTestFn
from metadata.utils.connection_clients import (
    AirByteClient,
    DatalakeClient,
    DeltaLakeClient,
    DynamoClient,
    GlueDBClient,
    GluePipelineClient,
    KafkaClient,
    LookerClient,
    MetabaseClient,
    MlflowClientWrapper,
    ModeClient,
    PowerBiClient,
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


def render_query_header(ometa_version: str) -> str:
    header_obj = {"app": "OpenMetadata", "version": ometa_version}
    return f"/* {json.dumps(header_obj)} */"


def inject_query_header(conn, cursor, statement, parameters, context, executemany):
    version = pkg_resources.require("openmetadata-ingestion")[0].version
    statement_with_header = render_query_header(version) + "\n" + statement
    return statement_with_header, parameters


def create_generic_connection(connection, verbose: bool = False) -> Engine:
    """
    Generic Engine creation from connection object
    :param connection: JSON Schema connection model
    :param verbose: debugger or not
    :return: SQAlchemy Engine
    """

    engine = create_engine(
        get_connection_url(connection),
        connect_args=get_connection_args(connection),
        pool_reset_on_return=None,  # https://docs.sqlalchemy.org/en/14/core/pooling.html#reset-on-return
        echo=verbose,
    )
    listen(engine, "before_cursor_execute", inject_query_header, retval=True)

    return engine


@singledispatch
def get_connection(
    connection, verbose: bool = False
) -> Union[
    Engine,
    DynamoClient,
    GlueDBClient,
    GluePipelineClient,
    SalesforceClient,
    KafkaClient,
]:
    """
    Given an SQL configuration, build the SQLAlchemy Engine
    """
    return create_generic_connection(connection, verbose)


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
def _(connection: GlueDBConnection, verbose: bool = False) -> GlueDBClient:
    from metadata.utils.aws_client import AWSClient

    glue_connection = AWSClient(connection.awsConfig).get_glue_db_client()
    return glue_connection


@get_connection.register
def _(
    connection: GluePipelineConnection, verbose: bool = False
) -> GluePipelineConnection:
    from metadata.utils.aws_client import AWSClient

    glue_connection = AWSClient(connection.awsConfig).get_glue_pipeline_client()
    return glue_connection


@get_connection.register
def _(connection: SalesforceConnection, verbose: bool = False) -> SalesforceClient:
    from simple_salesforce import Salesforce

    salesforce_connection = SalesforceClient(
        Salesforce(
            connection.username,
            password=connection.password.get_secret_value(),
            security_token=connection.securityToken.get_secret_value(),
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

    if connection.connectionArguments:
        for key, value in connection.connectionArguments:
            builder.config(key, value)

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
        connection.schemaRegistryConfig["url"] = str(connection.schemaRegistryURL)
        consumer_config = {
            **connection.consumerConfig,
            "bootstrap.servers": connection.bootstrapServers,
        }
        if "group.id" not in consumer_config:
            consumer_config["group.id"] = "openmetadata-consumer"
        if "auto.offset.reset" not in consumer_config:
            consumer_config["auto.offset.reset"] = "earliest"

        for key in connection.schemaRegistryConfig:
            consumer_config["schema.registry." + key] = connection.schemaRegistryConfig[
                key
            ]
        logger.debug(consumer_config)
        consumer_client = AvroConsumer(consumer_config)

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
def _(connection: GlueDBClient) -> None:
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
def _(connection: GluePipelineClient) -> None:
    """
    Test that we can connect to the source using the given aws resource
    :param engine: boto cliet to test
    :return: None or raise an exception if we cannot connect
    """
    from botocore.client import ClientError

    try:
        connection.client.get_paginator("get_databases")
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


@test_connection.register
def _(connection: AirflowConnection) -> None:
    try:
        test_connection(connection.connection)
    except Exception as err:
        raise SourceConnectionException(
            f"Unknown error connecting with {connection} - {err}."
        )


@get_connection.register
def _(connection: AirflowConnection) -> None:
    try:
        return get_connection(connection.connection)
    except Exception as err:
        raise SourceConnectionException(
            f"Unknown error connecting with {connection} - {err}."
        )


@get_connection.register
def _(connection: AirbyteConnection, verbose: bool = False):
    from metadata.utils.airbyte_client import AirbyteClient

    return AirByteClient(AirbyteClient(connection))


@test_connection.register
def _(connection: AirByteClient) -> None:
    try:
        connection.client.list_workspaces()
    except Exception as err:
        raise SourceConnectionException(
            f"Unknown error connecting with {connection} - {err}."
        )


@get_connection.register
def _(connection: RedashConnection, verbose: bool = False):

    from redash_toolbelt import Redash

    try:
        redash = Redash(connection.hostPort, connection.apiKey.get_secret_value())
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
            "site_name": connection.siteName if connection.siteName else "",
            "site_url": connection.siteUrl if connection.siteUrl else "",
        }
    }
    if connection.username and connection.password:
        tableau_server_config[connection.env]["username"] = connection.username
        tableau_server_config[connection.env][
            "password"
        ] = connection.password.get_secret_value()
    elif (
        connection.personalAccessTokenName
        and connection.personalAccessTokenSecret.get_secret_value()
    ):
        tableau_server_config[connection.env][
            "personal_access_token_name"
        ] = connection.personalAccessTokenName
        tableau_server_config[connection.env][
            "personal_access_token_secret"
        ] = connection.personalAccessTokenSecret.get_secret_value()
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


@get_connection.register
def _(connection: PowerBIConnection, verbose: bool = False):
    from metadata.utils.powerbi_client import PowerBiApiClient

    return PowerBiClient(PowerBiApiClient(connection))


@test_connection.register
def _(connection: PowerBiClient) -> None:
    try:
        connection.client.fetch_dashboards()
    except Exception as err:
        raise SourceConnectionException(
            f"Unknown error connecting with {connection} - {err}."
        )


@get_connection.register
def _(connection: LookerConnection, verbose: bool = False):
    import looker_sdk

    if not os.environ.get("LOOKERSDK_CLIENT_ID"):
        os.environ["LOOKERSDK_CLIENT_ID"] = connection.username
    if not os.environ.get("LOOKERSDK_CLIENT_SECRET"):
        os.environ["LOOKERSDK_CLIENT_SECRET"] = connection.password.get_secret_value()
    if not os.environ.get("LOOKERSDK_BASE_URL"):
        os.environ["LOOKERSDK_BASE_URL"] = connection.hostPort
    client = looker_sdk.init40()
    return LookerClient(client=client)


@test_connection.register
def _(connection: LookerClient) -> None:
    try:
        connection.client.me()
    except Exception as err:
        raise SourceConnectionException(
            f"Unknown error connecting with {connection} - {err}."
        )


@test_connection.register
def _(connection: DatalakeClient) -> None:
    """
    Test that we can connect to the source using the given aws resource
    :param engine: boto service resource to test
    :return: None or raise an exception if we cannot connect
    """
    from botocore.client import ClientError

    try:
        config = connection.config.configSource
        if isinstance(config, GCSConfig):
            if connection.config.bucketName:
                connection.client.get_bucket(connection.config.bucketName)
            else:
                connection.client.list_buckets()

        if isinstance(config, S3Config):
            if connection.config.bucketName:
                connection.client.list_objects(Bucket=connection.config.bucketName)
            else:
                connection.client.list_buckets()

    except ClientError as err:
        raise SourceConnectionException(
            f"Connection error for {connection} - {err}. Check the connection details."
        )


@singledispatch
def get_datalake_client(config):
    if config:
        raise NotImplementedError(
            f"Config not implemented for type {type(config)}: {config}"
        )


@get_connection.register
def _(connection: DatalakeConnection, verbose: bool = False) -> DatalakeClient:
    datalake_connection = get_datalake_client(connection.configSource)
    return DatalakeClient(client=datalake_connection, config=connection)


@get_datalake_client.register
def _(config: S3Config):
    from metadata.utils.aws_client import AWSClient

    s3_client = AWSClient(config.securityConfig).get_client(service_name="s3")
    return s3_client


@get_datalake_client.register
def _(config: GCSConfig):
    from google.cloud import storage

    set_google_credentials(gcs_credentials=config.securityConfig)
    gcs_client = storage.Client()
    return gcs_client


@get_connection.register
def _(connection: ModeConnection, verbose: bool = False):
    from metadata.utils.mode_client import ModeApiClient

    return ModeClient(ModeApiClient(connection))


@test_connection.register
def _(connection: ModeClient) -> None:
    try:
        connection.client.get_user_account()
    except Exception as err:
        raise SourceConnectionException(
            f"Unknown error connecting with {connection} - {err}."
        )


@get_connection.register
def _(connection: MlflowConnection, verbose: bool = False):
    from mlflow.tracking import MlflowClient

    return MlflowClientWrapper(
        MlflowClient(
            tracking_uri=connection.trackingUri,
            registry_uri=connection.registryUri,
        )
    )


@test_connection.register
def _(connection: MlflowClientWrapper) -> None:
    try:
        connection.client.list_registered_models()
    except Exception as err:
        raise SourceConnectionException(
            f"Unknown error connecting with {connection} - {err}."
        )


@get_connection.register
def _(_: BackendConnection, verbose: bool = False):
    """
    Let's use Airflow's internal connection for this
    """
    from airflow import settings

    # We don't use `with settings.Session() as` for not being supported in lower Airflow versions
    session = settings.Session()
    return session.get_bind()
