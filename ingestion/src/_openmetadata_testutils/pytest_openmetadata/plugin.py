from typing import Type

import pytest

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.entity.teams.user import AuthenticationMechanism, User
from metadata.generated.schema.metadataIngestion.workflow import LogLevels
from metadata.ingestion.api.common import Entity
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.ingestion import IngestionWorkflow


@pytest.fixture(scope="session")
def metadata():
    return int_admin_ometa()


@pytest.fixture(scope="session")
def sink_config(metadata):
    return {
        "type": "metadata-rest",
        "config": {},
    }


@pytest.fixture(scope="session")
def workflow_config(metadata):
    return {
        "loggerLevel": LogLevels.DEBUG.value,
        "openMetadataServerConfig": metadata.config.model_dump(),
    }


@pytest.fixture(scope="session")
def ingestion_bot_wokflow_config(metadata, workflow_config):
    ingestion_bot: User = metadata.get_by_name(
        entity=User, fqn="ingestion-bot", nullable=False
    )
    ingestion_bot_auth: AuthenticationMechanism = metadata.get_by_id(
        entity=AuthenticationMechanism, entity_id=ingestion_bot.id, nullable=False
    )
    workflow_config = workflow_config.copy()
    workflow_config["openMetadataServerConfig"]["securityConfig"][
        "jwtToken"
    ] = ingestion_bot_auth.config.JWTToken
    return workflow_config


@pytest.fixture()
def clean_up_fqn(metadata):
    fqns = []

    def inner(entity_type: type[Entity], fqn: str):
        fqns.append((entity_type, fqn))

    yield inner
    for entity_type, fqn in fqns:
        entity = metadata.get_by_name(entity_type, fqn, fields=["*"])
        if entity:
            metadata.delete(entity_type, entity.id, recursive=True, hard_delete=True)


@pytest.fixture(scope="session")
def ingestion_bot_workflow_config(metadata: OpenMetadata):
    ingestion_bot: User = metadata.get_by_name(entity=User, fqn="ingestion-bot")
    ingestion_bot_auth: AuthenticationMechanism = metadata.get_by_id(
        entity=AuthenticationMechanism, entity_id=ingestion_bot.id
    )
    config = metadata.config.model_dump()
    config["securityConfig"]["jwtToken"] = ingestion_bot_auth.config.JWTToken
    return {
        "loggerLevel": LogLevels.DEBUG.value,
        "openMetadataServerConfig": config,
    }


@pytest.fixture(scope="module")
def run_workflow():
    def _run(workflow_type: Type[IngestionWorkflow], config, raise_from_status=True):
        workflow: IngestionWorkflow = workflow_type.create(config)
        workflow.execute()
        if raise_from_status:
            workflow.raise_from_status()
        return workflow

    return _run
