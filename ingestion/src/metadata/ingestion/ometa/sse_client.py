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
from logging import Logger
from typing import Any, Generator

import httpx

from metadata.ingestion.ometa.client import ClientConfig
from metadata.ingestion.ometa.credentials import URL
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
        self, method: str, path: str, data: None | dict[str, Any] = None
    ) -> Generator[Any, Any, None]:
        """Connect to the SSE stream and yield events.

        Args:
            method (str): The HTTP method to use.
            path (str): The path to the SSE stream.

        Returns:
            Generator[Any, Any, None]: A generator of events.
        """
        self.stream_completed = False
        retries = 0

        url: URL = URL(
            self.config.base_url + "/" + (self.config.api_version or "v1") + path
        )
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

                with httpx.Client(timeout=None) as client:
                    with client.stream(
                        method,
                        url,
                        headers=headers,
                        json=opts.get("json"),
                        params=opts.get("params"),
                    ) as response:
                        response.raise_for_status()
                        self.logger.info("Connected to SSE stream")

                        event_buffer = []
                        for line in response.iter_lines():
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
                            else:
                                if not line.startswith(":"):
                                    event_buffer.append(line)

            except httpx.HTTPStatusError as e:
                self.logger.error(f"HTTP error: {e.response.status_code}")
                raise
            except Exception as e:
                retries += 1
                self.logger.error(
                    f"Connection error (retry {retries}/{self.max_retries}): {e}"
                )

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
            self.config.expires_in
            and datetime.now(timezone.utc).timestamp() >= self.config.expires_in
            or not self.config.access_token
        ):
            self.config.access_token, expiry = self.config.auth_token()
            if not self.config.access_token == "no_token":
                if isinstance(expiry, datetime):
                    self.config.expires_in = expiry.timestamp() - 120
                else:
                    self.config.expires_in = (
                        datetime.now(timezone.utc).timestamp() + expiry - 120
                    )
