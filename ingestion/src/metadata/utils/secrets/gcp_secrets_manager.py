"""
Secrets manager implementation using GCP Secret Manager
"""

import os
from abc import ABC
from typing import Optional

import google_crc32c
from google import auth
from google.cloud import secretmanager

from metadata.generated.schema.security.secrets.secretsManagerClientLoader import (
    SecretsManagerClientLoader,
)
from metadata.generated.schema.security.secrets.secretsManagerProvider import (
    SecretsManagerProvider,
)
from metadata.utils.dispatch import enum_register
from metadata.utils.secrets.external_secrets_manager import (
    SECRET_MANAGER_AIRFLOW_CONF,
    ExternalSecretsManager,
    SecretsManagerConfigException,
)

FIXED_VERSION_ID = "latest"

secrets_manager_client_loader = enum_register()


# pylint: disable=import-outside-toplevel
@secrets_manager_client_loader.add(SecretsManagerClientLoader.noop.value)
def _() -> Optional["GCPCredentials"]:
    from metadata.generated.schema.security.credentials.gcpCredentials import (
        GCPCredentials,
        gcpValues,
    )

    _, project_id = auth.default()
    if project_id:
        config = gcpValues.GcpCredentialsValues(projectId=project_id)
        credentials = GCPCredentials(gcpConfig=config)
        return credentials

    return None


@secrets_manager_client_loader.add(SecretsManagerClientLoader.airflow.value)
def _() -> Optional["GCPCredentials"]:
    from airflow.configuration import conf

    from metadata.generated.schema.security.credentials.gcpCredentials import (
        GCPCredentials,
        gcpValues,
    )

    project_id = conf.get(SECRET_MANAGER_AIRFLOW_CONF, "project_id", fallback=None)
    if project_id:
        config = gcpValues.GcpCredentialsValues(projectId=project_id)
        credentials = GCPCredentials(gcpConfig=config)
        return credentials

    return None


@secrets_manager_client_loader.add(SecretsManagerClientLoader.env.value)
def _() -> Optional["GCPCredentials"]:
    from metadata.generated.schema.security.credentials.gcpCredentials import (
        GCPCredentials,
        gcpValues,
    )

    # https://google-auth.readthedocs.io/en/master/reference/google.auth.html#google.auth.default
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
    if project_id:
        config = gcpValues.GcpCredentialsValues(projectId=project_id)
        credentials = GCPCredentials(gcpConfig=config)
        return credentials

    return None


class GCPSecretsManager(ExternalSecretsManager, ABC):
    """
    Secrets Manager Implementation Class
    """

    def __init__(self, loader: SecretsManagerClientLoader):
        super().__init__(SecretsManagerProvider.gcp, loader=loader)

    def get_string_value(self, secret_id: str) -> str:
        """
        Access the payload for the given secret version if one exists. The version
        can be a version number as a string (e.g. "5") or an alias (e.g. "latest").
        """

        # Create the Secret Manager client.
        client = secretmanager.SecretManagerServiceClient()

        # Build the resource name of the secret version.

        project_id = self.credentials.gcpConfig.projectId.root
        secret_id = (
            f"projects/{project_id}/secrets/{secret_id}/versions/{FIXED_VERSION_ID}"
        )

        # Access the secret version.
        response = client.access_secret_version(request={"name": secret_id})

        # Verify payload checksum.
        crc32c = google_crc32c.Checksum()
        crc32c.update(response.payload.data)
        if response.payload.data_crc32c != int(crc32c.hexdigest(), 16):
            raise ValueError("Data corruption detected.")

        # Print the secret payload.
        #
        # WARNING: Do not print the secret in a production environment - this
        # snippet is showing how to access the secret material.
        return response.payload.data.decode("UTF-8")

    def load_credentials(self) -> Optional["GCPCredentials"]:
        """Load the provider credentials based on the loader type"""
        try:
            loader_fn = secrets_manager_client_loader.registry.get(self.loader.value)
            return loader_fn()
        except Exception as err:
            raise SecretsManagerConfigException(f"Error loading credentials - [{err}]")
