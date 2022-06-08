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
Credentials helper module
"""
import json
import os
import tempfile

from metadata.generated.schema.security.credentials.gcsCredentials import (
    GCSCredentials,
    GCSCredentialsPath,
    GCSValues,
)
from metadata.utils.logger import utils_logger

logger = utils_logger()

GOOGLE_CREDENTIALS = "GOOGLE_APPLICATION_CREDENTIALS"


class InvalidGcsConfigException(Exception):
    """
    Raised when we have errors trying to set GCS credentials
    """


def create_credential_tmp_file(credentials: dict) -> str:
    """
    Given a credentials' dict, store it in a tmp file
    :param credentials: dictionary to store
    :return: path to find the file
    """
    with tempfile.NamedTemporaryFile(delete=False) as fp:
        cred_json = json.dumps(credentials, indent=4, separators=(",", ": "))
        fp.write(cred_json.encode())

        return fp.name


def set_google_credentials(gcs_credentials: GCSCredentials) -> None:
    """
    Set GCS credentials environment variable
    :param gcs_credentials: GCSCredentials
    """
    if os.environ.get(GOOGLE_CREDENTIALS):
        return

    if isinstance(gcs_credentials.gcsConfig, GCSCredentialsPath):
        os.environ[GOOGLE_CREDENTIALS] = str(gcs_credentials.gcsConfig.__root__)
        return
    if gcs_credentials.gcsConfig.projectId is None:
        logger.info(
            "No credentials available, using the current environment permissions authenticated via gcloud SDK ."
        )
        return
    if isinstance(gcs_credentials.gcsConfig, GCSValues):
        credentials_dict = {
            "type": gcs_credentials.gcsConfig.type,
            "project_id": gcs_credentials.gcsConfig.projectId,
            "private_key_id": gcs_credentials.gcsConfig.privateKeyId,
            "private_key": gcs_credentials.gcsConfig.privateKey.get_secret_value(),
            "client_email": gcs_credentials.gcsConfig.clientEmail,
            "client_id": gcs_credentials.gcsConfig.clientId,
            "auth_uri": str(gcs_credentials.gcsConfig.authUri),
            "token_uri": str(gcs_credentials.gcsConfig.tokenUri),
            "auth_provider_x509_cert_url": str(
                gcs_credentials.gcsConfig.authProviderX509CertUrl
            ),
            "client_x509_cert_url": str(gcs_credentials.gcsConfig.clientX509CertUrl),
        }

        tmp_credentials_file = create_credential_tmp_file(credentials=credentials_dict)
        os.environ[GOOGLE_CREDENTIALS] = tmp_credentials_file
        return

    raise InvalidGcsConfigException(
        f"Error trying to set GCS credentials with {gcs_credentials}."
        " Check https://docs.open-metadata.org/connectors/bigquery"
    )
