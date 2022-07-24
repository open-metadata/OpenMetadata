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
from typing import NewType, Optional, Union

import boto3
from botocore.exceptions import ClientError
from pydantic.main import ModelMetaclass

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    SecretsManagerProvider,
)
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.utils.logger import ingestion_logger
from metadata.utils.singleton import Singleton

logger = ingestion_logger()

SECRET_MANAGER_AIRFLOW_CONF = "openmetadata_secrets_manager"

ServiceConnectionType = NewType(
    "ServiceConnectionType", ServiceConnection.__fields__["__root__"].type_
)


class SecretsManager(metaclass=Singleton):
    @abstractmethod
    def add_service_config_connection(
        self,
        service: ServiceConnectionType,
        service_type: str,
    ) -> ServiceConnectionType:
        pass

    @staticmethod
    def to_service_simple(service_type: str) -> str:
        return service_type.replace("Service", "").lower()

    def build_secret_id(
        self, service_type: str, service_connection_type: str, service_name: str
    ) -> str:
        return f"openmetadata-{self.to_service_simple(service_type).lower()}-{service_connection_type.lower()}-{service_name.lower()}"

    def get_service_connection_class(self, service_type) -> ModelMetaclass:
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
        service_conn_class = locate(
            f"metadata.generated.schema.entity.services.{service_type}.{service_conn_name}"
        )
        return service_conn_class

    def get_connection_class(
        self, service_type: str, service_connection_type
    ) -> ModelMetaclass:
        connection_py_file = (
            service_connection_type[0].lower() + service_connection_type[1:]
        )
        conn_class = locate(
            f"metadata.generated.schema.entity.services.connections.{self.to_service_simple(service_type)}.{connection_py_file}Connection.{service_connection_type}Connection"
        )
        return conn_class


class LocalSecretsManager(SecretsManager):
    def add_service_config_connection(
        self,
        service: ServiceConnectionType,
        service_type: str,
    ) -> ServiceConnectionType:
        return service


class AWSSecretsManager(SecretsManager):
    def add_service_config_connection(
        self,
        service: ServiceConnectionType,
        service_type: str,
    ) -> ServiceConnectionType:
        service_connection_type = service.serviceType.value
        service_name = service.name.__root__
        secret_id = self.build_secret_id(
            service_type, service_connection_type, service_name
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
