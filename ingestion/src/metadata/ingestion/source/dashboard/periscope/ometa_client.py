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
Python API REST wrapper and helpers
"""
import datetime
import time
import traceback
from typing import Callable, Dict, List, Optional, Union

import requests
from requests.exceptions import HTTPError

from metadata.config.common import ConfigModel
from metadata.ingestion.ometa.credentials import URL, get_api_version
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class RetryException(Exception):
    """
    API Client retry exception
    """


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
        """
        Return error code
        """
        return self._error["code"]

    @property
    def status_code(self):
        """
        Return response status code

        Returns:
             int
        """
        http_error = self._http_error
        if http_error is not None and hasattr(http_error, "response"):
            return http_error.response.status_code

        return None

    @property
    def request(self):
        """
        Handle requests error
        """
        if self._http_error is not None:
            return self._http_error.request

        return None

    @property
    def response(self):
        """
        Handle response error
        :return:
        """
        if self._http_error is not None:
            return self._http_error.response

        return None


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
    auth_token: Optional[Callable] = None
    access_token: Optional[str] = None
    expires_in: Optional[int] = None
    auth_header: Optional[str] = None
    extra_headers: Optional[dict] = None
    raw_data: Optional[bool] = False
    allow_redirects: Optional[bool] = False
    auth_token_mode: Optional[str] = "Bearer"
    verify: Optional[Union[bool, str]] = None


class REST:
    """
    REST client wrapper to manage requests with
    retries, auth and error handling.
    """

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
        self._auth_token_mode = self.config.auth_token_mode
        self._verify = self.config.verify

    def _request(
        self,
        method,
        path,
        data: dict =None,
        base_url: URL = None,
        api_version: str = None,
        headers: dict = None,
    ):
        # pylint: disable=too-many-locals
        if not headers:
            headers = {"Content-type": "application/json"}
        base_url = base_url or self._base_url
        version = api_version if api_version else ""
        url: URL = URL(base_url + "/" + version + path)
        if (
            self.config.expires_in
            and datetime.datetime.utcnow().timestamp() >= self.config.expires_in
            or not self.config.access_token
        ):
            self.config.access_token, expiry = self._auth_token()
            if not self.config.access_token == "no_token":
                if isinstance(expiry, datetime.datetime):
                    self.config.expires_in = expiry.timestamp() - 120
                else:
                    self.config.expires_in = (
                        datetime.datetime.utcnow().timestamp() + expiry - 120
                    )

        headers[self.config.auth_header] = (
            f"{self._auth_token_mode} {self.config.access_token}"
            if self._auth_token_mode
            else self.config.access_token
        )

        # Merge extra headers if provided.
        # If a header value is provided in modulo string format and matches an existing header,
        # the value will be set to that value.
        # Example: "Proxy-Authorization": "%(Authorization)s"
        # This will result in the Authorization value being set for the Proxy-Authorization Extra Header
        if self.config.extra_headers:
            extra_headers: Dict[str, str] = self.config.extra_headers
            headers = {**headers, **extra_headers}

        opts = {
            "headers": headers,
            # Since we allow users to set endpoint URL via env var,
            # human error to put non-SSL endpoint could exploit
            # uncanny issues in non-GET request redirecting http->https.
            # It's better to fail early if the URL isn't right.
            "allow_redirects": self.config.allow_redirects,
            "verify": self._verify,
        }

        method_key = "params" if method.upper() == "GET" else "data"
        opts[method_key] = data

        total_retries = self._retry if self._retry > 0 else 0
        retry = total_retries
        while retry >= 0:
            try:
                return self._one_request(method, url, opts, retry)
            except RetryException:
                retry_wait = self._retry_wait * (total_retries - retry + 1)
                logger.warning(
                    "sleep %s seconds and retrying %s %s more time(s)...",
                    retry_wait,
                    url,
                    retry,
                )
                time.sleep(retry_wait)
                retry -= 1
        return None

    def _one_request(self, method: str, url: URL, opts: dict, retry: int):
        """
        Perform one request, possibly raising RetryException in the case
        the response is 429. Otherwise, if error text contain "code" string,
        then it decodes to json object and returns APIError.
        Returns the body json in the 200 status.
        """
        retry_codes = self._retry_codes
        try:
            resp = self._session.request(method, url, **opts)
            resp.raise_for_status()

            if resp.text != "":
                try:
                    return resp.json()
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(
                        f"Unexpected error while returning response {resp} in json format - {exc}"
                    )

        except HTTPError as http_error:
            # retry if we hit Rate Limit
            if resp.status_code in retry_codes and retry > 0:
                raise RetryException() from http_error
            if "code" in resp.text:
                error = resp.json()
                if "code" in error:
                    raise APIError(error, http_error) from http_error
            else:
                raise
        except requests.ConnectionError as conn:
            # Trying to solve https://github.com/psf/requests/issues/4664
            try:
                return self._session.request(method, url, **opts).json()
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Unexpected error while retrying after a connection error - {exc}"
                )
                raise conn
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unexpected error calling [{url}] with method [{method}]: {exc}"
            )

        return None

    def get(self, path, data=None):
        """
        GET method

        Parameters:
            path (str):
            data ():

        Returns:
            Response
        """
        return self._request("GET", path, data)

    def post(self, path, data=None):
        """
        POST method

        Parameters:
            path (str):
            data ():

        Returns:
            Response
        """
        return self._request("POST", path, data)

    def put(self, path, data=None):
        """
        PUT method

        Parameters:
            path (str):
            data ():

        Returns:
            Response
        """
        return self._request("PUT", path, data)

    def patch(self, path, data=None):
        """
        PATCH method

        Parameters:
            path (str):
            data ():

        Returns:
            Response
        """
        return self._request(
            method="PATCH",
            path=path,
            data=data,
            headers={"Content-type": "application/json-patch+json"},
        )

    def delete(self, path, data=None):
        """
        DELETE method

        Parameters:
            path (str):
            data ():

        Returns:
            Response
        """
        return self._request("DELETE", path, data)

    def __enter__(self):
        return self

    def close(self):
        """
        Close requests session
        """
        self._session.close()

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
