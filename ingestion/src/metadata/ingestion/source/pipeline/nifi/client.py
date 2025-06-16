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
Client to interact with Nifi apis
"""
import traceback
from typing import Dict, Iterable, List

from metadata.generated.schema.entity.services.connections.pipeline.nifi.basicAuth import (
    NifiBasicAuth,
)
from metadata.generated.schema.entity.services.connections.pipeline.nifi.clientCertificateAuth import (
    NifiClientCertificateAuth,
)
from metadata.generated.schema.entity.services.connections.pipeline.nifiConnection import (
    NifiConnection,
)
from metadata.ingestion.ometa.client import REST, ClientConfig, HTTPError
from metadata.utils.constants import AUTHORIZATION_HEADER, NO_ACCESS_TOKEN
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

IDENTIFIER = "identifier"
PROCESS_GROUPS_STARTER = "/process-groups/"
RESOURCES = "resources"
REQUESTS_TIMEOUT = 60 * 5
CONTENT_HEADER = {"Content-type": "application/x-www-form-urlencoded"}
NIFI_API_BASE_ENDPOINT = "/nifi-api"


class NifiClient:
    """
    Wrapper on top of Nifi REST API
    """

    client: REST

    def __init__(self, connection: NifiConnection):
        self.connection = connection
        self._token, self._resources, self.data = None, None, None
        self.api_endpoint = clean_uri(self.connection.hostPort) + NIFI_API_BASE_ENDPOINT

        client_config = ClientConfig(
            api_version="",
            timeout=REQUESTS_TIMEOUT,
            base_url=self.api_endpoint,
            extra_headers=CONTENT_HEADER,
        )

        if isinstance(self.connection.nifiConfig, NifiBasicAuth):
            self.verify = self.connection.nifiConfig.verifySSL
            self.data = {
                "username": self.connection.nifiConfig.username,
                "password": self.connection.nifiConfig.password.get_secret_value()
                if self.connection.nifiConfig.password
                else None,
            }
            client_config.verify = self.connection.nifiConfig.verifySSL
            client_config.auth_header = AUTHORIZATION_HEADER
            client_config.access_token = self.token

            self.client = REST(client_config)
        elif isinstance(self.connection.nifiConfig, NifiClientCertificateAuth):
            ca_path = self.connection.nifiConfig.certificateAuthorityPath
            cc_path = self.connection.nifiConfig.clientCertificatePath
            ck_path = self.connection.nifiConfig.clientkeyPath

            client_config.verify = ca_path if ca_path else False
            client_config.cert = (cc_path, ck_path)

            self.client = REST(client_config)
            access = self.client.get("access")
            logger.debug(access)

    @property
    def token(self) -> str:
        """
        Get the token on the fly if it
        has not been initialized yet
        """
        if not self._token:
            try:
                client = REST(
                    ClientConfig(
                        base_url=self.api_endpoint,
                        verify=self.verify,
                        extra_headers=CONTENT_HEADER,
                        timeout=REQUESTS_TIMEOUT,
                        api_version="",
                        auth_token_mode=None,
                        auth_token=lambda: (NO_ACCESS_TOKEN, 0),
                    )
                )

                res = client.post("access/token", data=self.data)
                self._token = res.text

                if res.status_code not in (200, 201):
                    raise HTTPError(res.text)

            except HTTPError as err:
                logger.error(
                    f"Connection error retrieving the Bearer Token to access Nifi - {err}"
                )
                raise err

            except ValueError as err:
                logger.error(f"Cannot pick up the token from token response - {err}")
                raise err

            except Exception as err:
                logger.error(f"Fetching token failed due to - {err}")
                logger.debug(traceback.format_exc())
                raise err

        return self._token

    @property
    def resources(self) -> List[dict]:
        """
        This can be expensive. Only query it once.
        """
        if not self._resources:
            self._resources = self.client.get(RESOURCES)  # API endpoint

        # Get the first `resources` key from the dict
        try:
            return self._resources.get(RESOURCES)  # Dict key
        except AttributeError:
            return []

    def _get_process_group_ids(self) -> List[str]:
        return [
            elem.get(IDENTIFIER).replace(PROCESS_GROUPS_STARTER, "")
            for elem in self.resources
            if elem.get(IDENTIFIER).startswith(PROCESS_GROUPS_STARTER)
        ]

    def get_process_group(self, id_: str) -> Dict:
        return self.client.get(f"flow/process-groups/{id_}")

    def list_process_groups(self) -> Iterable[Dict]:
        """
        This will call the API endpoints
        one at a time.
        """
        for id_ in self._get_process_group_ids():
            try:
                yield self.get_process_group(id_=id_)
            except Exception:
                logger.debug(traceback.format_exc())

    def test_list_process_groups(self):
        """
        test api access for process group
        """
        for id_ in self._get_process_group_ids():
            self.get_process_group(id_=id_)
            break
