#  Copyright 2021 Collate
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
AWS Secrets Manager handle
"""

import traceback
from typing import Optional

from botocore.exceptions import ClientError

from metadata.generated.schema.security.secrets.secretsManagerClientLoader import (
    SecretsManagerClientLoader,
)
from metadata.generated.schema.security.secrets.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.utils.logger import ingestion_logger
from metadata.utils.secrets.aws_based_secrets_manager import (
    NULL_VALUE,
    AWSBasedSecretsManager,
)

logger = ingestion_logger()


class AWSSecretsManager(AWSBasedSecretsManager):
    """
    AWS Secrets Manager
    """

    def __init__(self, loader: SecretsManagerClientLoader):
        super().__init__(
            client="secretsmanager",
            provider=SecretsManagerProvider.aws,
            loader=loader,
        )

    def get_string_value(self, secret_id: str) -> Optional[str]:  # noqa: UP045
        """
        Get the secret value as a string
        :param secret_id: secret id
        :return: secret value
        """
        if secret_id is None:
            raise ValueError("[name] argument is None")

        try:
            kwargs = {"SecretId": secret_id}
            response = self.client.get_secret_value(**kwargs)
            logger.debug("Got value for secret %s.", secret_id)
        except ClientError as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Couldn't get value for secret [{secret_id}] from secrets manager: {err}")
            raise err  # noqa: TRY201
        if "SecretString" in response:
            return response["SecretString"] if response["SecretString"] != NULL_VALUE else None
        raise ValueError(f"SecretString for secret [{secret_id}] not present in the response.")
