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

import logging
import time
from enum import Enum
from typing import List, Optional

import requests
from requests.exceptions import HTTPError

from metadata.config.common import ConfigModel
from metadata.ingestion.ometa.credentials import URL, get_api_version

logger = logging.getLogger(__name__)


class RetryException(Exception):
    pass


class APIError(Exception):
    """
    Represent API related error.
    error.status_code will have http status code.
    """

    def __init__(self, error, http_error=None):
        super().__init__(error["message"])
        self._error = error
        self._http_error = http_error

    @property
    def code(self):
        return self._error["code"]

    @property
    def status_code(self):
        http_error = self._http_error
        if http_error is not None and hasattr(http_error, "response"):
            return http_error.response.status_code

    @property
    def request(self):
        if self._http_error is not None:
            return self._http_error.request

    @property
    def response(self):
        if self._http_error is not None:
            return self._http_error.response


class TimeFrame(Enum):
    Day = "1Day"
    Hour = "1Hour"
    Minute = "1Min"
    Sec = "1Sec"


class ClientConfig(ConfigModel):
    """
    :param raw_data: should we return api response raw or wrap it with
                         Entity objects.
    """

    base_url: str
    api_version: Optional[str] = "v1"
    retry: Optional[int] = 3
    retry_wait: Optional[int] = 30
    retry_codes: List[int] = [429, 504]
    auth_token: Optional[str] = None
    auth_header: Optional[str] = None
    raw_data: Optional[bool] = False
    allow_redirects: Optional[bool] = False


class REST(object):
    def __init__(self, config: ClientConfig):
        self.config = config
        self._base_url: URL = URL(self.config.base_url)
        self._api_version = get_api_version(self.config.api_version)
        self._session = requests.Session()
        self._use_raw_data = self.config.raw_data
        self._retry = self.config.retry
        self._retry_wait = self.config.retry_wait
        self._retry_codes = self.config.retry_codes
        self._auth_token = self.config.auth_token

    def _request(
        self, method, path, data=None, base_url: URL = None, api_version: str = None
    ):
        base_url = base_url or self._base_url
        version = api_version if api_version else self._api_version
        url: URL = URL(base_url + "/" + version + path)
        headers = {"Content-type": "application/json"}
        if self._auth_token is not None and self._auth_token != "no_token":
            headers[self.config.auth_header] = self._auth_token
        opts = {
            "headers": headers,
            # Since we allow users to set endpoint URL via env var,
            # human error to put non-SSL endpoint could exploit
            # uncanny issues in non-GET request redirecting http->https.
            # It's better to fail early if the URL isn't right.
            "allow_redirects": self.config.allow_redirects,
        }
        if method.upper() == "GET":
            opts["params"] = data
        else:
            opts["data"] = data

        total_retries = self._retry if self._retry > 0 else 0
        retry = total_retries
        while retry >= 0:
            try:
                logger.debug("URL {}, method {}".format(url, method))
                logger.debug("Data {}".format(opts))
                return self._one_request(method, url, opts, retry)
            except RetryException:
                retry_wait = self._retry_wait * (total_retries - retry + 1)
                logger.warning(
                    "sleep {} seconds and retrying {} "
                    "{} more time(s)...".format(retry_wait, url, retry)
                )
                time.sleep(retry_wait)
                retry -= 1

    def _one_request(self, method: str, url: URL, opts: dict, retry: int):
        """
        Perform one request, possibly raising RetryException in the case
        the response is 429. Otherwise, if error text contain "code" string,
        then it decodes to json object and returns APIError.
        Returns the body json in the 200 status.
        """
        retry_codes = self._retry_codes
        resp = self._session.request(method, url, **opts)
        try:
            resp.raise_for_status()
        except HTTPError as http_error:
            # retry if we hit Rate Limit
            if resp.status_code in retry_codes and retry > 0:
                raise RetryException()
            if "code" in resp.text:
                error = resp.json()
                if "code" in error:
                    raise APIError(error, http_error)
            else:
                raise
        if resp.text != "":
            return resp.json()
        return None

    def get(self, path, data=None):
        return self._request("GET", path, data)

    def post(self, path, data=None):
        return self._request("POST", path, data)

    def put(self, path, data=None):
        return self._request("PUT", path, data)

    def patch(self, path, data=None):
        return self._request("PATCH", path, data)

    def delete(self, path, data=None):
        return self._request("DELETE", path, data)

    def __enter__(self):
        return self

    def close(self):
        self._session.close()

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
