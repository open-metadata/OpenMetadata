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
import json
from abc import abstractmethod
from pydoc import locate
from typing import Optional, Union

import boto3
from botocore.exceptions import ClientError

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    SecretsManagerProvider,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.mlmodelService import MlModelService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.utils.logger import ingestion_logger
from metadata.utils.singleton import Singleton

logger = ingestion_logger()
SECRET_MANAGER_AIRFLOW_CONF = "openmetadata_secrets_manager"


class SecretsManager(metaclass=Singleton):
    @abstractmethod
    def add_service_config_connection(
        self,
        service: Union[
            DashboardService,
            DatabaseService,
            MessagingService,
            PipelineService,
            MlModelService,
        ],
        service_type: str,
    ) -> Union[
        DashboardService,
        DatabaseService,
        MessagingService,
        PipelineService,
        MlModelService,
    ]:
        pass

    @staticmethod
    def build_secret_id(
        service_type: str, service_connection_type: str, service_name: str
    ) -> str:
        return f"openmetadata-{service_type.lower()}-{service_connection_type.lower()}-{service_name.lower()}"


class LocalSecretsManager(SecretsManager):
    def add_service_config_connection(
        self,
        service: Union[
            DashboardService,
            DatabaseService,
            MessagingService,
            PipelineService,
            MlModelService,
        ],
        service_type: str,
    ) -> Union[
        DashboardService,
        DatabaseService,
        MessagingService,
        PipelineService,
        MlModelService,
    ]:
        return service


class AWSSecretsManager(SecretsManager):
    def add_service_config_connection(
        self,
        service: Union[
            DashboardService,
            DatabaseService,
            MessagingService,
            PipelineService,
            MlModelService,
        ],
        service_type: str,
    ) -> Union[
        DashboardService,
        DatabaseService,
        MessagingService,
        PipelineService,
        MlModelService,
    ]:
        service_simple_type = service_type.replace("Service", "").lower()
        service_connection_type = service.serviceType.value
        service_name = service.name.__root__
        secret_id = self.build_secret_id(
            service_simple_type, service_connection_type, service_name
        )
        connection_py_file = (
            service_connection_type[0].lower() + service_connection_type[1:]
        )
        conn_class = locate(
            f"metadata.generated.schema.entity.services.connections.{service_simple_type}.{connection_py_file}Connection.{service_connection_type}Connection"
        )
        service.connection.config = conn_class.parse_obj(
            json.loads(self._get_string_value(secret_id))
        )
        return service

    def __init__(self, credentials: AWSCredentials):
        session = boto3.Session(
            aws_access_key_id=credentials.awsAccessKeyId,
            aws_secret_access_key=credentials.awsSecretAccessKey.get_secret_value(),
            region_name=credentials.awsRegion,
        )
        self.secretsmanager_client = session.client("secretsmanager")

    def _get_string_value(self, name: str) -> str:
        """
        :param name: The secret name to retrieve. Current stage is always retrieved.
        :return: The value of the secret. When the secret is a string, the value is
                 contained in the `SecretString` field. When the secret is bytes,
                 it is contained in the `SecretBinary` field.
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
