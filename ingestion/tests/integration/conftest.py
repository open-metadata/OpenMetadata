import logging
import time
from typing import List, Tuple, Type

import pytest

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.databaseServiceAutoClassificationPipeline import (
    AutoClassificationConfigType,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseMetadataConfigType,
)
from metadata.generated.schema.metadataIngestion.workflow import LogLevels
from metadata.ingestion.api.common import Entity
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.ingestion import IngestionWorkflow


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


@pytest.hookimpl(tryfirst=True)
def pytest_collection_modifyitems(config, items):
    """Auto-apply xdist_group markers based on source directory.

    This ensures all tests for a source (mysql, postgres, etc.) run in the
    SAME worker, allowing them to share module-scoped container fixtures.

    Examples:
        tests/integration/mysql/test_metadata.py      -> xdist_group("mysql_suite")
        tests/integration/postgres/test_metadata.py   -> xdist_group("postgres_suite")
        tests/integration/ometa/test_domains.py       -> xdist_group("ometa_suite")
    """
    for item in items:
        test_path = str(item.fspath)

        if "/integration/" in test_path:
            parts = test_path.split("/integration/")
            if len(parts) > 1:
                source_name = parts[1].split("/")[0]
                group_name = f"{source_name}_suite"
                item.add_marker(pytest.mark.xdist_group(group_name))


# TODO: Will be addressed when cleaning up integration tests.
#  Setting the max tries for testcontainers here has pitfalls,
#  the main one being that it cannot be changed through the recommended
#  way of using environment variables. The main problem is that
#  waiting_utils.py uses testcontainers_config.timeout as a default
#  value for the timeout. Therefore, if we want to effectively change
#  this value, we must do so before the module is imported,
#  which is a potential source of issues.


@pytest.fixture(scope="session", autouse=True)
def config_testcontatiners():
    try:
        from testcontainers.core.config import testcontainers_config
    except ModuleNotFoundError:

        class _TestContainerConfig:  # type: ignore[too-few-public-methods]
            max_tries = 10

        return _TestContainerConfig()

    testcontainers_config.max_tries = 10
    return testcontainers_config


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


@pytest.fixture(scope="module")
def profiler_config(db_service, workflow_config, sink_config):
    return {
        "source": {
            "type": db_service.connection.config.type.value.lower(),
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": "Profiler",
                    "timeoutSeconds": 600,
                    "threadCount": 1,  # easier for debugging
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


@pytest.fixture(scope="module")
def classifier_config(db_service, workflow_config, sink_config):
    return {
        "source": {
            "type": db_service.connection.config.type.value.lower(),
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": AutoClassificationConfigType.AutoClassification.value,
                    "storeSampleData": True,
                    "enableAutoClassification": True,
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


@pytest.fixture(scope="module")
def run_workflow():
    def _run(workflow_type: Type[IngestionWorkflow], config, raise_from_status=True):
        workflow: IngestionWorkflow = workflow_type.create(config)
        workflow.execute()
        if raise_from_status:
            workflow.print_status()
            workflow.raise_from_status()
        return workflow

    return _run


logger = logging.getLogger(__name__)


def _safe_delete(metadata, entity, entity_id, retries=3, **kwargs):
    """Delete with retry logic to handle transient server errors during parallel teardown."""
    for attempt in range(retries):
        try:
            metadata.delete(entity=entity, entity_id=entity_id, **kwargs)
            return
        except Exception:
            if attempt < retries - 1:
                logger.warning(
                    "Retry %d/%d: delete %s %s",
                    attempt + 1,
                    retries,
                    entity.__name__,
                    entity_id,
                )
                time.sleep(0.5 * (attempt + 1))
            else:
                raise


@pytest.fixture(scope="module")
def db_service(metadata, create_service_request, unmask_password):
    service_entity = metadata.create_or_update(data=create_service_request)
    fqn = service_entity.fullyQualifiedName.root
    yield unmask_password(service_entity)
    service_entity = metadata.get_by_name(DatabaseService, fqn)
    if service_entity:
        _safe_delete(
            metadata,
            entity=DatabaseService,
            entity_id=service_entity.id,
            recursive=True,
            hard_delete=True,
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
        if hasattr(service.connection.config, "authType"):
            service.connection.config.authType.password = (
                create_service_request.connection.config.authType.password
            )
            return service
        service.connection.config.password = (
            create_service_request.connection.config.password
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


@pytest.fixture(scope="module")
def monkeymodule():
    with pytest.MonkeyPatch.context() as mp:
        yield mp


@pytest.fixture(scope="module")
def patch_passwords_for_db_services(db_service, unmask_password, monkeymodule):
    """Patch the password for all db services returned by the metadata service.

    Usage:

    def test_my_test(db_service, patch_passwords_for_db_services):
        ...

    OR

    @pytest.usefixtures("patch_passwords_for_db_services")
    def test_my_test(db_service):
        ...
    """

    def override_password(getter):
        def inner(*args, **kwargs):
            result = getter(*args, **kwargs)
            if isinstance(result, DatabaseService):
                if result.fullyQualifiedName.root == db_service.fullyQualifiedName.root:
                    return unmask_password(result)
            return result

        return inner

    monkeymodule.setattr(
        "metadata.ingestion.ometa.ometa_api.OpenMetadata.get_by_name",
        override_password(OpenMetadata.get_by_name),
    )

    monkeymodule.setattr(
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
            _safe_delete(
                metadata,
                entity=etype,
                entity_id=entity.id,
                recursive=True,
                hard_delete=True,
            )


@pytest.fixture(scope="module")
def ingestion_config(db_service, metadata, workflow_config, sink_config):
    return {
        "source": {
            "type": db_service.connection.config.type.value.lower(),
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {"type": DatabaseMetadataConfigType.DatabaseMetadata.value}
            },
            "serviceConnection": db_service.connection.model_dump(),
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }
