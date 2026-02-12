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
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import quote_plus

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.db2Connection import (
    Db2Connection,
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


def _get_ibmi_connection_url(connection: Db2Connection) -> str:
    """
    Build connection URL for ibmi scheme.

    sqlalchemy-ibmi validates URL options strictly and does NOT support:
    - Port in the URL (host:port format) — causes validation error
    - SSL parameters like SECURITY=SSL — SSL is negotiated via port (9471)

    Port is passed separately via connect_args.
    """
    hostname = connection.hostPort.split(":")[0]

    url = f"{connection.scheme.value}://"
    if connection.username:
        url += f"{quote_plus(connection.username)}"
        password = get_password_secret(connection)
        url += f":{quote_plus(password.get_secret_value())}"
        url += "@"
    url += hostname
    if connection.database:
        url += f"/{connection.database}"
    return url


def _get_ibmi_connection_args(connection: Db2Connection) -> Dict[str, Any]:
    """
    Build connection args for ibmi scheme.

    Port must be passed via connect_args since sqlalchemy-ibmi
    rejects it in the URL.
    """
    args = get_connection_args_common(connection)
    host_port = connection.hostPort
    if ":" in host_port:
        port_str = host_port.split(":")[1]
        try:
            args["port"] = int(port_str)
        except ValueError:
            raise ValueError(
                f"Invalid port in hostPort '{host_port}'. Expected format: 'hostname:port'"
            )
    return args


def get_connection(connection: Db2Connection) -> Engine:
    """
    Create connection
    """
    # Install ibm_db with specific version
    clidriver_version = connection.clidriverVersion

    if clidriver_version:
        clidriver_version = check_clidriver_version(clidriver_version)
        if clidriver_version:
            install_clidriver(clidriver_version.value)
            # Invalidate cached clidriver module so the next import
            # picks up the freshly installed path
            sys.modules.pop("clidriver", None)

    # prepare license
    # pylint: disable=import-outside-toplevel
    if connection.license and connection.licenseFileName:
        import clidriver

        if clidriver_version:
            importlib.reload(clidriver)

        license_dir = Path(clidriver.__path__[0], "license")
        license_dir.mkdir(parents=True, exist_ok=True)

        with open(
            license_dir / connection.licenseFileName,
            "w",
            encoding=UTF_8,
        ) as file:
            file.write(connection.license.encode(UTF_8).decode("unicode-escape"))

    is_ibmi = connection.scheme == Db2Scheme.ibmi

    # SSL setup only for db2+ibm_db scheme.
    # ibmi scheme negotiates SSL via port (9471), not connection params.
    if not is_ibmi:
        ssl_manager = check_ssl_and_init(connection)
        if ssl_manager:
            connection = ssl_manager.setup_ssl(connection)

    if is_ibmi:
        return create_generic_db_connection(
            connection=connection,
            get_connection_url_fn=_get_ibmi_connection_url,
            get_connection_args_fn=_get_ibmi_connection_args,
        )

    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url_common,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: Db2Connection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    return test_connection_db_common(
        metadata=metadata,
        engine=engine,
        service_connection=service_connection,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
