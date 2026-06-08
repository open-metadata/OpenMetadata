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

from typing import Any, Dict, Optional, cast  # noqa: UP035

from sqlalchemy.engine import Engine
from sqlalchemy.event import listen

from metadata.clients.aws_client import RdsIamAuthTokenManager
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.common.azureConfig import (
    AzureConfigurationSource,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.common.gcpCloudSqlConfig import (
    GcpCloudsqlConfigurationSource,
)
from metadata.generated.schema.entity.services.connections.database.common.iamAuthConfig import (
    IamAuthConfigurationSource,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection as MySQLConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_url_common,
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
from metadata.utils.credentials import get_azure_access_token, set_google_credentials


class MySQLConnection(BaseConnection[MySQLConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        """
        Return the SQLAlchemy Engine for MySQL.
        """
        connection = self.service_connection

        if isinstance(connection.authType, AzureConfigurationSource):
            access_token = get_azure_access_token(connection.authType)
            connection.authType = BasicAuth(password=access_token)  # type: ignore
            return create_generic_db_connection(
                connection=connection,
                get_connection_url_fn=get_connection_url_common,
                get_connection_args_fn=get_connection_args_common,
            )

        if isinstance(connection.authType, GcpCloudsqlConfigurationSource):
            return self._get_cloudsql_engine(connection)

        if isinstance(connection.authType, IamAuthConfigurationSource):
            return self._get_iam_engine(connection)

        return create_generic_db_connection(
            connection=connection,
            get_connection_url_fn=get_connection_url_common,
            get_connection_args_fn=get_connection_args_common,
        )

    def _get_iam_engine(self, connection: MySQLConnectionConfig) -> Engine:
        """Build an engine that refreshes the RDS IAM token per connection.

        RDS IAM tokens expire after ~15 minutes. Rather than baking a single token
        into the connection URL (which would go stale for connections opened later
        in a long ingestion), a ``do_connect`` listener injects a freshly minted
        token on every new connection.
        """
        auth_type = cast("IamAuthConfigurationSource", connection.authType)
        if auth_type.awsConfig is None:
            raise ValueError("awsConfig is required for MySQL RDS IAM authentication")

        host, port = connection.hostPort.split(":")
        token_manager = RdsIamAuthTokenManager(
            host=host,
            port=port,
            username=connection.username,
            aws_config=auth_type.awsConfig,
        )
        engine = create_generic_db_connection(
            connection=connection,
            get_connection_url_fn=self._build_iam_url,
            get_connection_args_fn=get_connection_args_common,
        )

        def inject_iam_token(_dialect, _conn_rec, _cargs, cparams: Dict[str, Any]):  # noqa: UP006
            cparams["password"] = token_manager.get_token()
            # RDS IAM auth requires TLS. A truthy ssl dict makes PyMySQL treat SSL
            # as required (an empty dict only yields PREFERRED, which can silently
            # fall back to plaintext). check_hostname also verifies the RDS cert.
            # Any explicitly provided ssl config is preserved.
            if "ssl" not in cparams:
                cparams["ssl"] = {"check_hostname": True}

        listen(engine, "do_connect", inject_iam_token)
        return engine

    @staticmethod
    def _build_iam_url(connection: MySQLConnectionConfig) -> str:
        """Build the connection URL exactly like ``get_connection_url_common`` but
        without a password/token: the ``do_connect`` listener injects a fresh RDS
        IAM token per connection. Reusing the common helper with the IAM auth
        neutralized keeps databaseSchema and connectionOptions handling in sync.
        """
        url_connection = connection.model_copy()
        url_connection.authType = BasicAuth(password="")  # type: ignore
        return get_connection_url_common(url_connection)

    def _get_cloudsql_engine(self, connection: MySQLConnectionConfig) -> Engine:
        try:
            from google.cloud.sql.connectors import Connector  # noqa: PLC0415
        except ImportError:
            raise ImportError(  # noqa: B904
                "google-cloud-sql-connector is required for GCP CloudSQL connections. "
                "Install it with: pip install 'cloud-sql-python-connector[pymysql]>=1.0.0'"
            )

        if connection.authType.gcpConfig:
            set_google_credentials(connection.authType.gcpConfig)

        self._cloud_sql_connector = Connector()
        instance_connection_name = connection.hostPort
        enable_iam_auth = connection.authType.enableIamAuth or False
        password = connection.authType.password.get_secret_value() if connection.authType.password else ""

        def getconn():
            connect_kwargs = {
                "instance_connection_string": instance_connection_name,
                "driver": "pymysql",
                "user": connection.username,
                "db": connection.databaseSchema or "",
            }
            if connection.databaseSchema:
                connect_kwargs["db"] = connection.databaseSchema
            if enable_iam_auth:
                connect_kwargs["enable_iam_auth"] = True
            else:
                connect_kwargs["password"] = password
            return self._cloud_sql_connector.connect(**connect_kwargs)

        return create_generic_db_connection(
            connection=connection,
            get_connection_url_fn=lambda _: f"{connection.scheme.value}://",
            get_connection_args_fn=get_connection_args_common,
            creator=getconn,
        )

    def __del__(self):
        if hasattr(self, "_cloud_sql_connector"):
            self._cloud_sql_connector.close()

    def get_connection_dict(self) -> dict:
        """
        Return the connection dictionary for this service.
        """
        raise NotImplementedError("get_connection_dict is not implemented for MySQL")

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,  # noqa: UP045
        timeout_seconds: Optional[int] = THREE_MIN,  # noqa: UP045
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow
        """
        if self.service_connection.useSlowLogs:
            test_query_template = MYSQL_TEST_GET_QUERIES_SLOW_LOGS
            default_query_history_table = "mysql.slow_log"
        else:
            test_query_template = MYSQL_TEST_GET_QUERIES
            default_query_history_table = "mysql.general_log"
        query_history_table = self.service_connection.queryHistoryTable or default_query_history_table
        queries = {
            "GetQueries": test_query_template.format(query_history_table=query_history_table),
        }
        return test_connection_db_schema_sources(
            metadata=metadata,
            engine=self.client,
            service_connection=self.service_connection,
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
            queries=queries,
        )
