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
Secrets manager implementation using AWS SSM Parameter Store
"""
from typing import Optional

from botocore.exceptions import ClientError

from metadata.generated.schema.entity.services.connections.metadata.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.utils.secrets.aws_based_secrets_manager import (
    NULL_VALUE,
    AWSBasedSecretsManager,
)
from metadata.utils.secrets.secrets_manager import logger


class AWSSSMSecretsManager(AWSBasedSecretsManager):
    def __init__(self, credentials: Optional[AWSCredentials], cluster_prefix: str):
        super().__init__(credentials, "ssm", SecretsManagerProvider.aws, cluster_prefix)

    def get_string_value(self, name: str) -> str:
        """
        :param name: The parameter name to retrieve.
        :return: The value of the parameter. When the parameter is not present, it throws a `ValueError` exception.
        """
        if name is None:
            raise ValueError

        try:
            kwargs = {"Name": name, "WithDecryption": True}
            response = self.client.get_parameter(**kwargs)
            logger.debug("Got value for parameter %s.", name)
        except ClientError:
            logger.exception("Couldn't get value for parameter %s.", name)
            raise
        else:
            if "Parameter" in response and "Value" in response["Parameter"]:
                return (
                    response["Parameter"]["Value"]
                    if response["Parameter"]["Value"] != NULL_VALUE
                    else None
                )
            else:
                raise ValueError(
                    f"Parameter for parameter name [{name}] not present in the response."
                )
