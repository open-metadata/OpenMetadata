#  Copyright 2025 Collate
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
Credentials helper module
"""
import base64
import json
import os
import tempfile
from typing import Dict, List, Optional, Union

from cryptography.hazmat.primitives import serialization
from google import auth
from google.auth import impersonated_credentials

from metadata.clients.azure_client import AzureClient
from metadata.generated.schema.entity.services.connections.database.common.azureConfig import (
    AzureConfigurationSource,
)
from metadata.generated.schema.security.credentials.gcpCredentials import (
    GcpADC,
    GCPCredentials,
    GcpCredentialsPath,
)
from metadata.generated.schema.security.credentials.gcpExternalAccount import (
    GcpExternalAccount,
)
from metadata.generated.schema.security.credentials.gcpValues import (
    GcpCredentialsValues,
)
from metadata.utils.logger import utils_logger

logger = utils_logger()

GOOGLE_CREDENTIALS = "GOOGLE_APPLICATION_CREDENTIALS"

GOOGLE_CLOUD_SCOPES = [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/drive",
]


class InvalidGcpConfigException(Exception):
    """
    Raised when we have errors trying to set GCP credentials
    """


class InvalidPrivateKeyException(Exception):
    """
    If the key cannot be serialised
    """


def validate_private_key(private_key: str) -> None:
    """
    Make sure that a private key can be properly parsed
    by cryptography backends
    :param private_key: key to validate
    """
    try:
        serialization.load_pem_private_key(private_key.encode(), password=None)
    except ValueError as err:
        msg = f"Cannot serialise key: {err}"
        raise InvalidPrivateKeyException(msg) from err


def create_credential_tmp_file(credentials: dict) -> str:
    """
    Given a credentials' dict, store it in a tmp file
    :param credentials: dictionary to store
    :return: path to find the file
    """
    with tempfile.NamedTemporaryFile(delete=False) as temp_file:
        cred_json = json.dumps(credentials, indent=4, separators=(",", ": "))
        temp_file.write(cred_json.encode())
        # Get the path of the temporary file
        temp_file_path = temp_file.name

        # The temporary file will be automatically closed when exiting the "with" block,
        # but we can explicitly close it here to free up resources immediately.
        temp_file.close()

        # Return the path of the temporary file
        return temp_file_path


def build_google_credentials_dict(
    gcp_values: Union[GcpCredentialsValues, GcpExternalAccount],
    single_project: bool = False,
) -> Dict[str, str]:
    """
    Given GcPCredentialsValues, build a dictionary as the JSON file
    downloaded from GCP with the service_account
    :param gcp_values: GCP credentials
    :return: Dictionary with credentials
    """
    if isinstance(gcp_values, GcpCredentialsValues):
        private_key_str = gcp_values.privateKey.get_secret_value()
        # adding the replace string here to escape line break if passed from env
        private_key_str = private_key_str.replace("\\n", "\n")
        validate_private_key(private_key_str)

        if single_project:
            project_id = (
                gcp_values.projectId.root
                if isinstance(gcp_values.projectId.root, str)
                else gcp_values.projectId.root[0]
            )
        else:
            project_id = gcp_values.projectId.root

        return {
            "type": gcp_values.type,
            "project_id": project_id,
            "private_key_id": gcp_values.privateKeyId,
            "private_key": private_key_str,
            "client_email": gcp_values.clientEmail,
            "client_id": gcp_values.clientId,
            "auth_uri": str(gcp_values.authUri),
            "token_uri": str(gcp_values.tokenUri),
            "auth_provider_x509_cert_url": str(gcp_values.authProviderX509CertUrl),
            "client_x509_cert_url": str(gcp_values.clientX509CertUrl),
        }
    if isinstance(gcp_values, GcpExternalAccount):
        return {
            "type": gcp_values.externalType,
            "audience": gcp_values.audience,
            "subject_token_type": gcp_values.subjectTokenType,
            "token_url": gcp_values.tokenURL,
            "credential_source": gcp_values.credentialSource,
        }
    raise InvalidGcpConfigException(
        f"Error trying to build GCP credentials dict due to Invalid GCP config {type(gcp_values)}"
    )


def set_google_credentials(
    gcp_credentials: GCPCredentials, single_project: bool = False
) -> None:
    """
    Set GCP credentials environment variable
    :param gcp_credentials: GCPCredentials
    """
    if isinstance(gcp_credentials.gcpConfig, GcpCredentialsPath):
        os.environ[GOOGLE_CREDENTIALS] = str(gcp_credentials.gcpConfig.path)
        return

    if (
        isinstance(gcp_credentials.gcpConfig, GcpCredentialsValues)
        and gcp_credentials.gcpConfig.projectId is None
    ):
        logger.info(
            "No credentials available, using the current environment permissions authenticated via gcloud SDK."
        )
        return

    if isinstance(gcp_credentials.gcpConfig, GcpExternalAccount):
        logger.info(
            "Using External account credentials to authenticate with GCP services."
        )
        return

    if isinstance(gcp_credentials.gcpConfig, GcpCredentialsValues):
        if (
            gcp_credentials.gcpConfig.projectId
            and not gcp_credentials.gcpConfig.privateKey
        ):
            logger.info(
                "Overriding default projectid, using the current environment permissions authenticated via gcloud SDK."
            )
            return

        credentials_dict = build_google_credentials_dict(
            gcp_credentials.gcpConfig, single_project
        )
        tmp_credentials_file = create_credential_tmp_file(credentials=credentials_dict)
        os.environ[GOOGLE_CREDENTIALS] = tmp_credentials_file
        return

    if isinstance(gcp_credentials.gcpConfig, GcpADC):
        logger.info(
            "Using Application Default Credentials to authenticate with GCP services."
        )
        return

    raise InvalidGcpConfigException(
        f"Error trying to set GCP credentials with {gcp_credentials}."
        " Check https://docs.open-metadata.org/connectors/database/bigquery "
    )


def generate_http_basic_token(username, password):
    """
    Generates a HTTP basic token from username and password
    Returns a token string (not a byte)
    """
    token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("utf-8")
    return token


def get_gcp_default_credentials(
    quota_project_id: Optional[str] = None,
    scopes: Optional[List[str]] = None,
) -> auth.credentials.Credentials:
    """Get the default credentials

    Args:
        quota_project_id: quota project ID
        scopes: Google Cloud sscopes
    """
    scopes = scopes or GOOGLE_CLOUD_SCOPES
    credentials, _ = auth.default(quota_project_id=quota_project_id, scopes=scopes)
    return credentials


def get_gcp_impersonate_credentials(
    impersonate_service_account: str,
    quoted_project_id: Optional[str] = None,
    scopes: Optional[List[str]] = None,
    lifetime: Optional[int] = 3600,
) -> impersonated_credentials.Credentials:
    """Get the credentials to impersonate"""
    scopes = scopes or GOOGLE_CLOUD_SCOPES
    source_credentials, _ = auth.default()
    if quoted_project_id:
        source_credentials, quoted_project_id = auth.default(
            quota_project_id=quoted_project_id
        )
    return impersonated_credentials.Credentials(
        source_credentials=source_credentials,
        target_principal=impersonate_service_account,
        target_scopes=scopes,
        lifetime=lifetime,
    )


def get_azure_access_token(azure_config: AzureConfigurationSource) -> str:
    """
    Get Azure access token using the provided Azure configuration.

    Args:
        azure_config: Azure configuration containing the necessary credentials and scopes

    Returns:
        str: The access token

    Raises:
        ValueError: If Azure config is missing or scopes are not provided
    """
    if not azure_config.azureConfig:
        raise ValueError("Azure Config is missing")

    if not azure_config.azureConfig.scopes:
        raise ValueError(
            "Azure Scopes are missing, please refer https://learn.microsoft.com/"
            "en-gb/azure/mysql/flexible-server/how-to-azure-ad#2---retrieve-microsoft-entra-access-token "
            "and fetch the resource associated with it, for e.g. https://ossrdbms-aad.database.windows.net/.default"
        )

    azure_client = AzureClient(azure_config.azureConfig).create_client()
    access_token_obj = azure_client.get_token(
        *azure_config.azureConfig.scopes.split(",")
    )

    return access_token_obj.token
