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
YDB connection handler
"""

import json
from typing import Optional
from urllib.parse import quote_plus

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.ydb.metadataCredentials import (
    MetadataCredentials,
)
from metadata.generated.schema.entity.services.connections.database.ydb.noCredentials import (
    NoCredentials,
)
from metadata.generated.schema.entity.services.connections.database.ydb.serviceAccountCredentials import (
    ServiceAccountCredentials,
)
from metadata.generated.schema.entity.services.connections.database.ydb.staticCredentials import (
    StaticCredentials,
)
from metadata.generated.schema.entity.services.connections.database.ydb.tokenCredentials import (
    TokenCredentials,
)
from metadata.generated.schema.entity.services.connections.database.ydbConnection import (
    YDBConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    get_connection_args_common,
    get_connection_options_dict,
)
from metadata.ingestion.connections.test_connections import test_connection_db_common
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN


def get_connection_url(connection: YDBConnection) -> str:
    database = connection.database if connection.database.startswith("/") else f"/{connection.database}"
    url = f"{connection.scheme.value}://{connection.hostPort}{database}"
    options = get_connection_options_dict(connection)
    if options:
        params = "&".join(f"{quote_plus(str(key))}={quote_plus(str(value))}" for key, value in options.items() if value)
        if params:
            url = f"{url}?{params}"
    return url


def _get_credentials(auth_type):
    if auth_type is None or isinstance(auth_type, NoCredentials):
        return None
    if isinstance(auth_type, StaticCredentials):
        return {
            "username": auth_type.username,
            "password": auth_type.password.get_secret_value(),
        }
    if isinstance(auth_type, TokenCredentials):
        return {"token": auth_type.token.get_secret_value()}
    if isinstance(auth_type, ServiceAccountCredentials):
        try:
            service_account_json = json.loads(auth_type.serviceAccountJson.get_secret_value())
        except json.JSONDecodeError as exc:
            raise ValueError(f"Service Account JSON is not valid JSON: {exc}") from exc
        return {"service_account_json": service_account_json}
    if isinstance(auth_type, MetadataCredentials):
        import ydb.iam  # pylint: disable=import-outside-toplevel  # noqa: PLC0415

        return ydb.iam.MetadataUrlCredentials()
    return None


def get_connection(connection: YDBConnection) -> Engine:
    connect_args = dict(get_connection_args_common(connection))

    if connection.protocol:
        connect_args["protocol"] = connection.protocol.value

    credentials = _get_credentials(connection.authType)
    if credentials is not None:
        connect_args["credentials"] = credentials

    if connection.caCertificate:
        connect_args["root_certificates"] = connection.caCertificate.get_secret_value().encode("utf-8")

    return create_engine(
        get_connection_url(connection),
        connect_args=connect_args,
    )


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: YDBConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,  # noqa: UP045
    timeout_seconds: Optional[int] = THREE_MIN,  # noqa: UP045
) -> TestConnectionResult:
    return test_connection_db_common(
        metadata=metadata,
        engine=engine,
        service_connection=service_connection,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
