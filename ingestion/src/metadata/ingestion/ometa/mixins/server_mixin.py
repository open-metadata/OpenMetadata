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
from metadata.__version__ import get_client_version, get_version_from_string
from metadata.ingestion.ometa.client import REST
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class VersionMismatchException(Exception):
    """
    Used when server and client versions do not match
    """


class VersionNotFoundException(Exception):
    """
    Used when server doesn't return a version
    """


class OMetaServerMixin:
    """
    OpenMetadata API methods related to the Pipeline Entity

    To be inherited by OpenMetadata
    """

    client: REST

    def get_server_version(self) -> str:
        """
        Run endpoint /version to check server version
        :return: Server version
        """
        try:
            raw_version = self.client.get("/version")["version"]
        except KeyError:
            raise VersionNotFoundException("Cannot Find Version at api/v1/version")
        return get_version_from_string(raw_version)

    def validate_versions(self) -> None:
        """
        Validate Server & Client versions. They should match.
        Otherwise, raise VersionMismatchException
        """
        logger.debug("Validating client and server versions")

        server_version = self.get_server_version()
        client_version = get_client_version()

        if server_version != client_version:
            raise VersionMismatchException(
                f"Server version is {server_version} vs. Client version {client_version}. Both should match."
            )
