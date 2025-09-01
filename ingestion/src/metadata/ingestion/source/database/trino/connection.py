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
from copy import deepcopy
from typing import Optional, cast
from urllib.parse import quote_plus

from requests import Session
from sqlalchemy.engine import Engine
from trino.auth import BasicAuthentication, JWTAuthentication, OAuth2Authentication

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    ConnectionArguments,
)
from metadata.generated.schema.entity.services.connections.database.common import (
    azureConfig,
    basicAuth,
    jwtAuth,
    noConfigAuthenticationTypes,
)
from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection as TrinoConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    init_empty_connection_arguments,
    init_empty_connection_options,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.secrets import connection_with_options_secrets
from metadata.ingestion.connections.test_connections import (
    test_connection_db_schema_sources,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.trino.queries import TRINO_GET_DATABASE
from metadata.utils.constants import THREE_MIN
from metadata.utils.credentials import get_azure_access_token


# pylint: disable=unused-argument
def _is_disconnect(self, e, connection, cursor):
    """is_disconnect method for the Databricks dialect"""
    if "JWT expired" in str(e):
        return True
    return False


class TrinoConnection(BaseConnection[TrinoConnectionConfig, Engine]):
    def __init__(self, connection: TrinoConnectionConfig):
        super().__init__(connection)

    def _get_client(self) -> Engine:
        """
        Create connection
        """
        # here we are creating a copy of connection, because we need to dynamically
        # add auth params to connectionArguments, which we do no intend to store
        # in original connection object and in OpenMetadata database
        from trino.sqlalchemy.dialect import TrinoDialect

        TrinoDialect.is_disconnect = _is_disconnect  # type: ignore

        connection = self.service_connection
        connection_copy = deepcopy(connection)

        if hasattr(connection.authType, "azureConfig"):
            auth_type = cast(azureConfig.AzureConfigurationSource, connection.authType)
            access_token = get_azure_access_token(auth_type)
            if not connection.connectionOptions:
                connection.connectionOptions = init_empty_connection_options()
            connection.connectionOptions.root["access_token"] = access_token

        # Update the connection with the connection arguments
        connection_copy.connectionArguments = self.build_connection_args(
            connection_copy
        )

        return create_generic_db_connection(
            connection=connection_copy,
            get_connection_url_fn=self.get_connection_url,
            get_connection_args_fn=get_connection_args_common,
        )

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,
        timeout_seconds: Optional[int] = THREE_MIN,
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow
        """
        queries = {
            "GetDatabases": TRINO_GET_DATABASE,
        }

        return test_connection_db_schema_sources(
            metadata=metadata,
            engine=self.client,
            service_connection=self.service_connection,
            automation_workflow=automation_workflow,
            queries=queries,
            timeout_seconds=timeout_seconds,
        )

    def get_connection_dict(self) -> dict:
        """
        Return the connection dictionary for this service.
        """
        url = self.client.url
        connection_copy = deepcopy(self.service_connection)

        connection_dict = {
            "driver": url.drivername,
            "host": url.host,
            "port": url.port,
            "user": url.username,
            "catalog": url.database,
            "schema": url.query.get("schema"),
        }

        connection_dict.update(url.query)

        if connection_copy.proxies:
            connection_dict["http_session"] = connection_copy.proxies

        if (
            connection_copy.connectionArguments
            and connection_copy.connectionArguments.root
        ):
            connection_with_options_secrets(lambda: connection_copy)
            connection_dict.update(get_connection_args_common(connection_copy))

        if isinstance(connection_copy.authType, basicAuth.BasicAuth):
            connection_dict["auth"] = TrinoConnection.get_basic_auth_dict(
                connection_copy
            )
            connection_dict["http_scheme"] = "https"

        elif isinstance(connection_copy.authType, jwtAuth.JwtAuth):
            connection_dict["auth"] = TrinoConnection.get_jwt_auth_dict(connection_copy)
            connection_dict["http_scheme"] = "https"

        elif hasattr(connection_copy.authType, "azureConfig"):
            connection_dict["auth"] = TrinoConnection.get_azure_auth_dict(
                connection_copy
            )
            connection_dict["http_scheme"] = "https"

        elif (
            connection_copy.authType
            == noConfigAuthenticationTypes.NoConfigAuthenticationTypes.OAuth2
        ):
            connection_dict["auth"] = TrinoConnection.get_oauth2_auth_dict(
                connection_copy
            )
            connection_dict["http_scheme"] = "https"

        return connection_dict

    @staticmethod
    def get_connection_url(connection: TrinoConnectionConfig) -> str:
        """
        Prepare the connection url for trino
        """

        url = f"{connection.scheme.value}://"

        # leaving username here as, even though with basic auth is used directly
        # in BasicAuthentication class, it's often also required as a part of url.
        # For example - it will be used by OAuth2Authentication to persist token in
        # cache more efficiently (per user instead of per host)
        if connection.username:
            url += f"{quote_plus(connection.username)}@"

        url += f"{connection.hostPort}"
        if connection.catalog:
            url += f"/{connection.catalog}"
        if connection.connectionOptions is not None:
            params = "&".join(
                f"{key}={quote_plus(value)}"
                for (key, value) in connection.connectionOptions.root.items()
                if value
            )
            url = f"{url}?{params}"
        return url

    @staticmethod
    @connection_with_options_secrets
    def build_connection_args(connection: TrinoConnectionConfig) -> ConnectionArguments:
        """
        Get the connection args for the trino connection
        """
        connection_args: ConnectionArguments = (
            connection.connectionArguments or init_empty_connection_arguments()
        )
        assert connection_args.root is not None

        if connection.verify:
            connection_args.root["verify"] = {"verify": connection.verify}

        if connection.proxies:
            session = Session()
            session.proxies = connection.proxies

            connection_args.root["http_session"] = session

        if isinstance(connection.authType, basicAuth.BasicAuth):
            TrinoConnection.set_basic_auth(connection, connection_args)

        elif isinstance(connection.authType, jwtAuth.JwtAuth):
            TrinoConnection.set_jwt_auth(connection, connection_args)

        elif hasattr(connection.authType, "azureConfig"):
            TrinoConnection.set_azure_auth(connection, connection_args)

        elif (
            connection.authType
            == noConfigAuthenticationTypes.NoConfigAuthenticationTypes.OAuth2
        ):
            TrinoConnection.set_oauth2_auth(connection, connection_args)

        return connection_args

    @staticmethod
    def get_basic_auth_dict(connection: TrinoConnectionConfig) -> dict:
        """
        Get the basic auth dictionary for the trino connection
        """
        auth_type = cast(basicAuth.BasicAuth, connection.authType)
        return {
            "authType": "basic",
            "username": connection.username,
            "password": auth_type.password.get_secret_value()
            if auth_type.password
            else None,
        }

    @staticmethod
    def set_basic_auth(
        connection: TrinoConnectionConfig, connection_args: ConnectionArguments
    ) -> None:
        """
        Get the basic auth dictionary for the trino connection
        """
        assert connection_args.root is not None
        auth_type = cast(basicAuth.BasicAuth, connection.authType)

        connection_args.root["auth"] = BasicAuthentication(
            connection.username,
            auth_type.password.get_secret_value() if auth_type.password else None,
        )
        connection_args.root["http_scheme"] = "https"

    @staticmethod
    def get_jwt_auth_dict(connection: TrinoConnectionConfig) -> dict:
        """
        Get the jwt auth dictionary for the trino connection
        """
        auth_type = cast(jwtAuth.JwtAuth, connection.authType)

        return {
            "authType": "jwt",
            "jwt": auth_type.jwt.get_secret_value(),
        }

    @staticmethod
    def set_jwt_auth(
        connection: TrinoConnectionConfig, connection_args: ConnectionArguments
    ) -> None:
        """
        Set the jwt auth for the trino connection
        """
        assert connection_args.root is not None
        auth_type = cast(jwtAuth.JwtAuth, connection.authType)

        connection_args.root["auth"] = JWTAuthentication(
            auth_type.jwt.get_secret_value()
        )
        connection_args.root["http_scheme"] = "https"

    @staticmethod
    def get_azure_auth_dict(connection: TrinoConnectionConfig) -> dict:
        """
        Get the azure auth dictionary for the trino connection
        """
        return {
            "authType": "jwt",
            "jwt": TrinoConnection.get_azure_token(connection),
        }

    @staticmethod
    def set_azure_auth(
        connection: TrinoConnectionConfig, connection_args: ConnectionArguments
    ) -> None:
        """
        Set the azure auth for the trino connection
        """
        assert connection_args.root is not None

        connection_args.root["auth"] = JWTAuthentication(
            TrinoConnection.get_azure_token(connection)
        )
        connection_args.root["http_scheme"] = "https"

    @staticmethod
    def get_oauth2_auth_dict(connection: TrinoConnectionConfig) -> dict:
        """
        Get the oauth2 auth dictionary for the trino connection
        """
        return {
            "authType": "oauth2",
        }

    @staticmethod
    def set_oauth2_auth(
        connection: TrinoConnectionConfig, connection_args: ConnectionArguments
    ) -> None:
        """
        Set the oauth2 auth for the trino connection
        """
        assert connection_args.root is not None

        connection_args.root["auth"] = OAuth2Authentication()
        connection_args.root["http_scheme"] = "https"

    @staticmethod
    def get_azure_token(connection: TrinoConnectionConfig) -> str:
        """
        Get the azure token for the trino connection
        """
        auth_type = cast(azureConfig.AzureConfigurationSource, connection.authType)
        return get_azure_access_token(auth_type)
