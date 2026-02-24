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
import logging
import time
import uuid

import pytest

from metadata.generated.schema.api.data.createGlossary import CreateGlossaryRequest
from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.automations.workflow import Workflow
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.messagingService import MessagingService
from metadata.generated.schema.entity.services.mlmodelService import MlModelService
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.generated.schema.entity.teams.user import AuthenticationMechanism, User
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.metadata import MetadataWorkflow

from ..conftest import _safe_delete
from ..containers import MySqlContainerConfigs, get_mysql_container
from ..integration_base import (
    METADATA_INGESTION_CONFIG_TEMPLATE,
    generate_name,
    get_create_entity,
    get_create_service,
)

logger = logging.getLogger(__name__)


def _safe_create_or_update(metadata, data, retries=3):
    """Create/update with retry logic to handle transient server errors under parallel load."""
    for attempt in range(retries):
        try:
            return metadata.create_or_update(data=data)
        except Exception:
            if attempt < retries - 1:
                logger.warning(
                    "Retry %d/%d: create_or_update %s",
                    attempt + 1,
                    retries,
                    type(data).__name__,
                )
                time.sleep(1 * (attempt + 1))
            else:
                raise


@pytest.fixture(scope="module")
def mysql_container():
    with get_mysql_container(
        MySqlContainerConfigs(container_name=str(uuid.uuid4()))
    ) as container:
        yield container


@pytest.fixture(scope="module")
def metadata_ingestion_bot(metadata):
    """
    Metadata client authenticated as ingestion-bot user.
    Required for tests that need to see password fields.
    """
    ingestion_bot = metadata.get_by_name(entity=User, fqn="ingestion-bot")
    ingestion_bot_auth = metadata.get_by_id(
        entity=AuthenticationMechanism, entity_id=ingestion_bot.id
    )

    config = metadata.config.model_copy(deep=True)
    config.securityConfig = OpenMetadataJWTClientConfig(
        jwtToken=ingestion_bot_auth.config.JWTToken
    )

    return OpenMetadata(config)


@pytest.fixture(scope="module")
def database_service(metadata):
    """Module-scoped DatabaseService for database-related tests."""
    service_name = generate_name()
    create_service = get_create_service(entity=DatabaseService, name=service_name)
    service_entity = metadata.create_or_update(data=create_service)

    yield service_entity

    _safe_delete(
        metadata,
        entity=DatabaseService,
        entity_id=service_entity.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def dashboard_service(metadata):
    """Module-scoped DashboardService for dashboard/chart tests."""
    service_name = generate_name()
    create_service = get_create_service(entity=DashboardService, name=service_name)
    service_entity = metadata.create_or_update(data=create_service)

    yield service_entity

    _safe_delete(
        metadata,
        entity=DashboardService,
        entity_id=service_entity.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def messaging_service(metadata):
    """Module-scoped MessagingService for topic tests."""
    service_name = generate_name()
    create_service = get_create_service(entity=MessagingService, name=service_name)
    service_entity = metadata.create_or_update(data=create_service)

    yield service_entity

    _safe_delete(
        metadata,
        entity=MessagingService,
        entity_id=service_entity.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def pipeline_service(metadata):
    """Module-scoped PipelineService for pipeline tests."""
    service_name = generate_name()
    from metadata.generated.schema.entity.services.pipelineService import (
        PipelineService,
    )

    create_service = get_create_service(entity=PipelineService, name=service_name)
    service_entity = metadata.create_or_update(data=create_service)

    yield service_entity

    _safe_delete(
        metadata,
        entity=PipelineService,
        entity_id=service_entity.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def storage_service(metadata):
    """Module-scoped StorageService for container tests."""
    service_name = generate_name()
    create_service = get_create_service(entity=StorageService, name=service_name)
    service_entity = metadata.create_or_update(data=create_service)

    yield service_entity

    _safe_delete(
        metadata,
        entity=StorageService,
        entity_id=service_entity.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture(scope="module")
def mlmodel_service(metadata):
    """Module-scoped MlModelService for ML model tests."""
    service_name = generate_name()
    create_service = get_create_service(entity=MlModelService, name=service_name)
    service_entity = metadata.create_or_update(data=create_service)

    yield service_entity

    _safe_delete(
        metadata,
        entity=MlModelService,
        entity_id=service_entity.id,
        recursive=True,
        hard_delete=True,
    )


@pytest.fixture
def tables(database_service, metadata):
    database: Database = metadata.create_or_update(
        data=get_create_entity(entity=Database, reference=database_service.name.root)
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
def workflow(metadata, database_service, mysql_container):
    service_name = database_service.name.root

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
            _safe_delete(
                metadata, entity=Glossary, entity_id=glossary.id, hard_delete=True
            )

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
            _safe_delete(
                metadata,
                entity=GlossaryTerm,
                entity_id=glossary_term.id,
                hard_delete=True,
            )

    yield _create_glossary_term

    teardown()


@pytest.fixture
def create_user(metadata, request):
    """
    Factory fixture for creating users with automatic cleanup.
    Usage:
        user = create_user()  # Default test user with random name
        user = create_user(CreateUserRequest(...))  # Custom user
    """
    users = []

    def _create_user(create_request=None):
        if create_request is None:
            user_name = generate_name()
            create_request = CreateUserRequest(
                name=user_name, email=f"{user_name.root}@test.com"
            )

        user = metadata.create_or_update(data=create_request)
        users.append(user)
        return user

    def teardown():
        for user in users:
            _safe_delete(metadata, entity=User, entity_id=user.id, hard_delete=True)

    request.addfinalizer(teardown)

    return _create_user


@pytest.fixture
def create_database(metadata, request):
    """
    Factory fixture for creating databases with automatic cleanup.
    Usage: database = create_database(CreateDatabaseRequest(...))
    """
    databases = []

    def _create_database(create_request):
        database = metadata.create_or_update(data=create_request)
        databases.append(database)
        return database

    def teardown():
        for database in databases:
            _safe_delete(
                metadata, entity=Database, entity_id=database.id, hard_delete=True
            )

    request.addfinalizer(teardown)

    return _create_database


@pytest.fixture
def create_dashboard(metadata, request):
    """
    Factory fixture for creating dashboards with automatic cleanup.
    Usage: dashboard = create_dashboard(CreateDashboardRequest(...))
    """
    dashboards = []

    def _create_dashboard(create_request):
        dashboard = metadata.create_or_update(data=create_request)
        dashboards.append(dashboard)
        return dashboard

    def teardown():
        for dashboard in dashboards:
            _safe_delete(
                metadata, entity=Dashboard, entity_id=dashboard.id, hard_delete=True
            )

    request.addfinalizer(teardown)

    return _create_dashboard


@pytest.fixture
def create_chart(metadata, request):
    """
    Factory fixture for creating charts with automatic cleanup.
    Usage: chart = create_chart(CreateChartRequest(...))
    """
    charts = []

    def _create_chart(create_request):
        chart = metadata.create_or_update(data=create_request)
        charts.append(chart)
        return chart

    def teardown():
        for chart in charts:
            _safe_delete(metadata, entity=Chart, entity_id=chart.id, hard_delete=True)

    request.addfinalizer(teardown)

    return _create_chart


@pytest.fixture
def create_table(metadata, request):
    """
    Factory fixture for creating tables with automatic cleanup.
    Usage: table = create_table(CreateTableRequest(...))
    """
    tables = []

    def _create_table(create_request):
        table = metadata.create_or_update(data=create_request)
        tables.append(table)
        return table

    def teardown():
        for table in tables:
            _safe_delete(metadata, entity=Table, entity_id=table.id, hard_delete=True)

    request.addfinalizer(teardown)

    return _create_table


@pytest.fixture
def create_topic(metadata, request):
    """
    Factory fixture for creating topics with automatic cleanup.
    Usage: topic = create_topic(CreateTopicRequest(...))
    """
    topics = []

    def _create_topic(create_request):
        topic = metadata.create_or_update(data=create_request)
        topics.append(topic)
        return topic

    def teardown():
        for topic in topics:
            _safe_delete(metadata, entity=Topic, entity_id=topic.id, hard_delete=True)

    request.addfinalizer(teardown)

    return _create_topic


@pytest.fixture
def create_pipeline(metadata, request):
    """
    Factory fixture for creating pipelines with automatic cleanup.
    Usage: pipeline = create_pipeline(CreatePipelineRequest(...))
    """
    from metadata.generated.schema.entity.data.pipeline import Pipeline

    pipelines = []

    def _create_pipeline(create_request):
        pipeline = metadata.create_or_update(data=create_request)
        pipelines.append(pipeline)
        return pipeline

    def teardown():
        for pipeline in pipelines:
            _safe_delete(
                metadata, entity=Pipeline, entity_id=pipeline.id, hard_delete=True
            )

    request.addfinalizer(teardown)

    return _create_pipeline


@pytest.fixture
def create_container(metadata, request):
    """
    Factory fixture for creating containers with automatic cleanup.
    Usage: container = create_container(CreateContainerRequest(...))
    """
    from metadata.generated.schema.entity.data.container import Container

    containers = []

    def _create_container(create_request):
        container = metadata.create_or_update(data=create_request)
        containers.append(container)
        return container

    def teardown():
        for container in containers:
            _safe_delete(
                metadata, entity=Container, entity_id=container.id, hard_delete=True
            )

    request.addfinalizer(teardown)

    return _create_container


@pytest.fixture
def create_mlmodel(metadata, request):
    """
    Factory fixture for creating ML models with automatic cleanup.
    Usage: mlmodel = create_mlmodel(CreateMlModelRequest(...))
    """
    from metadata.generated.schema.entity.data.mlmodel import MlModel

    mlmodels = []

    def _create_mlmodel(create_request):
        mlmodel = metadata.create_or_update(data=create_request)
        mlmodels.append(mlmodel)
        return mlmodel

    def teardown():
        for mlmodel in mlmodels:
            _safe_delete(
                metadata, entity=MlModel, entity_id=mlmodel.id, hard_delete=True
            )

    request.addfinalizer(teardown)

    return _create_mlmodel


@pytest.fixture
def create_workflow(metadata_ingestion_bot, request):
    """
    Factory fixture for creating workflows with automatic cleanup.
    Usage: workflow = create_workflow(CreateWorkflowRequest(...))
    Note: Uses metadata_ingestion_bot for authentication.
    """
    workflows = []

    def _create_workflow(create_request):
        workflow = metadata_ingestion_bot.create_or_update(data=create_request)
        workflows.append(workflow)
        return workflow

    def teardown():
        for workflow in workflows:
            _safe_delete(
                metadata_ingestion_bot,
                entity=Workflow,
                entity_id=workflow.id,
                hard_delete=True,
            )

    request.addfinalizer(teardown)

    return _create_workflow
