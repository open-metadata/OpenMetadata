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
from pathlib import Path
from typing import Optional

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.db2Connection import (
    Db2Connection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_url_common,
)
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.db2.utils import (
    check_clidriver_version,
    install_clidriver,
)
from metadata.utils.constants import THREE_MIN, UTF_8
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


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

    # prepare license
    # pylint: disable=import-outside-toplevel
    if connection.license and connection.licenseFileName:
        import clidriver

        with open(
            Path(clidriver.__path__[0], "license", connection.licenseFileName),
            "w",
            encoding=UTF_8,
        ) as file:
            file.write(connection.license.encode(UTF_8).decode("unicode-escape"))

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
