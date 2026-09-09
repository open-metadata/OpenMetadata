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
Mixin class containing Server and client specific methods

To be used by OpenMetadata class
"""

from typing import Optional

import requests
from requests.exceptions import JSONDecodeError

from metadata.__version__ import (
    get_client_version,
    get_server_version_from_string,
    match_versions,
)
from metadata.generated.schema.settings.settings import Settings, SettingType
from metadata.ingestion.ometa.client import REST, HtmlResponseError, is_html_body
from metadata.ingestion.ometa.routes import ROUTES
from metadata.utils.logger import ometa_logger

logger = ometa_logger()

VERSION_PATH = "/system/version"

# `REST` cannot say this - connectors use it against third-party APIs - but here we
# know the target is an OpenMetadata server, whose UI answers index.html for unknown
# routes. A `hostPort` missing `/api` therefore lands on the UI with a 200.
HOST_PORT_HINT = (
    "The OpenMetadata UI answers index.html for unknown routes, so `hostPort` most likely"
    " does not point at the API: check that it ends in `/api` (e.g. https://<host>/api)."
)


class VersionMismatchException(Exception):  # noqa: N818
    """
    Used when server and client versions do not match
    """


class VersionNotFoundException(Exception):  # noqa: N818
    """
    Used when server doesn't return a version
    """


class OMetaServerMixin:
    """
    OpenMetadata API methods related to the Pipeline Entity

    To be inherited by OpenMetadata
    """

    client: REST

    @property
    def server_version(self) -> str:
        """
        Server version property
        """
        if not hasattr(self, "_server_version") or self._server_version is None:
            self._server_version = self.get_server_version()
        return self._server_version

    @property
    def client_version(self) -> str:
        """
        Client version property
        """
        if not hasattr(self, "_client_version") or self._client_version is None:
            self._client_version = get_client_version()
        return self._client_version

    def get_server_version(self) -> str:
        """
        Run endpoint /system/version to check server version
        :return: Server version
        """
        response = self.client.get_raw(VERSION_PATH)
        return get_server_version_from_string(self._read_version(response))

    @staticmethod
    def _read_version(response: Optional[requests.Response]) -> str:  # noqa: UP045
        """Pull `version` out of a /system/version response, or say why we can't.

        This is the first call every workflow makes, so it is where a wrong
        `hostPort`, a bad token or an unreachable API shows up. Each case gets its
        own message - the generic path used to end in a `TypeError` several frames
        away from the actual misconfiguration.
        """
        if response is None:
            # `_request` returns None once the 504/429 retry budget is exhausted.
            raise VersionNotFoundException(
                f"No response from {VERSION_PATH} after exhausting the retry budget."
                " The server is unreachable or persistently returning 429/504."
            )
        url = response.url
        if response.status_code in (401, 403):
            raise VersionNotFoundException(
                f"Not authorized to read [{url}] (HTTP {response.status_code})."
                " Check the JWT token / auth provider set in `workflowConfig.openMetadataServerConfig`"
                " and that the bot user is still active."
            )
        if response.status_code == 404:
            raise VersionNotFoundException(
                f"No OpenMetadata API found at [{url}] (HTTP 404)."
                " Check `hostPort` and `apiVersion` in `workflowConfig.openMetadataServerConfig`."
            )
        if not response.ok:
            raise VersionNotFoundException(
                f"Cannot read the server version from [{url}] (HTTP {response.status_code}): {response.text[:500]}"
            )

        try:
            payload = response.json()
        except JSONDecodeError as exc:
            # `get_raw` skips the client's JSON handling, so classify the body here,
            # with the same sniffing the client uses.
            if is_html_body(response):
                raise HtmlResponseError(url, response.status_code, hint=HOST_PORT_HINT) from exc
            raise VersionNotFoundException(
                f"The response from [{url}] is not JSON"
                f" (content type [{response.headers.get('Content-Type', 'unknown')}]): {response.text[:500]}"
            ) from exc

        if not isinstance(payload, dict) or "version" not in payload:
            raise VersionNotFoundException(
                f"No `version` field in the response from [{url}]: {str(payload)[:500]}."
                " If running the server in DEV mode locally, make sure to `mvn clean install`."
            )
        return payload["version"]

    def validate_versions(self) -> None:
        """
        Validate Server & Client versions. They should match.
        Otherwise, raise VersionMismatchException.
        """
        if not match_versions(self.server_version, self.client_version):
            major_minor = ".".join(self.server_version.split(".")[:2])
            raise VersionMismatchException(
                f"Server version is {self.server_version} vs. Client version {self.client_version}."
                f" Major and minor versions should match. Either install the matching client with"
                f" `pip install 'openmetadata-ingestion~={major_minor}.0'` or point `hostPort` at a"
                f" {self.client_version} server."
            )

    def log_server_version(self) -> None:
        """Emit the server/client version line."""
        logger.info(
            "OpenMetadata client running with Server version [%s] and Client version [%s]",
            self.server_version,
            self.client_version,
        )

    def create_or_update_settings(self, settings: Settings) -> Settings:
        """Create of update setting

        Args:
            settings (Settings): setting to update or create

        Returns:
            Settings
        """
        data = settings.model_dump_json()
        response = self.client.put(ROUTES.get(Settings.__name__), data)
        return Settings.model_validate(response)

    def get_settings_by_name(self, setting_type: SettingType) -> Optional[Settings]:  # noqa: UP045
        """Get setting by name

        Returns:
            Settings
        """
        response = self.client.get(f"{ROUTES.get(Settings.__name__)}/{setting_type.value}")
        if not response:
            return None
        return Settings.model_validate(response)

    def get_profiler_config_settings(self) -> Optional[Settings]:  # noqa: UP045
        """Get profiler config setting

        Returns:
            Settings
        """
        response = self.client.get("/system/settings/profilerConfiguration")
        if not response:
            return None
        return Settings.model_validate(response)
