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

"""Automations integration tests"""
import json
import uuid

import pytest

from _openmetadata_testutils.containers import (
    MySqlContainerConfigs,
    get_mysql_container,
)
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.workflow.metadata import MetadataWorkflow

from ..integration_base import (
    METADATA_INGESTION_CONFIG_TEMPLATE,
    generate_name,
    get_create_service,
)


@pytest.fixture(scope="module")
def mysql_container():
    with get_mysql_container(
        MySqlContainerConfigs(container_name=str(uuid.uuid4()))
    ) as container:
        yield container


@pytest.fixture(scope="module")
def service(metadata):
    service_name = generate_name()
    create_service = get_create_service(entity=DatabaseService, name=service_name)
    yield metadata.create_or_update(data=create_service)

    service_id = str(
        metadata.get_by_name(entity=DatabaseService, fqn=service_name).id.root
    )

    metadata.delete(
        entity=DatabaseService,
        entity_id=service_id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def workflow(metadata, service, mysql_container):
    service_name = service.name.root

    workflow_config = json.loads(
        METADATA_INGESTION_CONFIG_TEMPLATE.format(
            type="mysql",
            service_name=service_name,
            service_config=MysqlConnection(
                username=mysql_container.username,
                authType=BasicAuth(
                    password=mysql_container.password,
                ),
                hostPort=f"localhost:{mysql_container.get_exposed_port(3306)}",
            ).model_dump_json(),
            source_config={},
        )
    )
    workflow_config["ingestionPipelineFQN"] = f"{service_name}.ingestion"
    return MetadataWorkflow.create(workflow_config)
