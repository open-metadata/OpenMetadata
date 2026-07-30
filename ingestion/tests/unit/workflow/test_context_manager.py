import pytest

from metadata.workflow.context.app_metadata_context import (
    AppMetadataContext,
    AppMetadataContextFieldsEnum,
)
from metadata.workflow.context.context_manager import ContextManager, ContextsEnum
from metadata.workflow.context.workflow_context import (
    WorkflowContext,
    WorkflowContextFieldsEnum,
)


def test_singleton_behavior():
    cm1 = ContextManager.get_instance()
    cm2 = ContextManager.get_instance()
    assert cm1 is cm2, "ContextManager should be a singleton"


def test_context_get_set_attr():
    service_name = "test_service"
    cm = ContextManager.get_instance()
    assert cm is not None
    # Set and get using enums
    ContextManager.set_context_attr(ContextsEnum.WORKFLOW, WorkflowContextFieldsEnum.SERVICE_NAME, service_name)
    value = ContextManager.get_context_attr(ContextsEnum.WORKFLOW, WorkflowContextFieldsEnum.SERVICE_NAME)
    assert value == service_name


def test_get_context_returns_context():
    cm = ContextManager.get_instance()
    assert cm is not None
    workflow_ctx = ContextManager.get_context(ContextsEnum.WORKFLOW)
    assert isinstance(workflow_ctx, WorkflowContext)
    # Should be the same object as returned by get_context
    assert workflow_ctx is ContextManager.get_context(ContextsEnum.WORKFLOW)


def test_thread_safety():
    import threading

    cm = ContextManager.get_instance()
    assert cm is not None

    def set_service_name(name):
        ContextManager.set_context_attr(ContextsEnum.WORKFLOW, WorkflowContextFieldsEnum.SERVICE_NAME, name)

    threads = [threading.Thread(target=set_service_name, args=(f"service_{i}",)) for i in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    # The final value should be one of the set values
    final_value = ContextManager.get_context_attr(ContextsEnum.WORKFLOW, WorkflowContextFieldsEnum.SERVICE_NAME)
    assert final_value in {f"service_{i}" for i in range(10)}


def test_app_metadata_context_registered():
    ctx = ContextManager.get_context(ContextsEnum.APP_METADATA)
    assert isinstance(ctx, AppMetadataContext)


@pytest.fixture
def reset_app_metadata():
    """ContextManager is a process-wide singleton, so app-metadata state set by one
    test would otherwise leak into every test that runs after it."""
    yield
    ContextManager.set_context_attr(ContextsEnum.APP_METADATA, AppMetadataContextFieldsEnum.DATA, None)


def test_app_metadata_dumps_under_app_metadata_key(reset_app_metadata):
    data = {"impact": {"proposed": 9, "autoApplied": 0, "awaitingReview": 9, "rejected": 0}}
    ContextManager.set_context_attr(ContextsEnum.APP_METADATA, AppMetadataContextFieldsEnum.DATA, data)

    dumped = ContextManager.dump_contexts()

    assert dumped["appMetadata"]["data"] == data
