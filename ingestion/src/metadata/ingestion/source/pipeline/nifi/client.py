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
Client to interact with Nifi apis
"""
import traceback
from typing import Any, Iterable, List, Optional

import requests
from requests import HTTPError

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

IDENTIFIER = "identifier"
PROCESS_GROUPS_STARTER = "/process-groups/"
RESOURCES = "resources"
REQUESTS_TIMEOUT = 60 * 5


class NifiClient:
    """
    Wrapper on top of Nifi REST API
    """

    def __init__(
        self, host_port: str, username: str, password: str, verify: bool = False
    ):
        self._token = None
        self._resources = None

        self.username = username
        self.password = password
        self.verify = verify
        self.api_endpoint = host_port + "/nifi-api"

        self.content_headers = {"Content-Type": "application/x-www-form-urlencoded"}
        self.headers = {"Authorization": f"Bearer {self.token}", **self.content_headers}

    @property
    def token(self) -> str:
        """
        Get the token on the fly if it
        has not been initialized yet
        """
        if not self._token:
            try:
                res = requests.post(
                    f"{self.api_endpoint}/access/token",
                    verify=self.verify,
                    headers=self.content_headers,
                    data=f"username={self.username}&password={self.password}",
                    timeout=REQUESTS_TIMEOUT,
                )
                self._token = res.text

            except HTTPError as err:
                logger.error(
                    f"Connection error retrieving the Bearer Token to access Nifi - {err}"
                )
                raise err

            except ValueError as err:
                logger.error(f"Cannot pick up the token from token response - {err}")
                raise err

        return self._token

    @property
    def resources(self) -> List[dict]:
        """
        This can be expensive. Only query it once.
        """
        if not self._resources:
            self._resources = self.get(RESOURCES)  # API endpoint

        # Get the first `resources` key from the dict
        return self._resources.get(RESOURCES)  # Dict key

    def get(self, path: str) -> Optional[Any]:
        """
        GET call wrapper
        """
        try:
            res = requests.get(
                f"{self.api_endpoint}/{path}",
                verify=self.verify,
                headers=self.headers,
                timeout=REQUESTS_TIMEOUT,
            )

            return res.json()

        except HTTPError as err:
            logger.warning(f"Connection error calling the Nifi API - {err}")
            logger.debug(traceback.format_exc())

        except ValueError as err:
            logger.warning(f"Cannot pick up the JSON from API response - {err}")
            logger.debug(traceback.format_exc())

        except Exception as err:
            logger.warning(f"Unknown error calling Nifi API - {err}")
            logger.debug(traceback.format_exc())

        return None

    def _get_process_group_ids(self) -> List[str]:
        return [
            elem.get(IDENTIFIER).replace(PROCESS_GROUPS_STARTER, "")
            for elem in self.resources
            if elem.get(IDENTIFIER).startswith(PROCESS_GROUPS_STARTER)
        ]

    def get_process_group(self, id_: str) -> dict:
        return self.get(f"flow/process-groups/{id_}")

    def list_process_groups(self) -> Iterable[dict]:
        """
        This will call the API endpoints
        one at a time.
        """
        for id_ in self._get_process_group_ids():
            yield self.get_process_group(id_=id_)
