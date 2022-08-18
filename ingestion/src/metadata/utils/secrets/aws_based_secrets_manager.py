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
Abstract class for AWS based secrets manager implementations
"""
import json
from abc import ABC, abstractmethod
from typing import Optional

from metadata.clients.aws_client import AWSClient
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
    SecretsManagerProvider,
)
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import SourceConfig
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.utils.secrets.secrets_manager import (
    AUTH_PROVIDER_MAPPING,
    SecretsManager,
    ServiceWithConnectionType,
    logger,
)


class AWSBasedSecretsManager(SecretsManager, ABC):
    def __init__(
        self,
        credentials: Optional[AWSCredentials],
        client: str,
        provider: SecretsManagerProvider,
        cluster_prefix: str,
    ):
        super().__init__(cluster_prefix)
        self.client = AWSClient(credentials).get_client(client)
        self.provider = provider.name

    def retrieve_service_connection(
        self,
        service: ServiceWithConnectionType,
        service_type: str,
    ) -> ServiceConnection:
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

    def add_auth_provider_security_config(self, config: OpenMetadataConnection) -> None:
        logger.debug(
            f"Adding auth provider security config using {self.provider} secrets' manager"
        )
        if config.authProvider != AuthProvider.no_auth:
            secret_id = self.build_secret_id(
                "auth-provider", config.authProvider.value.lower()
            )
            auth_config_json = self.get_string_value(secret_id)
            try:
                config.securityConfig = AUTH_PROVIDER_MAPPING.get(
                    config.authProvider
                ).parse_obj(json.loads(auth_config_json))
            except KeyError:
                raise NotImplementedError(
                    f"No client implemented for auth provider: [{config.authProvider}]"
                )

    def retrieve_dbt_source_config(
        self, source_config: SourceConfig, pipeline_name: str
    ) -> object:
        logger.debug(
            f"Retrieving source_config from {self.provider} secrets' manager for {pipeline_name}"
        )
        secret_id = self.build_secret_id("database-metadata-pipeline", pipeline_name)
        source_config_json = self.get_string_value(secret_id)
        return json.loads(source_config_json) if source_config_json else None

    @abstractmethod
    def get_string_value(self, name: str) -> str:
        """
        :param name: The secret name to retrieve. Current stage is always retrieved.
        :return: The value of the secret. When the secret is a string, the value is
                 contained in the `SecretString` field. When the secret is bytes or not present,
                 it throws a `ValueError` exception.
        """
        pass
