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
Secrets manager implementation using AWS Secrets Manager
"""
import traceback
from typing import Optional

from botocore.exceptions import ClientError

from metadata.generated.schema.security.secrets.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.utils.secrets.aws_based_secrets_manager import (
    NULL_VALUE,
    AWSBasedSecretsManager,
)
from metadata.utils.secrets.secrets_manager import logger


class AWSSecretsManager(AWSBasedSecretsManager):
    """
    Secrets Manager Implementation Class
    """

    def __init__(self, credentials: Optional["AWSCredentials"]):
        super().__init__(credentials, "secretsmanager", SecretsManagerProvider.aws)

    def get_string_value(self, secret_id: str) -> str:
        """
        :param secret_id: The secret id to retrieve. Current stage is always retrieved.
        :return: The value of the secret. When the secret is a string, the value is
                 contained in the `SecretString` field. When the secret is bytes or not present,
                 it throws a `ValueError` exception.
        """
        if secret_id is None:
            raise ValueError("[name] argument is None")

        try:
            kwargs = {"SecretId": secret_id}
            response = self.client.get_secret_value(**kwargs)
            logger.debug("Got value for secret %s.", secret_id)
        except ClientError as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Couldn't get value for secret [{secret_id}]: {err}")
            raise err
        else:
            if "SecretString" in response:
                return (
                    response["SecretString"]
                    if response["SecretString"] != NULL_VALUE
                    else None
                )
            raise ValueError(
                f"SecretString for secret [{secret_id}] not present in the response."
            )
