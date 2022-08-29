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
Mixin class containing Server and client specific methods

To be used by OpenMetadata class
"""
import re

try:
    from importlib.metadata import version
except ImportError:
    from importlib_metadata import version

from metadata.ingestion.ometa.client import REST
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class VersionParsingException(Exception):
    """
    Used when we cannot parse version information from a string
    """


class VersionMismatchException(Exception):
    """
    Used when server and client versions do not match
    """


class OMetaServerMixin:
    """
    OpenMetadata API methods related to the Pipeline Entity

    To be inherited by OpenMetadata
    """

    client: REST

    @staticmethod
    def get_version_from_string(raw_version: str) -> str:
        """
        Given a raw version string, such as `0.10.1.dev0` or
        `0.11.0-SNAPSHOT`, we should extract the major.minor.patch
        :param raw_version: raw string with version info
        :return: Clean version string
        """
        try:
            return re.match(r"\d+.\d+.\d+", raw_version).group(0)
        except AttributeError as err:
            raise VersionParsingException(
                f"Can't extract version from {raw_version}: {err}"
            )

    def get_server_version(self) -> str:
        """
        Run endpoint /version to check server version
        :return: Server version
        """
        raw_version = self.client.get("/version")["version"]
        return self.get_version_from_string(raw_version)

    def get_client_version(self) -> str:
        """
        Get openmetadata-ingestion module version
        :return: client version
        """
        raw_version = version("openmetadata-ingestion")
        return self.get_version_from_string(raw_version)

    def validate_versions(self) -> None:
        """
        Validate Server & Client versions. They should match.
        Otherwise, raise VersionMismatchException
        """
        logger.debug("Validating client and server versions")

        server_version = self.get_server_version()
        client_version = self.get_client_version()

        if server_version != client_version:
            raise VersionMismatchException(
                f"Server version is {server_version} vs. Client version {client_version}. Both should match."
            )
