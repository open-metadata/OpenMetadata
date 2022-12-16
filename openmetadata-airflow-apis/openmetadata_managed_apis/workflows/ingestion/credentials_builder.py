from typing import Optional

from airflow.configuration import conf

from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.generated.schema.security.secrets.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.utils.secrets.secrets_manager import SECRET_MANAGER_AIRFLOW_CONF


def build_aws_credentials() -> Optional[AWSCredentials]:
    if conf.has_section(SECRET_MANAGER_AIRFLOW_CONF):
        credentials = AWSCredentials(
            awsRegion=conf.get(SECRET_MANAGER_AIRFLOW_CONF, "aws_region", fallback="")
        )
        credentials.awsAccessKeyId = conf.get(
            SECRET_MANAGER_AIRFLOW_CONF, "aws_access_key_id", fallback=""
        )
        credentials.awsSecretAccessKey = CustomSecretStr(
            conf.get(SECRET_MANAGER_AIRFLOW_CONF, "aws_secret_access_key", fallback="")
        )
        return credentials
    return None


def build_secrets_manager_credentials(
    secrets_manager: SecretsManagerProvider,
) -> Optional[AWSCredentials]:
    if secrets_manager in [
        SecretsManagerProvider.aws,
        SecretsManagerProvider.managed_aws,
    ]:
        return build_aws_credentials()
    if secrets_manager in [
        SecretsManagerProvider.aws_ssm,
        SecretsManagerProvider.managed_aws_ssm,
    ]:
        return build_aws_credentials()
    else:
        return None
