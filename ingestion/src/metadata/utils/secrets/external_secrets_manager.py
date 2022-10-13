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
Abstract class for third party secrets' manager implementations
"""
import json
from abc import ABC, abstractmethod

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import SourceConfig
from metadata.utils.logger import utils_logger
from metadata.utils.secrets.secrets_manager import (
    AUTH_PROVIDER_MAPPING,
    AUTH_PROVIDER_PREFIX,
    BOT_PREFIX,
    DBT_SOURCE_CONFIG_SECRET_PREFIX,
    TEST_CONNECTION_TEMP_SECRET_PREFIX,
    SecretsManager,
    ServiceConnectionType,
    ServiceWithConnectionType,
)

logger = utils_logger()

NULL_VALUE = "null"


class ExternalSecretsManager(SecretsManager, ABC):
    """
    Abstract class for third party secrets' manager implementations
    """

    def __init__(
        self,
        cluster_prefix: str,
        provider: SecretsManagerProvider,
    ):
        super().__init__(cluster_prefix)
        self.provider = provider.name

    def retrieve_service_connection(
        self,
        service: ServiceWithConnectionType,
        service_type: str,
    ) -> ServiceConnection:
        """
        Retrieve the service connection from the AWS client store from a given service connection object.
        :param service: Service connection object e.g. DatabaseConnection
        :param service_type: Service type e.g. databaseService
        """
        logger.debug(
            f"Retrieving service connection from {self.provider} secrets' manager for {service_type} - {service.name}"
        )
        service_connection_type = service.serviceType.value
        service_name = service.name.__root__
        secret_id = self.build_secret_id(
            "service", service_type, service_connection_type, service_name
        )
        connection_class = self.get_connection_class(
            service_type, service_connection_type
        )
        service_conn_class = self.get_service_connection_class(service_type)
        service_connection = service_conn_class(
            config=connection_class.parse_obj(
                json.loads(self.get_string_value(secret_id))
            )
        )
        return ServiceConnection(__root__=service_connection)

    def add_auth_provider_security_config(
        self, config: OpenMetadataConnection, bot_name: str
    ) -> None:
        """
        Add the auth provider security config from the AWS client store to a given OpenMetadata connection object.
        :param config: OpenMetadataConnection object
        :param bot_name: Bot name to retrieve credentials from
        """
        logger.debug(
            f"Adding auth provider security config using {self.provider} secrets' manager"
        )

        if (
            config.authProvider != AuthProvider.no_auth
            and config.securityConfig is None
        ):
            auth_provider_secret_id = self.build_secret_id(
                BOT_PREFIX, bot_name, AUTH_PROVIDER_PREFIX
            )
            auth_provider_secret = self.get_string_value(auth_provider_secret_id)
            config.authProvider = AuthProvider(json.loads(auth_provider_secret))
            secret_id = self.build_secret_id(BOT_PREFIX, bot_name)
            auth_config_json = self.get_string_value(secret_id)
            try:
                config_object = json.loads(auth_config_json)
                config.securityConfig = AUTH_PROVIDER_MAPPING.get(
                    config.authProvider
                ).parse_obj(config_object)
            except KeyError as err:
                msg = f"No client implemented for auth provider [{config.authProvider}]: {err}"
                raise NotImplementedError(msg) from err

    def retrieve_dbt_source_config(
        self, source_config: SourceConfig, pipeline_name: str
    ) -> object:
        """
        Retrieve the DBT source config from the AWS client store from a source config object.
        :param source_config: SourceConfig object
        :param pipeline_name: the pipeline's name
        :return:
        """
        logger.debug(
            f"Retrieving source_config from {self.provider} secrets' manager for {pipeline_name}"
        )
        secret_id = self.build_secret_id(DBT_SOURCE_CONFIG_SECRET_PREFIX, pipeline_name)
        source_config_json = self.get_string_value(secret_id)
        return json.loads(source_config_json) if source_config_json else None

    def retrieve_temp_service_test_connection(
        self,
        connection: ServiceConnectionType,
        service_type: str,
    ) -> ServiceConnectionType:
        """
        Retrieve the service connection from the AWS client stored in a temporary secret depending on the service
        type.
        :param connection: Connection of the service
        :param service_type: Service type e.g. Database
        """
        secret_id = self.build_secret_id(
            TEST_CONNECTION_TEMP_SECRET_PREFIX, service_type
        )
        service_conn_class = self.get_service_connection_class(service_type)
        stored_connection = service_conn_class()
        source_config_json = self.get_string_value(secret_id)
        return stored_connection.parse_raw(source_config_json)

    @abstractmethod
    def get_string_value(self, name: str) -> str:
        """
        :param name: The secret name to retrieve
        :return: The value of the secret
        """
