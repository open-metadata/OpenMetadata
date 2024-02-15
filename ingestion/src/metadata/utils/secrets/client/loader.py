#  Copyright 2021 Collate
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
Function registry for secret manager loaders
to use in the client
"""
import os
from typing import Optional, Union

from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.generated.schema.security.credentials.azureCredentials import (
    AzureCredentials,
)
from metadata.generated.schema.security.secrets.secretsManagerClientLoader import (
    SecretsManagerClientLoader,
)
from metadata.generated.schema.security.secrets.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.utils.dispatch import enum_register

SECRET_MANAGER_AIRFLOW_CONF = "openmetadata_secrets_manager"

secrets_manager_client_loader = enum_register()


# pylint: disable=import-outside-toplevel
@secrets_manager_client_loader.add(SecretsManagerClientLoader.noop.value)
def _(_: SecretsManagerProvider) -> None:
    return None


@secrets_manager_client_loader.add(SecretsManagerClientLoader.airflow.value)
def _(
    provider: SecretsManagerProvider,
) -> Optional[Union[AWSCredentials, AzureCredentials]]:
    from airflow.configuration import conf

    if provider in {
        SecretsManagerProvider.aws,
        SecretsManagerProvider.managed_aws,
        SecretsManagerProvider.aws_ssm,
        SecretsManagerProvider.managed_aws_ssm,
    }:
        aws_region = conf.get(SECRET_MANAGER_AIRFLOW_CONF, "aws_region", fallback=None)
        if aws_region:
            credentials = AWSCredentials(awsRegion=aws_region)
            credentials.awsAccessKeyId = conf.get(
                SECRET_MANAGER_AIRFLOW_CONF, "aws_access_key_id", fallback=""
            )
            credentials.awsSecretAccessKey = CustomSecretStr(
                conf.get(
                    SECRET_MANAGER_AIRFLOW_CONF, "aws_secret_access_key", fallback=""
                )
            )
            return credentials

    if provider in {
        SecretsManagerProvider.managed_azure_kv,
        SecretsManagerProvider.azure_kv,
    }:
        key_vault_name = conf.get(
            SECRET_MANAGER_AIRFLOW_CONF, "azure_key_vault_name", fallback=None
        )
        if not key_vault_name:
            raise ValueError(
                "Missing `azure_key_vault_name` config for Azure Key Vault Secrets Manager Provider."
            )

        tenant_id = conf.get(
            SECRET_MANAGER_AIRFLOW_CONF, "azure_tenant_id", fallback=None
        )
        client_id = conf.get(
            SECRET_MANAGER_AIRFLOW_CONF, "azure_client_id", fallback=None
        )
        client_secret = conf.get(
            SECRET_MANAGER_AIRFLOW_CONF, "azure_client_secret", fallback=None
        )

        return AzureCredentials(
            clientId=client_id,
            clientSecret=client_secret,
            tenantId=tenant_id,
            vaultName=key_vault_name,
        )

    return None


@secrets_manager_client_loader.add(SecretsManagerClientLoader.env.value)
def _(
    provider: SecretsManagerProvider,
) -> Optional[Union[AWSCredentials, AzureCredentials]]:
    if provider in {
        SecretsManagerProvider.aws,
        SecretsManagerProvider.managed_aws,
        SecretsManagerProvider.aws_ssm,
        SecretsManagerProvider.managed_aws_ssm,
    }:
        # Loading the env vars required by boto3
        # https://boto3.amazonaws.com/v1/documentation/api/latest/guide/configuration.html
        aws_region = os.getenv("AWS_DEFAULT_REGION")
        if aws_region:
            return AWSCredentials(awsRegion=aws_region)

    if provider in {
        SecretsManagerProvider.managed_azure_kv,
        SecretsManagerProvider.azure_kv,
    }:
        # Load only the AZURE_KEY_VAULT_NAME (required) variable and use the
        # Default Auth chain
        # https://learn.microsoft.com/en-us/python/api/overview/azure/identity-readme?view=azure-python#defaultazurecredential
        key_vault_name = os.getenv("AZURE_KEY_VAULT_NAME")

        if not key_vault_name:
            raise ValueError(
                "Missing `azure_key_vault_name` config for Azure Key Vault Secrets Manager Provider."
            )

        return AzureCredentials(vaultName=key_vault_name)

    return None
