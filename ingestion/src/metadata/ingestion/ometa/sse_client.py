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
Python SSE Client wrapper and helpers
"""

import time
from datetime import datetime, timezone
from logging import Logger  # noqa: TC003
from typing import Any, Generator  # noqa: UP035

import requests

from metadata.ingestion.ometa.client import ClientConfig
from metadata.ingestion.ometa.credentials import URL
from metadata.ingestion.ometa.utils import sanitize_user_agent
from metadata.utils.logger import ometa_logger


class SSEClient:
    """SSE Client wrapper and helpers"""

    def __init__(self, config: ClientConfig, max_retries=5, retry_delay=2):
        self.config: ClientConfig = config
        self.max_retries: int = max_retries
        self.retry_delay: int = retry_delay
        self.last_event_id: None | str = None
        self.stream_completed: bool = False
        self.logger: Logger = ometa_logger()

    def stream(
        self,
        method: str,
        path: str,
        data: None | dict[str, Any] = None,
        timeout: None | float | tuple[float, float] = None,
    ) -> Generator[Any, Any, None]:
        """Connect to the SSE stream and yield events.

        Args:
            method (str): The HTTP method to use.
            path (str): The path to the SSE stream.
            data (dict | None): Request body sent as JSON for non-GET methods, or as
                query parameters for GET. Defaults to None (no body / no params).
            timeout (float | tuple[float, float] | None): Per-call timeout passed to
                ``requests``. ``None`` (the default) disables timeouts, which matches
                SSE semantics where streams can have long idle periods between events.
                Pass a single float to set both connect and read timeouts, or a
                ``(connect, read)`` tuple to set them independently.

        Returns:
            Generator[Any, Any, None]: A generator of events.
        """
        self.stream_completed = False
        retries = 0

        url: URL = URL(self.config.base_url + "/" + (self.config.api_version or "v1") + path)
        method = method.upper()
        headers = {
            "Accept": "text/event-stream",
            "Content-Type": "application/json",
            "Connection": "keep-alive",
            "Accept-Encoding": "gzip, deflate, br",
        }
        self._validate_access_token()
        if self.config.auth_header:
            headers[self.config.auth_header] = (
                f"{self.config.auth_token_mode} {self.config.access_token}"
                if self.config.auth_token_mode
                else self.config.access_token
            )
        user_agent = sanitize_user_agent(self.config.user_agent)
        if user_agent:
            headers["User-Agent"] = user_agent
        elif self.config.user_agent:
            self.logger.debug(
                f"Ignoring User-Agent {self.config.user_agent!r}: no header-safe characters remained after sanitization"
            )
        opts = {
            "headers": headers,
            "allow_redirects": self.config.allow_redirects,
            "verify": self.config.verify,
            "cookies": self.config.cookies,
        }

        method_key = "params" if method.upper() == "GET" else "json"
        if data:
            opts[method_key] = data

        while retries < self.max_retries and not self.stream_completed:
            try:
                if self.last_event_id:
                    headers["Last-Event-ID"] = self.last_event_id

                request_kwargs = {
                    "method": method,
                    "url": str(url),
                    "headers": headers,
                    "json": opts.get("json"),
                    "params": opts.get("params"),
                    "stream": True,
                    "timeout": timeout,
                    "verify": (self.config.verify if self.config.verify is not None else True),
                    "allow_redirects": (
                        self.config.allow_redirects if self.config.allow_redirects is not None else True
                    ),
                    "cookies": self.config.cookies,
                    "cert": self.config.cert,
                }
                with requests.Session() as session, session.request(**request_kwargs) as response:
                    response.raise_for_status()
                    self.logger.info("Connected to SSE stream")

                    event_buffer = []
                    for line in response.iter_lines(decode_unicode=True):
                        if not line:
                            if event_buffer:
                                parsed_event = self._parse_sse_event(event_buffer)
                                yield parsed_event
                                event_buffer = []

                                if self.stream_completed:
                                    self.logger.info(
                                        f"Stream terminated with event: {parsed_event.get('event', 'unknown')}"
                                    )
                                    return
                        else:  # noqa: PLR5501
                            if not line.startswith(":"):
                                event_buffer.append(line)

            except requests.exceptions.HTTPError as e:
                self.logger.error(f"HTTP error: {e.response.status_code}")
                raise
            except Exception as e:
                retries += 1
                self.logger.error(f"Connection error (retry {retries}/{self.max_retries}): {e}")

                if retries >= self.max_retries:
                    raise

                time.sleep(self.retry_delay * retries)

    def _parse_sse_event(self, event_buffer: list[str]) -> dict[str, Any]:
        """Parse the SSE event

        Args:
            event_buffer (list[str]): The event buffer.

        Returns:
            dict[str, Any]: The parsed event.
        """
        event: dict[str, Any] = {}
        for line in event_buffer:
            if line.startswith("event:"):
                event["event"] = line.split(":", 1)[1].strip()
                if "complete" in event["event"] or "error" in event["event"]:
                    self.stream_completed = True
            elif line.startswith("data:"):
                event["data"] = line.split(":", 1)[1].strip()
            elif line.startswith("id:"):
                event["id"] = line.split(":", 1)[1].strip()
                self.last_event_id = event["id"]
        return event

    def _validate_access_token(self):
        """Validate the access token

        Returns:
            None
        """
        if (
            self.config.expires_in  # noqa: RUF021
            and datetime.now(timezone.utc).timestamp() >= self.config.expires_in
            or not self.config.access_token
        ):
            self.config.access_token, expiry = self.config.auth_token()
            if not self.config.access_token == "no_token":  # noqa: SIM201
                if isinstance(expiry, datetime):
                    self.config.expires_in = expiry.timestamp() - 120
                else:
                    self.config.expires_in = datetime.now(timezone.utc).timestamp() + expiry - 120
