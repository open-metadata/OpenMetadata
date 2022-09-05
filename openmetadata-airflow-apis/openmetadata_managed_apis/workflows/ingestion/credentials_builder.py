from airflow.configuration import conf
from pydantic import SecretStr

from metadata.generated.schema.entity.services.connections.metadata.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.utils.secrets.secrets_manager import SECRET_MANAGER_AIRFLOW_CONF


def build_aws_credentials():
    if conf.has_section(SECRET_MANAGER_AIRFLOW_CONF):
        credentials = AWSCredentials(
            awsRegion=conf.get(SECRET_MANAGER_AIRFLOW_CONF, "aws_region", fallback="")
        )
        credentials.awsAccessKeyId = conf.get(
            SECRET_MANAGER_AIRFLOW_CONF, "aws_access_key_id", fallback=""
        )
        credentials.awsSecretAccessKey = SecretStr(
            conf.get(SECRET_MANAGER_AIRFLOW_CONF, "aws_secret_access_key", fallback="")
        )
        return credentials
    return None


def build_secrets_manager_credentials(secrets_manager: SecretsManagerProvider):
    if secrets_manager == SecretsManagerProvider.aws:
        return build_aws_credentials()
    if secrets_manager == SecretsManagerProvider.aws_ssm:
        return build_aws_credentials()
    else:
        return None
