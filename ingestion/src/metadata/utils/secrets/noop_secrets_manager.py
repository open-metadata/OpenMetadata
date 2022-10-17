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
Secrets manager implementation for local secrets manager
"""
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import SourceConfig
from metadata.utils.secrets.secrets_manager import (
    SecretsManager,
    ServiceConnectionType,
    ServiceWithConnectionType,
    logger,
)


class NoopSecretsManager(SecretsManager):
    """
    LocalSecretsManager is used when there is not a secrets' manager configured.
    """

    provider: str = SecretsManagerProvider.noop.name

    def add_auth_provider_security_config(  # pylint: disable=arguments-renamed, useless-return
        self,
        open_metadata_connection: OpenMetadataConnection,  # pylint: disable=unused-argument
        bot_name: str,
    ) -> None:
        """
        The LocalSecretsManager does not modify the OpenMetadataConnection object
        """
        logger.debug(
            f"Adding auth provider security config using {self.provider} secrets' manager"
        )
        return None

    def retrieve_service_connection(
        self,
        service: ServiceWithConnectionType,
        service_type: str,
    ) -> ServiceConnection:
        """
        Returns the ServiceConnection object with the service connection
        """
        logger.debug(
            f"Retrieving service connection from {self.provider} secrets' manager for {service_type} - {service.name}"
        )
        return ServiceConnection(__root__=service.connection)

    def retrieve_dbt_source_config(
        self, source_config: SourceConfig, pipeline_name: str
    ) -> object:
        """
        Retrieve the DBT source config if it is present in the source config object
        :param source_config: SourceConfig object
        :param pipeline_name: the pipeline's name
        :return:
        """
        logger.debug(
            f"Retrieving source_config from {self.provider} secrets' manager for {pipeline_name}"
        )
        return (
            source_config.config.dbtConfigSource.dict()
            if source_config
            and source_config.config
            and source_config.config.dbtConfigSource
            else None
        )

    def retrieve_temp_service_test_connection(
        self,
        connection: ServiceConnectionType,
        service_type: str,
    ) -> ServiceConnectionType:
        """
        Returns the connection
        :param connection: Connection of the service
        :param service_type: Service type e.g. Database
        """
        return connection
