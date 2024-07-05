import logging
import sys

import pytest

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.workflow import LogLevels
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.ingestion import IngestionWorkflow

if not sys.version_info >= (3, 9):
    collect_ignore = ["trino"]


@pytest.fixture(scope="session", autouse=True)
def configure_logging():
    logging.getLogger("sqlfluff").setLevel(logging.CRITICAL)
    logging.getLogger("pytds").setLevel(logging.CRITICAL)


@pytest.fixture()
def metadata():
    return int_admin_ometa()


def pytest_pycollect_makeitem(collector, name, obj):
    try:
        bases = [base.__name__ for base in obj.mro()]
        for cls in ("BaseModel", "Enum"):
            if cls in bases:
                return []
    except (AttributeError, TypeError):
        pass


@pytest.fixture(scope="session", autouse=sys.version_info >= (3, 9))
def config_testcontatiners():
    from testcontainers.core.config import testcontainers_config

    testcontainers_config.max_tries = 10


@pytest.fixture()
def sink_config(metadata):
    return {
        "type": "metadata-rest",
        "config": {},
    }


@pytest.fixture()
def workflow_config(metadata):
    return {
        "loggerLevel": LogLevels.DEBUG.value,
        "openMetadataServerConfig": metadata.config.dict(),
    }


@pytest.fixture()
def profiler_config(db_service, workflow_config, sink_config):
    return {
        "source": {
            "type": db_service.connection.config.type.value.lower(),
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": "Profiler",
                    "generateSampleData": True,
                }
            },
        },
        "processor": {
            "type": "orm-profiler",
            "config": {},
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


@pytest.fixture()
def run_workflow():
    def _run(workflow_type: type(IngestionWorkflow), config, raise_from_status=True):
        workflow: IngestionWorkflow = workflow_type.create(config)
        workflow.execute()
        if raise_from_status:
            workflow.raise_from_status()
        return workflow

    return _run


@pytest.fixture()
def db_service(metadata, create_service_request, patch_password):
    service_entity = metadata.create_or_update(data=create_service_request)
    fqn = service_entity.fullyQualifiedName.root
    yield patch_password(service_entity)
    service_entity = metadata.get_by_name(DatabaseService, fqn)
    if service_entity:
        metadata.delete(
            DatabaseService, service_entity.id, recursive=True, hard_delete=True
        )


@pytest.fixture()
def patch_password():
    """Implement in the test module to override the password for a specific service

    Example:
    def patch_password(service: DatabaseService, my_contianer):
        service.connection.config.authType.password = SecretStr(my_contianer.password)
        return service
    return patch_password
    """
    raise NotImplementedError("Implement in the test module")


@pytest.fixture()
def patch_passwords_for_db_services(db_service, patch_password, monkeypatch):
    def override_password(getter):
        def inner(*args, **kwargs):
            result = getter(*args, **kwargs)
            if isinstance(result, DatabaseService):
                if result.fullyQualifiedName.root == db_service.fullyQualifiedName.root:
                    return patch_password(result)
            return result

        return inner

    monkeypatch.setattr(
        "metadata.ingestion.ometa.ometa_api.OpenMetadata.get_by_name",
        override_password(OpenMetadata.get_by_name),
    )

    monkeypatch.setattr(
        "metadata.ingestion.ometa.ometa_api.OpenMetadata.get_by_id",
        override_password(OpenMetadata.get_by_id),
    )
