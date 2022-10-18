#  Copyright 2022 Collate
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
Secrets manager interface
"""
import inspect
from abc import abstractmethod
from pydoc import locate
from typing import Dict, NewType, Union

from metadata.generated.schema.entity.services import (
    dashboardService,
    databaseService,
    messagingService,
    metadataService,
    mlmodelService,
    pipelineService,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.metadataService import MetadataService
from metadata.generated.schema.entity.services.mlmodelService import MlModelService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.metadataIngestion.workflow import SourceConfig
from metadata.generated.schema.security.client import (
    auth0SSOClientConfig,
    azureSSOClientConfig,
    customOidcSSOClientConfig,
    googleSSOClientConfig,
    oktaSSOClientConfig,
    openMetadataJWTClientConfig,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.singleton import Singleton

logger = ingestion_logger()

SECRET_MANAGER_AIRFLOW_CONF = "openmetadata_secrets_manager"

# new typing type wrapping services with connection field types
ServiceWithConnectionType = NewType(
    "ServiceWithConnectionType",
    Union[
        DashboardService,
        DatabaseService,
        MessagingService,
        MetadataService,
        MlModelService,
        PipelineService,
    ],
)

# new typing type wrapping types from the '__root__' field of 'ServiceConnection' class
ServiceConnectionType = NewType(
    "ServiceConnectionType",
    Union[
        dashboardService.DashboardConnection,
        databaseService.DatabaseConnection,
        messagingService.MessagingConnection,
        metadataService.MetadataConnection,
        pipelineService.PipelineConnection,
        mlmodelService.MlModelConnection,
    ],
)

# new typing type wrapping types from the 'securityConfig' field of 'OpenMetadataConnection' class
AuthProviderClientType = NewType(
    "AuthProviderClientType", OpenMetadataConnection.__fields__["securityConfig"].type_
)

AUTH_PROVIDER_MAPPING: Dict[AuthProvider, AuthProviderClientType] = {
    AuthProvider.google: googleSSOClientConfig.GoogleSSOClientConfig,
    AuthProvider.okta: oktaSSOClientConfig.OktaSSOClientConfig,
    AuthProvider.auth0: auth0SSOClientConfig.Auth0SSOClientConfig,
    AuthProvider.azure: azureSSOClientConfig.AzureSSOClientConfig,
    AuthProvider.custom_oidc: customOidcSSOClientConfig.CustomOIDCSSOClientConfig,
    AuthProvider.openmetadata: openMetadataJWTClientConfig.OpenMetadataJWTClientConfig,
}

DBT_SOURCE_CONFIG_SECRET_PREFIX: str = "database-metadata-pipeline"

BOT_PREFIX: str = "bot"

AUTH_PROVIDER_PREFIX: str = "auth-provider"

TEST_CONNECTION_TEMP_SECRET_PREFIX: str = "test-connection-temp"


class SecretsManager(metaclass=Singleton):
    """
    Abstract class implemented by different secrets' manager providers.

    It contains a set of auxiliary methods for adding missing fields which have been encrypted in the secrets' manager
    providers.
    """

    cluster_prefix: str

    def __init__(self, cluster_prefix: str):
        self.cluster_prefix = cluster_prefix

    @abstractmethod
    def retrieve_service_connection(
        self,
        service: ServiceWithConnectionType,
        service_type: str,
    ) -> ServiceConnection:
        """
        Retrieve the service connection from the secret manager from a given service connection object.
        :param service: Service connection object e.g. DatabaseConnection
        :param service_type: Service type e.g. databaseService
        """

    @abstractmethod
    def add_auth_provider_security_config(
        self, config: OpenMetadataConnection, bot_name: str
    ) -> None:
        """
        Add the auth provider security config from the secret manager to a given OpenMetadata connection object.
        :param config: OpenMetadataConnection object
        :param bot_name: Bot name with the credentials
        """

    @abstractmethod
    def retrieve_dbt_source_config(
        self, source_config: SourceConfig, pipeline_name: str
    ) -> object:
        """
        Retrieve the DBT source config from the secret manager from a source config object.
        :param source_config: SourceConfig object
        :param pipeline_name: the pipeline's name
        :return:
        """

    @abstractmethod
    def retrieve_temp_service_test_connection(
        self,
        connection: ServiceConnectionType,
        service_type: str,
    ) -> ServiceConnectionType:
        """
        Retrieve the service connection from the secret manager stored in a temporary secret depending on the service
        type.
        :param connection: Connection of the service
        :param service_type: Service type e.g. Database
        """

    @property
    def secret_id_separator(self) -> str:
        """
        The separator used to build the secret id e.g. /openmetadata/path/to/secret
        :return: the separator character
        """
        return "/"

    @property
    def starts_with_separator(self) -> bool:
        """
        :return: returns True if we want to start the secret id with a seperator character
        """
        return True

    def build_secret_id(self, *args: str) -> str:
        """
        Returns a secret_id used by the secrets' manager providers for retrieving a secret.
        For example:
        If `args` are `Database`, `SERVICE` and `MySql` it will return `openmetadata-database-service-mysql`
        :param args: sorted parameters for building the secret_id
        :return: the secret_id
        """
        secret_id = self.secret_id_separator.join([arg.lower() for arg in args])
        return f"{self.secret_id_separator if self.starts_with_separator else ''}{self.cluster_prefix}{self.secret_id_separator}{secret_id}"  # pylint: disable=line-too-long

    @staticmethod
    def get_service_connection_class(service_type: str) -> object:
        """
        Returns the located service object by dotted path, importing as necessary.
        :param service_type: Service type e.g. databaseService
        :return: Located service object
        """
        service_conn_name = next(
            (
                clazz[1]
                for clazz in inspect.getmembers(
                    locate(
                        f"metadata.generated.schema.entity.services.{service_type.lower()}Service"
                    ),
                    inspect.isclass,
                )
                if clazz[0].lower() == f"{service_type.lower()}connection"
            )
        ).__name__
        return locate(
            f"metadata.generated.schema.entity.services.{service_type.lower()}Service.{service_conn_name}"
        )

    @staticmethod
    def get_connection_class(service_type: str, service_connection_type: str) -> object:
        """
        Returns the located connection object by dotted path, importing as necessary.
        :param service_type: Service type e.g. databaseService
        :param service_connection_type: Service connection type e.g. Mysql
        :return: Located connection object
        """
        connection_py_file = (
            service_connection_type[0].lower() + service_connection_type[1:]
        )
        return locate(
            f"metadata.generated.schema.entity.services.connections.{service_type}.{connection_py_file}Connection.{service_connection_type}Connection"  # pylint: disable=line-too-long
        )
