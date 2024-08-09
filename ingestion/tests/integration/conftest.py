import logging
import sys
from typing import List, Tuple, Type

import pytest

from _openmetadata_testutils.ometa import int_admin_ometa
from ingestion.src.metadata.ingestion.api.common import Entity
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


@pytest.fixture(scope="session")
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
                    "timeoutSeconds": 30,
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
    def _run(workflow_type: Type[IngestionWorkflow], config, raise_from_status=True):
        workflow: IngestionWorkflow = workflow_type.create(config)
        workflow.execute()
        if raise_from_status:
            workflow.raise_from_status()
        return workflow

    return _run


@pytest.fixture(scope="module")
def db_service(metadata, create_service_request, unmask_password):
    service_entity = metadata.create_or_update(data=create_service_request)
    fqn = service_entity.fullyQualifiedName.root
    yield unmask_password(service_entity)
    service_entity = metadata.get_by_name(DatabaseService, fqn)
    if service_entity:
        metadata.delete(
            DatabaseService, service_entity.id, recursive=True, hard_delete=True
        )


@pytest.fixture(scope="module")
def unmask_password(create_service_request):
    """Unmask the db passwrod returned by the metadata service.
    You can override this at the test_module level to implement custom password handling.

    Example:
    @pytest.fixture(scope="module")
    def unmask_password(my_container1, my_container2):
        def patch_password(service: DatabaseService):
            if service.connection.config.authType.password == "my_password":
              ... # do something else
            return service
        return patch_password
    """

    def patch_password(service: DatabaseService):
        service.connection.config.authType.password = (
            create_service_request.connection.config.authType.password
        )
        return service

    return patch_password


@pytest.fixture(scope="module")
def create_service_request():
    """
    Implement in the test module to create a service request
    Example:
    def create_service_request(scope="module"):
        return CreateDatabaseServiceRequest(
            name="my_service",
            serviceType=DatabaseServiceType.MyService,
            connection=DatabaseConnection(
                config=MyServiceConnection(
                    username="my_user",
                    password="my_password",
                    host="localhost",
                    port="5432",
                )
            ),
        )
    """
    raise NotImplementedError("Implement in the test module")


@pytest.fixture()
def patch_passwords_for_db_services(db_service, unmask_password, monkeypatch):
    def override_password(getter):
        def inner(*args, **kwargs):
            result = getter(*args, **kwargs)
            if isinstance(result, DatabaseService):
                if result.fullyQualifiedName.root == db_service.fullyQualifiedName.root:
                    return unmask_password(result)
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


@pytest.fixture
def cleanup_fqns(metadata):
    fqns: List[Tuple[Type[Entity], str]] = []

    def inner(entity_type: Type[Entity], fqn: str):
        fqns.append((entity_type, fqn))

    yield inner
    for etype, fqn in fqns:
        entity = metadata.get_by_name(etype, fqn, fields=["*"])
        if entity:
            metadata.delete(etype, entity.id, recursive=True, hard_delete=True)
