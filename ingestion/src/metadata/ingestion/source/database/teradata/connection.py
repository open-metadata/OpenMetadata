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
import enum
from typing import Optional
from urllib.parse import quote_plus

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.teradataConnection import (
    TeradataConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
)
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.teradata.queries import TERADATA_GET_DATABASE
from metadata.utils.constants import THREE_MIN


def get_connection_url(connection: TeradataConnection) -> str:
    """
    Create Teradtaa connection url
    """
    url = f"{connection.scheme.value}://{connection.hostPort}/"
    url += f"?user={quote_plus(connection.username)}"
    if connection.password:
        url += f"&password={quote_plus(connection.password.get_secret_value())}"

    # add standard options
    params = "&".join(
        [
            f"{key}={quote_plus(str(getattr(connection, key) if not isinstance(getattr(connection, key), enum.Enum) else getattr(connection, key).value))}"
            for key in ["account", "logdata", "logmech", "tmode"]
            if getattr(connection, key, None)
        ]
    )
    url = f"{url}&{params}"

    # add additional options if specified
    options = get_connection_options_dict(connection)
    if options:
        params = "&".join(
            f"{key}={quote_plus(str(value if not isinstance(value, enum.Enum) else value.value))}"
            for (key, value) in options.items()
            if value
        )
        url += f"{url}&{params}"

    return url


def get_connection(connection: TeradataConnection) -> Engine:
    """
    Create connection
    """
    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: TeradataConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    queries = {"GetDatabases": TERADATA_GET_DATABASE}

    return test_connection_db_common(
        metadata=metadata,
        engine=engine,
        service_connection=service_connection,
        automation_workflow=automation_workflow,
        queries=queries,
        timeout_seconds=timeout_seconds,
    )
