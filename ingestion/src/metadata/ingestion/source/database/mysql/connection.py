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
Source connection handler
"""
from typing import TYPE_CHECKING, Callable, Optional
from urllib.parse import quote_plus

from sqlalchemy.engine import Engine

from metadata.clients.azure_client import AzureClient
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.common.azureConfig import (
    AzureConfigurationSource,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_url_common,
    get_password_secret,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import (
    test_connection_db_schema_sources,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.mysql.queries import (
    MYSQL_TEST_GET_QUERIES,
    MYSQL_TEST_GET_QUERIES_SLOW_LOGS,
)
from metadata.utils.constants import THREE_MIN

if TYPE_CHECKING:
    from pyspark.sql import DataFrame, SparkSession


class MySQLConnection(BaseConnection[MysqlConnection, Engine]):
    def get_client(self) -> Engine:
        """
        Return the SQLAlchemy Engine for MySQL.
        """
        connection = self.service_connection

        if isinstance(connection.authType, AzureConfigurationSource):
            if not connection.authType.azureConfig:
                raise ValueError("Azure Config is missing")
            azure_client = AzureClient(connection.authType.azureConfig).create_client()
            if not connection.authType.azureConfig.scopes:
                raise ValueError(
                    "Azure Scopes are missing, please refer https://learn.microsoft.com/"
                    "en-gb/azure/mysql/flexible-server/how-to-azure-ad#2---retrieve-micr"
                    "osoft-entra-access-token and fetch the resource associated with it,"
                    " for e.g. https://ossrdbms-aad.database.windows.net/.default"
                )
            access_token_obj = azure_client.get_token(
                *connection.authType.azureConfig.scopes.split(",")
            )
            connection.authType = BasicAuth(password=access_token_obj.token)  # type: ignore
        return create_generic_db_connection(
            connection=connection,
            get_connection_url_fn=get_connection_url_common,
            get_connection_args_fn=get_connection_args_common,
        )

    def get_spark_dataframe_loader(
        self, spark: "SparkSession", table: str
    ) -> Callable[..., "DataFrame"]:
        """
        Return a callable that loads a Spark DataFrame for this MySQL connection.
        """
        connection = self.service_connection
        url = self._get_jdbc_url()
        user = connection.username
        password = get_password_secret(connection)
        driver = "com.mysql.cj.jdbc.Driver"

        def loader() -> "DataFrame":
            return (
                spark.read.format("jdbc")
                .option("url", url)
                .option("dbtable", table)
                .option("user", user)
                .option("password", password.get_secret_value())
                .option("driver", driver)
                .load()
            )

        return loader

    def _get_jdbc_url(self) -> str:
        """
        Build a JDBC URL for MySQL from a connection object.
        Example: jdbc:mysql://user:password@host:port/database?param1=value1&param2=value2
        """
        connection = self.service_connection
        # Start with the JDBC prefix
        url = "jdbc:mysql://"

        # Add host and port
        url += connection.hostPort

        # Add database name if present
        database = getattr(connection, "databaseName", None) or getattr(
            connection, "database", None
        )
        if database:
            url += f"/{database}"

        # Collect options (as query parameters)
        options = getattr(connection, "connectionOptions", None)
        if options and getattr(options, "root", None):
            params = "&".join(
                f"{key}={quote_plus(str(value))}"
                for key, value in options.root.items()
                if value
            )
            url += f"?{params}"

        return url


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: MysqlConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    queries = {
        "GetQueries": MYSQL_TEST_GET_QUERIES
        if not service_connection.useSlowLogs
        else MYSQL_TEST_GET_QUERIES_SLOW_LOGS,
    }
    return test_connection_db_schema_sources(
        metadata=metadata,
        engine=engine,
        service_connection=service_connection,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
        queries=queries,
    )
