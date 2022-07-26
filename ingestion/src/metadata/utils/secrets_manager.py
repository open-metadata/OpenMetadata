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
import inspect
import json
from abc import abstractmethod
from pydoc import locate
from typing import Dict, NewType, Optional, Union

import boto3
from botocore.exceptions import ClientError

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
    SecretsManagerProvider,
)
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.security.client import (
    auth0SSOClientConfig,
    azureSSOClientConfig,
    customOidcSSOClientConfig,
    googleSSOClientConfig,
    oktaSSOClientConfig,
    openMetadataJWTClientConfig,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.utils.logger import ingestion_logger
from metadata.utils.singleton import Singleton

logger = ingestion_logger()

SECRET_MANAGER_AIRFLOW_CONF = "openmetadata_secrets_manager"

# new typing type wrapping types from the '__root__' field of 'ServiceConnection' class
ServiceConnectionType = NewType(
    "ServiceConnectionType", ServiceConnection.__fields__["__root__"].type_
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


class SecretsManager(metaclass=Singleton):
    """
    Abstract class implemented by different secrets' manager providers.

    It contains a set of auxiliary methods for adding missing fields which have been encrypted in the secrets' manager
    providers.
    """

    @abstractmethod
    def add_service_config_connection(
        self,
        service: ServiceConnectionType,
        service_type: str,
    ) -> None:
        """
        Add the service connection config from the secret manager to a given service connection object.
        :param service: Service connection object e.g. DatabaseConnection
        :param service_type: Service type e.g. databaseService
        """
        pass

    @abstractmethod
    def add_auth_provider_security_config(self, config: OpenMetadataConnection) -> None:
        """
        Add the auth provider security config from the secret manager to a given OpenMetadata connection object.
        :param config: OpenMetadataConnection object
        """
        pass

    @staticmethod
    def to_service_simple(service_type: str) -> str:
        """
        Return the service simple name.
        :param service_type: Service type e.g. databaseService
        :return:
        """
        return service_type.replace("Service", "").lower()

    @staticmethod
    def build_secret_id(*args: str) -> str:
        """
        Returns a secret_id used by the secrets' manager providers for retrieving a secret.
        For example:
        If `args` are `Database`, `SERVICE` and `MySql` it will return `openmetadata-database-service-mysql`
        :param args: sorted parameters for building the secret_id
        :return: the secret_id
        """
        secret_suffix = "-".join([arg.lower() for arg in args])
        return f"openmetadata-{secret_suffix}"

    def get_service_connection_class(self, service_type: str) -> object:
        """
        Returns the located service object by dotted path, importing as necessary.
        :param service_type: Service type e.g. databaseService
        :return: Located service object
        """
        service_conn_name = next(
            (
                clazz[1]
                for clazz in inspect.getmembers(
                    locate(f"metadata.generated.schema.entity.services.{service_type}"),
                    inspect.isclass,
                )
                if clazz[0].lower()
                == f"{self.to_service_simple(service_type)}connection"
            )
        ).__name__
        return locate(
            f"metadata.generated.schema.entity.services.{service_type}.{service_conn_name}"
        )

    def get_connection_class(
        self, service_type: str, service_connection_type: str
    ) -> object:
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
            f"metadata.generated.schema.entity.services.connections.{self.to_service_simple(service_type)}.{connection_py_file}Connection.{service_connection_type}Connection"
        )


class LocalSecretsManager(SecretsManager):
    """
    LocalSecretsManager is used when there is not a secrets' manager configured.
    """

    def add_auth_provider_security_config(
        self, open_metadata_connection: OpenMetadataConnection
    ) -> None:
        """
        The LocalSecretsManager does not modify the OpenMetadataConnection object
        """
        pass

    def add_service_config_connection(
        self,
        service: ServiceConnectionType,
        service_type: str,
    ) -> None:
        """
        The LocalSecretsManager does not modify the ServiceConnection object
        """
        pass


class AWSSecretsManager(SecretsManager):
    def __init__(self, credentials: AWSCredentials):
        session = boto3.Session(
            aws_access_key_id=credentials.awsAccessKeyId,
            aws_secret_access_key=credentials.awsSecretAccessKey.get_secret_value(),
            region_name=credentials.awsRegion,
        )
        self.secretsmanager_client = session.client("secretsmanager")

    def add_service_config_connection(
        self,
        service: ServiceConnectionType,
        service_type: str,
    ) -> None:
        service_connection_type = service.serviceType.value
        service_name = service.name.__root__
        secret_id = self.build_secret_id(
            self.to_service_simple(service_type), service_connection_type, service_name
        )
        connection_class = self.get_connection_class(
            service_type, service_connection_type
        )
        service_conn_class = self.get_service_connection_class(service_type)
        service.connection = service_conn_class(
            config=connection_class.parse_obj(
                json.loads(self._get_string_value(secret_id))
            )
        )

    def add_auth_provider_security_config(self, config: OpenMetadataConnection) -> None:
        if config.authProvider == AuthProvider.no_auth:
            return config
        secret_id = self.build_secret_id(
            "auth-provider", config.authProvider.value.lower()
        )
        auth_config_json = self._get_string_value(secret_id)
        try:
            config.securityConfig = AUTH_PROVIDER_MAPPING.get(
                config.authProvider
            ).parse_obj(json.loads(auth_config_json))
        except KeyError:
            raise NotImplementedError(
                f"No client implemented for auth provider: [{config.authProvider}]"
            )

    def _get_string_value(self, name: str) -> str:
        """
        :param name: The secret name to retrieve. Current stage is always retrieved.
        :return: The value of the secret. When the secret is a string, the value is
                 contained in the `SecretString` field. When the secret is bytes or not present,
                 it throws a `ValueError` exception.
        """
        if name is None:
            raise ValueError

        try:
            kwargs = {"SecretId": name}
            response = self.secretsmanager_client.get_secret_value(**kwargs)
            logger.info("Got value for secret %s.", name)
        except ClientError:
            logger.exception("Couldn't get value for secret %s.", name)
            raise
        else:
            if "SecretString" in response:
                return response["SecretString"]
            else:
                raise ValueError("[SecretString] not present in the response.")


def get_secrets_manager(
    secret_manager: SecretsManagerProvider,
    credentials: Optional[Union[AWSCredentials]] = None,
) -> SecretsManager:
    if secret_manager == SecretsManagerProvider.local:
        return LocalSecretsManager()
    elif secret_manager == SecretsManagerProvider.aws:
        return AWSSecretsManager(credentials)
    else:
        raise NotImplementedError(f"[{secret_manager}] is not implemented.")
