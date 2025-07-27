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
from dataclasses import dataclass
from functools import singledispatch
from typing import Optional

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
    S3Config,
)
from metadata.generated.schema.entity.services.connections.database.deltalake.metastoreConfig import (
    MetastoreConfig,
)
from metadata.generated.schema.entity.services.connections.database.deltalake.storageConfig import (
    StorageConfig,
)
from metadata.generated.schema.entity.services.connections.database.deltaLakeConnection import (
    DeltaLakeConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN


@dataclass
class DeltalakeClient:
    def __init__(self, client, config) -> None:
        self.client = client
        self.config = config


@singledispatch
def get_deltalake_client(connection, config):
    """Retrieve Deltalake Client from the config"""
    msg = None
    if config:
        msg = f"Config not implemented for type {type(connection)}: {connection}"
    raise NotImplementedError(msg)


@get_deltalake_client.register
def _(connection: MetastoreConfig, config: DeltaLakeConnection):
    from metadata.ingestion.source.database.deltalake.clients.pyspark import (
        DeltalakePySparkClient,
    )

    return DeltalakePySparkClient.from_config(config)


@get_deltalake_client.register
def _(connection: StorageConfig, config: DeltaLakeConnection):
    from metadata.ingestion.source.database.deltalake.clients.s3 import (
        DeltalakeS3Client,
    )

    if isinstance(connection.connection, S3Config):
        return DeltalakeS3Client.from_config(config)


def get_connection(connection: DeltaLakeConnection) -> DeltalakeClient:
    """Create Deltalake Client"""
    return DeltalakeClient(
        client=get_deltalake_client(connection.configSource, connection),
        config=connection,
    )


def test_connection(
    metadata: OpenMetadata,
    connection: DeltalakeClient,
    service_connection: DeltaLakeConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    test_fn = {
        "GetDatabases": connection.client.get_test_get_databases_fn(
            service_connection.configSource
        ),
        "GetTables": connection.client.get_test_get_tables_fn(
            service_connection.configSource
        ),
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
