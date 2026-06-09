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
Python API REST wrapper and helpers
"""

import time
import traceback
from contextlib import nullcontext
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Union  # noqa: UP035

import requests
from requests.exceptions import HTTPError, JSONDecodeError

from metadata.config.common import ConfigModel
from metadata.ingestion import diagnostics
from metadata.ingestion.diagnostics.collectors.http import get_global_tracker
from metadata.ingestion.ometa.credentials import URL, get_api_version
from metadata.ingestion.ometa.http_adapter import mount_resilient_adapter
from metadata.ingestion.ometa.ttl_cache import TTLCache
from metadata.ingestion.ometa.utils import sanitize_user_agent
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class RetryException(Exception):  # noqa: N818
    """
    API Client retry exception
    """


class LimitsException(Exception):  # noqa: N818
    """
    API Client Feature Limit exception
    """


class RestTransportError(Exception):
    """Request failed at the transport layer (connection / timeout / retry exhaustion)."""

    def __init__(self, method: str, url: object, cause: BaseException) -> None:
        super().__init__(f"Transport failure on {method} {url}: {cause}")
        self.method = method
        self.url = url
        self.cause = cause


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
    api_version: Optional[str] = "v1"  # noqa: UP045
    retry: Optional[int] = 3  # noqa: UP045
    retry_wait: Optional[int] = 30  # noqa: UP045
    limit_codes: List[int] = [429]  # noqa: RUF012, UP006
    retry_codes: List[int] = [504]  # noqa: RUF012, UP006
    auth_token: Optional[Callable] = None  # noqa: UP045
    access_token: Optional[str] = None  # noqa: UP045
    expires_in: Optional[int] = None  # noqa: UP045
    auth_header: Optional[str] = None  # noqa: UP045
    extra_headers: Optional[dict] = None  # noqa: UP045
    user_agent: Optional[str] = None  # noqa: UP045
    raw_data: Optional[bool] = False  # noqa: UP045
    allow_redirects: Optional[bool] = False  # noqa: UP045
    auth_token_mode: Optional[str] = "Bearer"  # noqa: UP045
    verify: Optional[Union[bool, str]] = None  # noqa: UP007, UP045
    cookies: Optional[Any] = None  # noqa: UP045
    ttl_cache: int = 60
    # (connect, read) seconds. Default prevents indefinite hangs when a pooled
    # socket is silently severed (NAT/LB idle reaping). Override with None to
    # disable, or pass a single int to use the same value for both.
    timeout: Optional[int | tuple[int, int]] = (10, 300)  # noqa: UP045
    cert: Optional[Union[str, tuple]] = None  # noqa: UP007, UP045


# pylint: disable=too-many-instance-attributes
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
        mount_resilient_adapter(self._session)
        user_agent = sanitize_user_agent(self.config.user_agent)
        if user_agent:
            self._session.headers["User-Agent"] = user_agent
        elif self.config.user_agent:
            logger.debug(
                f"Ignoring User-Agent {self.config.user_agent!r}: no header-safe characters remained after sanitization"
            )
        self._use_raw_data = self.config.raw_data
        self._retry = self.config.retry
        self._retry_wait = self.config.retry_wait
        self._retry_codes = self.config.retry_codes
        self._limit_codes = self.config.limit_codes
        self._auth_token = self.config.auth_token
        self._auth_token_mode = self.config.auth_token_mode
        self._verify = self.config.verify
        self._cookies = self.config.cookies
        self._cert = self.config.cert
        self._timeout = self.config.timeout

        self._limits_reached = TTLCache(config.ttl_cache)

    def _request(  # noqa: C901, pylint: disable=too-many-arguments,too-many-branches
        self,
        method: str,
        path: str,
        data: Any = None,
        json: Any = None,
        base_url: Optional[URL] = None,  # noqa: UP045
        api_version: Optional[str] = None,  # noqa: UP045
        headers: Optional[dict] = None,  # noqa: UP045
        timeout: Optional[Union[float, tuple[float, float]]] = None,  # noqa: UP007, UP045
        retries: Optional[int] = None,  # noqa: UP045
        return_response: bool = False,
    ):
        # pylint: disable=too-many-locals
        if path in self._limits_reached:
            raise LimitsException(f"Skipping request - limits reached for {path}")

        if not headers:
            headers = {"Content-type": "application/json"}
        base_url = base_url or self._base_url
        version = api_version if api_version else self._api_version
        url: URL = URL(base_url + "/" + version + path)
        cookies = self._cookies
        if (
            self.config.expires_in  # noqa: RUF021
            and datetime.now(timezone.utc).timestamp() >= self.config.expires_in
            or not self.config.access_token  # noqa: RUF021
            and self._auth_token
        ):
            self.config.access_token, expiry = self._auth_token()
            if not self.config.access_token == "no_token":  # noqa: SIM201
                if isinstance(expiry, datetime):
                    self.config.expires_in = expiry.timestamp() - 120
                else:
                    self.config.expires_in = datetime.now(timezone.utc).timestamp() + expiry - 120

        if self.config.auth_header:
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
        # Any header which is comming as extra header from client will overwrite the header with same name in headers
        if self.config.extra_headers:
            extra_headers: Dict[str, str] = self.config.extra_headers  # noqa: UP006
            extra_headers = {k: (v % headers) for k, v in extra_headers.items()}
            headers = {**headers, **extra_headers}

        opts = {
            "headers": headers,
            # Since we allow users to set endpoint URL via env var,
            # human error to put non-SSL endpoint could exploit
            # uncanny issues in non-GET request redirecting http->https.
            # It's better to fail early if the URL isn't right.
            "allow_redirects": self.config.allow_redirects,
            "verify": self._verify,
            "cookies": cookies,
        }

        method_key = "params" if method.upper() == "GET" else "data"
        opts[method_key] = data
        if json:
            opts["json"] = json

        if self._cert:
            opts["cert"] = self._cert

        effective_timeout = timeout if timeout is not None else self._timeout
        if effective_timeout:
            opts["timeout"] = effective_timeout

        # Per-call `retries` override takes precedence over the client
        # config. `_retry` / `_retry_wait` are Optional in ClientConfig;
        # narrow to plain ints here so the loop body type-checks cleanly.
        total_retries: int
        if retries is not None:
            total_retries = retries if retries > 0 else 0
        else:
            total_retries = self._retry if self._retry and self._retry > 0 else 0
        retry: int = total_retries
        retry_wait_base: int = self._retry_wait or 0
        http_tracker = get_global_tracker()
        http_cm = http_tracker.request(method, url) if http_tracker is not None else nullcontext()
        op_cm = diagnostics.operation("ometa.http", method=method, url=str(url))
        with http_cm, op_cm:
            while retry >= 0:
                try:
                    return self._one_request(method, url, opts, retry, return_response=return_response)
                except LimitsException as exc:
                    logger.error(f"Feature limit exceeded for {url}")
                    self._limits_reached.add(path)
                    raise exc  # noqa: TRY201
                except RetryException:
                    retry_wait = retry_wait_base * (total_retries - retry + 1)
                    logger.warning(
                        "sleep %s seconds and retrying %s %s more time(s)...",
                        retry_wait,
                        url,
                        retry,
                    )
                    time.sleep(retry_wait)
                    retry -= 1
                    if retry == 0:
                        logger.error(f"No more retries left for {url}")
                        traceback.format_exc()
            return None

    def _one_request(self, method: str, url: URL, opts: dict, retry: int, return_response: bool = False):
        """
        Perform one request, possibly raising RetryException in the case
        the response is 429. Otherwise, if error text contain "code" string,
        then it decodes to json object and returns APIError.
        Returns the body json in the 200 status, or the raw response when
        ``return_response`` is set (used to read headers such as ETag).
        """
        retry_codes = self._retry_codes
        limit_codes = self._limit_codes

        try:
            resp = self._session.request(method, url, **opts)
            resp.raise_for_status()

            if return_response:
                return resp

            if resp.text != "":
                try:
                    return resp.json()
                except JSONDecodeError as json_decode_error:
                    logger.debug(
                        "Non-JSON response (%s) returned as-is: %s",
                        resp.status_code,
                        json_decode_error,
                    )
                    return resp
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.warning(f"Unexpected error while returning response {resp} in json format - {exc}")

        except HTTPError as http_error:
            # retry if we hit Rate Limit
            if resp.status_code in retry_codes and retry > 0:
                raise RetryException() from http_error
            if resp.status_code in limit_codes:
                raise LimitsException() from http_error
            if "code" in resp.text:
                error = resp.json()
                if "code" in error:
                    raise APIError(error, http_error) from http_error
            else:
                raise
        except (
            requests.exceptions.ConnectionError,
            requests.exceptions.Timeout,
            requests.exceptions.RetryError,
            requests.exceptions.ChunkedEncodingError,
        ) as exc:
            logger.warning("Transport failure calling [%s] with method [%s]: %s", url, method, exc)
            raise RestTransportError(method, url, exc) from exc
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Unexpected error calling [{url}] with method [{method}]: {exc}")

        return None

    def get(self, path, data=None, headers=None):
        """
        GET method

        Parameters:
            path (str):
            data ():
            headers (dict): Optional custom headers to override default headers

        Returns:
            Response
        """
        return self._request("GET", path, data, headers=headers)

    def post(
        self,
        path: str,
        data: Any = None,
        json: Any = None,
        headers: Optional[dict] = None,  # noqa: UP045
        timeout: Optional[Union[float, tuple[float, float]]] = None,  # noqa: UP007, UP045
        retries: Optional[int] = None,  # noqa: UP045
    ):
        """
        POST method

        Parameters:
            path (str):
            data ():
            json ():
            headers (dict): Optional custom headers to override default headers
            timeout: Per-call timeout that overrides the instance default
            retries: Per-call retry budget that overrides the instance default.
                     Pass 0 to disable the retry/sleep loop entirely.

        Returns:
            Response
        """
        return self._request(
            "POST",
            path,
            data,
            json,
            headers=headers,
            timeout=timeout,
            retries=retries,
        )

    def post_best_effort(
        self,
        path: str,
        data: Any = None,
        headers: Optional[dict] = None,  # noqa: UP045
        timeout: Optional[Union[float, tuple[float, float]]] = None,  # noqa: UP007, UP045
    ) -> bool:
        """Quiet POST: no retries, no sleep, no logging. Returns True on 2xx."""
        if path in self._limits_reached:
            return False
        try:
            url = URL(self._base_url + "/" + self._api_version + path)
            req_headers = self._build_request_headers(headers)
            kwargs = {
                "data": data,
                "headers": req_headers,
                "verify": self._verify,
                "cookies": self._cookies,
                "allow_redirects": self.config.allow_redirects,
            }
            effective_timeout = timeout if timeout is not None else self._timeout
            if effective_timeout:
                kwargs["timeout"] = effective_timeout
            if self._cert:
                kwargs["cert"] = self._cert
            resp = self._session.post(url, **kwargs)
        except Exception:
            return False
        return 200 <= resp.status_code < 300

    def _build_request_headers(self, headers: Optional[dict] = None):  # noqa: UP045
        """Reader-only headers builder. Does NOT refresh auth token —
        refresh stays on _request() to avoid concurrent refreshes from
        post_best_effort callers sharing ClientConfig."""
        if not headers:
            headers = {"Content-type": "application/json"}
        if self.config.auth_header and self.config.access_token:
            headers[self.config.auth_header] = (
                f"{self._auth_token_mode} {self.config.access_token}"
                if self._auth_token_mode
                else self.config.access_token
            )
        if self.config.extra_headers:
            extra_headers: Dict[str, str] = self.config.extra_headers  # noqa: UP006
            extra_headers = {k: (v % headers) for k, v in extra_headers.items()}
            headers = {**headers, **extra_headers}
        return headers

    def put(self, path, data=None, json=None, headers=None):
        """
        PUT method

        Parameters:
            path (str):
            data ():
            json ():
            headers (dict): Optional custom headers to override default headers

        Returns:
            Response
        """
        return self._request("PUT", path, data, json=json, headers=headers)

    def patch(self, path, data=None, headers=None):
        """
        PATCH method

        Parameters:
            path (str):
            data ():
            headers (dict): Optional extra headers (e.g. ``If-Match`` for
                optimistic-concurrency-safe writes) merged on top of the
                JSON Patch content type.

        Returns:
            Response
        """
        request_headers = {"Content-type": "application/json-patch+json"}
        if headers:
            request_headers.update(headers)
        return self._request(
            method="PATCH",
            path=path,
            data=data,
            headers=request_headers,
        )

    def get_etag(self, path) -> Optional[str]:  # noqa: UP045
        """Return the current ETag header for an entity GET.

        Used to drive optimistic-concurrency (``If-Match``) writes so a
        concurrent modification is rejected with HTTP 412 instead of silently
        overwriting it. Returns ``None`` if the server emitted no ETag.
        """
        resp = self._request("GET", path, return_response=True)
        return resp.headers.get("ETag") if resp is not None else None

    def delete(self, path, data=None, headers=None):
        """
        DELETE method

        Parameters:
            path (str):
            data ():
            headers (dict): Optional custom headers to override default headers

        Returns:
            Response
        """
        return self._request("DELETE", path, data, headers=headers)

    def __enter__(self):
        return self

    def close(self):
        """
        Close requests session
        """
        self._session.close()

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
