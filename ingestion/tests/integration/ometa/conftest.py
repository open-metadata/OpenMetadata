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

"""Automations integration tests"""
import json
import uuid

import pytest

from metadata.generated.schema.api.data.createGlossary import CreateGlossaryRequest
from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.teams.user import User
from metadata.workflow.metadata import MetadataWorkflow

from ..containers import MySqlContainerConfigs, get_mysql_container
from ..integration_base import (
    METADATA_INGESTION_CONFIG_TEMPLATE,
    generate_name,
    get_create_entity,
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


@pytest.fixture
def tables(service, metadata):
    database: Database = metadata.create_or_update(
        data=get_create_entity(entity=Database, reference=service.name.root)
    )
    db_schema: DatabaseSchema = metadata.create_or_update(
        data=get_create_entity(
            entity=DatabaseSchema, reference=database.fullyQualifiedName
        )
    )
    tables = [
        metadata.create_or_update(
            data=get_create_entity(entity=Table, reference=db_schema.fullyQualifiedName)
        )
        for _ in range(10)
    ]

    return tables


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
            ).model_dump_json(mask_secrets=False),
            source_config={},
        )
    )
    workflow_config["ingestionPipelineFQN"] = f"{service_name}.ingestion"
    return MetadataWorkflow.create(workflow_config)


@pytest.fixture
def create_glossary(metadata):
    glossaries = []

    def _create_glossary(create_request: CreateGlossaryRequest):
        glossary = metadata.create_or_update(data=create_request)
        glossaries.append(glossary)
        return glossary

    def teardown():
        for glossary in glossaries:
            metadata.delete(entity=Glossary, entity_id=glossary.id, hard_delete=True)

    yield _create_glossary

    teardown()


@pytest.fixture
def create_glossary_term(metadata, create_glossary):
    glossary_terms = []

    def _create_glossary_term(create_request: CreateGlossaryTermRequest):
        glossary_term = metadata.create_or_update(data=create_request)

        glossary_terms.append(glossary_term)
        return glossary_term

    def teardown():
        glossary_terms.reverse()
        for glossary_term in glossary_terms:
            metadata.delete(
                entity=GlossaryTerm, entity_id=glossary_term.id, hard_delete=True
            )

    yield _create_glossary_term

    teardown()


@pytest.fixture
def create_user(metadata, request):
    users = []

    def _create_user(create_request: CreateUserRequest):
        user = metadata.create_or_update(data=create_request)
        users.append(user)
        return user

    def teardown():
        for user in users:
            metadata.delete(entity=User, entity_id=user.id, hard_delete=True)

    request.addfinalizer(teardown)

    return _create_user
