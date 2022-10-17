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
Secrets manager factory module
"""
from typing import Optional, Union

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.utils.secrets.aws_secrets_manager import AWSSecretsManager
from metadata.utils.secrets.aws_ssm_secrets_manager import AWSSSMSecretsManager
from metadata.utils.secrets.noop_secrets_manager import NoopSecretsManager
from metadata.utils.secrets.secrets_manager import SecretsManager


def get_secrets_manager_from_om_connection(
    open_metadata_config: OpenMetadataConnection,
    credentials: Optional[Union[AWSCredentials]] = None,
) -> SecretsManager:
    """
    Method to get the secrets manager based on the configuration passed in OpenMetadataConnection
    :param open_metadata_config: the OpenMetadata connection configuration object
    :param credentials: optional credentials that could be required by the clients of the secrets manager implementations # pylint: disable=line-too-long
    :return: a secrets manager
    """
    return get_secrets_manager(
        open_metadata_config.secretsManagerProvider,
        open_metadata_config.clusterName,
        credentials,
    )


def get_secrets_manager(
    secrets_manager_provider: SecretsManagerProvider,
    cluster_name: str,
    credentials: Optional[Union[AWSCredentials]] = None,
) -> SecretsManager:
    """
    Method to get the secrets manager based on the arguments passed
    :param secrets_manager_provider: the secrets manager provider
    :param cluster_name: the cluster name
    :param credentials: optional credentials that could be required by the clients of the secrets manager implementations # pylint: disable=line-too-long
    :return: a secrets manager
    """
    if (
        secrets_manager_provider is None
        or secrets_manager_provider == SecretsManagerProvider.noop
    ):
        return NoopSecretsManager(cluster_name)
    if secrets_manager_provider == SecretsManagerProvider.aws:
        return AWSSecretsManager(credentials, cluster_name)
    if secrets_manager_provider == SecretsManagerProvider.aws_ssm:
        return AWSSSMSecretsManager(credentials, cluster_name)
    raise NotImplementedError(f"[{secrets_manager_provider}] is not implemented.")
