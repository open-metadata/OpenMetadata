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
Source connection handler
"""

import importlib
import sys
from abc import ABC
from pathlib import Path
from typing import Any, Optional
from urllib.parse import quote_plus

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.db2Connection import (
    Db2Connection as Db2ConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.db2Connection import (
    Db2Scheme,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_url_common,
    get_password_secret,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.strategies import ClientStrategy
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.db2.utils import (
    check_clidriver_version,
    install_clidriver,
)
from metadata.utils.constants import THREE_MIN, UTF_8
from metadata.utils.logger import ingestion_logger
from metadata.utils.ssl_manager import check_ssl_and_init

logger = ingestion_logger()


class Db2Strategy(ClientStrategy[Db2ConnectionConfig, Engine], ABC):
    """Builds the DB2 engine for one scheme."""


class Db2StandardStrategy(Db2Strategy):
    """db2+ibm_db scheme: standard URL with SSL negotiated via connection params."""

    def build(self) -> Engine:
        connection = self._connection
        ssl_manager = check_ssl_and_init(connection)
        if ssl_manager:
            connection = ssl_manager.setup_ssl(connection)
        return create_generic_db_connection(
            connection=connection,
            get_connection_url_fn=get_connection_url_common,
            get_connection_args_fn=get_connection_args_common,
        )


class Db2IbmiStrategy(Db2Strategy):
    """ibmi scheme: sqlalchemy-ibmi rejects the port in the URL, so the host is
    passed without it and the port goes through connect_args; SSL is negotiated
    by the port (9471) rather than connection parameters."""

    def build(self) -> Engine:
        return create_generic_db_connection(
            connection=self._connection,
            get_connection_url_fn=self.get_connection_url,
            get_connection_args_fn=self.get_connection_args,
        )

    @staticmethod
    def get_connection_url(connection: Db2ConnectionConfig) -> str:
        scheme = connection.scheme.value if connection.scheme else Db2Scheme.ibmi.value
        hostname = connection.hostPort.split(":")[0]
        url = f"{scheme}://"
        if connection.username:
            url += f"{quote_plus(connection.username)}"
            password = get_password_secret(connection)
            url += f":{quote_plus(password.get_secret_value())}"
            url += "@"
        url += hostname
        if connection.database:
            url += f"/{connection.database}"
        return url

    @staticmethod
    def get_connection_args(connection: Db2ConnectionConfig) -> dict[str, Any]:
        args = get_connection_args_common(connection)
        host_port = connection.hostPort
        if ":" in host_port:
            port_str = host_port.split(":")[1]
            try:
                args["port"] = int(port_str)
            except ValueError:
                raise ValueError(  # noqa: B904
                    f"Invalid port in hostPort '{host_port}'. Expected format: 'hostname:port'"
                )
        return args


class Db2Connection(BaseConnection[Db2ConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        connection = self.service_connection
        self._prepare_driver(connection)
        match connection.scheme:
            case Db2Scheme.ibmi:
                strategy: Db2Strategy = Db2IbmiStrategy(connection)
            case _:
                strategy = Db2StandardStrategy(connection)
        return strategy.build()

    @staticmethod
    def _prepare_driver(connection: Db2ConnectionConfig) -> None:
        """Install the pinned clidriver (if requested) and stage the license file."""
        clidriver_version = connection.clidriverVersion
        if clidriver_version:
            clidriver_version = check_clidriver_version(clidriver_version)
            if clidriver_version:
                install_clidriver(clidriver_version.value)
                # Invalidate cached clidriver module so the next import
                # picks up the freshly installed path
                sys.modules.pop("clidriver", None)

        if connection.license and connection.licenseFileName:
            # pylint: disable=import-outside-toplevel
            # clidriver is installed at runtime by install_clidriver above
            import clidriver  # noqa: PLC0415 # pyright: ignore[reportMissingImports]

            if clidriver_version:
                importlib.reload(clidriver)

            license_dir = Path(clidriver.__path__[0], "license")
            license_dir.mkdir(parents=True, exist_ok=True)

            with open(  # noqa: PTH123
                license_dir / connection.licenseFileName,
                "w",
                encoding=UTF_8,
            ) as file:
                file.write(connection.license.encode(UTF_8).decode("unicode-escape"))

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,  # noqa: UP045
        timeout_seconds: Optional[int] = THREE_MIN,  # noqa: UP045
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow
        """
        return test_connection_db_common(
            metadata=metadata,
            engine=self.client,
            service_connection=self.service_connection,
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )
